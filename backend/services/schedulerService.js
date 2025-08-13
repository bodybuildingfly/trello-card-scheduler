import { CronJob } from 'cron';
import pool from '../db.js';
import * as trelloService from './trelloService.js';
import logAuditEvent from '../utils/logger.js';

let cronJob;

/**
 * @description Calculates the next valid future due date for a given schedule.
 * @param {object} schedule - The schedule object from the database.
 * @param {Date|null} lastDueDate - The due date of the last created card, or null if none.
 * @param {Date} [now=new Date()] - The current date, injectable for testing.
 * @returns {Date} The next due date.
 */
export const calculateNextDueDate = (schedule, lastDueDate, now = new Date()) => {
    const { frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm } = schedule;

    let nextDate = lastDueDate ? new Date(lastDueDate) : new Date(now.getTime());

    const interval = frequency_interval || 1;
    let hour = parseInt(trigger_hour, 10) || 9;
    if (trigger_ampm === 'pm' && hour !== 12) hour += 12;
    if (trigger_ampm === 'am' && hour === 12) hour = 0;

    nextDate.setHours(hour, parseInt(trigger_minute, 10) || 0, 0, 0);

    const advanceDate = () => {
        switch (frequency) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + interval);
                break;
            case 'weekly':
                const scheduledDays = (frequency_details || '').split(',').map(d => parseInt(d, 10));
                // Check if lastDueDate is the last selected day of the week
                if (nextDate.getDay() === scheduledDays[scheduledDays.length-1]) {
                    // Move to the beginning of the next weekly interval
                    nextDate.setDate(nextDate.getDate() + (7 - nextDate.getDay()) + (7 * (interval - 1)));
                } else {
                    // Let the weekly frequency logic further below move to the next day of the current week
                    nextDate.setDate(nextDate.getDate() + 1);
                }
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + interval);
                break;
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + interval);
                break;
        }
    };

    let safetyCounter = 0;

    if (lastDueDate) {
        advanceDate();
    } else {
        if (nextDate <= now) {
            nextDate.setDate(nextDate.getDate() + 1);
        }
    }

    while (nextDate <= now && safetyCounter < 1000) {
        advanceDate();
        safetyCounter++;
    }
    
    if (frequency === 'weekly') {
        const scheduledDays = (frequency_details || '').split(',').map(d => parseInt(d, 10));
        if (scheduledDays.length > 0) {
            let weeklySafety = 0;
            while (!scheduledDays.includes(nextDate.getDay()) && weeklySafety < 7) {
                nextDate.setDate(nextDate.getDate() + 1);
                weeklySafety++;
            }
        }
    } else if (frequency === 'monthly') {
        nextDate.setDate(parseInt(frequency_details, 10) || 1);
    } else if (frequency === 'yearly') {
        const [month, day] = (frequency_details || '1-1').split('-').map(d => parseInt(d, 10));
        nextDate.setFullYear(nextDate.getFullYear(), month - 1, day);
    }

    while (nextDate <= now && safetyCounter < 1000) {
        advanceDate();
        safetyCounter++;
    }

    return nextDate;
};


/**
 * @description The main logic that runs on a schedule to check for and create Trello cards.
 * @param {object} appSettings - The current application settings.
 */
const runScheduler = async (appSettings) => {
    const runId = Math.random().toString(36).substring(2, 8);
    await logAuditEvent('INFO', 'Scheduler starting evaluation run.', { runId });
    const startTime = Date.now();
    
    try {
        const { rows: schedules } = await pool.query("SELECT * FROM schedules WHERE is_active = TRUE");
        for (const schedule of schedules) {
            let canCreateNewCard = false;
            let lastDueDateForCalc = null;

            if (!schedule.active_card_id) {
                canCreateNewCard = true;
            } else {
                try {
                    const activeCard = await trelloService.getTrelloCard(schedule.active_card_id, appSettings);
                    if (!activeCard || activeCard.closed || activeCard.idList === appSettings.TRELLO_DONE_LIST_ID) {
                        await logAuditEvent('INFO', `Active card for schedule ${schedule.id} is completed. A new card will be created.`, { cardId: schedule.active_card_id, runId });
                        canCreateNewCard = true;
                        if (activeCard) {
                            lastDueDateForCalc = new Date(activeCard.due);
                        }
                    } else {
                        await logAuditEvent('INFO', `Skipping card creation for schedule ${schedule.id}: active card "${activeCard.name}" is not yet complete.`, { cardId: schedule.active_card_id, runId });
                    }
                } catch (error) {
                    await logAuditEvent('ERROR', `Failed to check status of active card for schedule ${schedule.id}.`, { cardId: schedule.active_card_id, error: String(error), runId });
                }
            }

            if (canCreateNewCard) {
                const nextDueDate = calculateNextDueDate(schedule, lastDueDateForCalc);
                const startDate = schedule.start_date ? new Date(schedule.start_date) : null;
                const endDate = schedule.end_date ? new Date(schedule.end_date) : null;

                if ((startDate && nextDueDate < startDate) || (endDate && nextDueDate > endDate)) {
                    await logAuditEvent('INFO', `Next due date for schedule ${schedule.id} is outside the defined start/end range. Skipping.`, { nextDueDate, startDate, endDate, runId });
                    continue;
                }
                
                try {
                    const newCard = await trelloService.createTrelloCard(schedule, nextDueDate, appSettings);
                    if (newCard) {
                        await logAuditEvent('INFO', `Card creation successful: "${newCard.name}"`, { schedule, newCard, dueDate: nextDueDate, runId });
                        await pool.query(
                            'UPDATE schedules SET active_card_id = $1, last_card_created_at = NOW() WHERE id = $2', 
                            [newCard.id, schedule.id]
                        );
                    }
                } catch (error) {
                    const errorDetails = {
                        schedule,
                        statusCode: error.response?.status,
                        response: error.response?.data || error.message,
                        runId
                    };
                    await logAuditEvent('ERROR', 'Card creation failed: Trello API error.', errorDetails);
                }
            }
        }
    } catch (error) {
        await logAuditEvent('ERROR', 'Scheduler run failed with a database error.', { error: String(error), runId });
    }

    const duration = Date.now() - startTime;
    await logAuditEvent('INFO', 'Scheduler run finished.', { durationMs: duration, runId });
};

/**
 * @description Initializes or re-initializes the cron job with the current settings.
 * @param {object} appSettings - The current application settings.
 */
export const reinitializeCronJob = (appSettings) => {
    if (cronJob) {
        cronJob.stop();
    }

    const timeZone = process.env.TZ || "America/New_York";
    const cronPattern = appSettings.CRON_SCHEDULE || '0 1 * * *';

    if (typeof cronPattern !== 'string') {
        console.error(`[CRITICAL] CRON_SCHEDULE is not a string! Found type: ${typeof cronPattern}. Halting cron initialization.`);
        logAuditEvent('CRITICAL', 'Scheduler failed to start: CRON_SCHEDULE setting is not a valid string.');
        return;
    }

    try {
        cronJob = new CronJob(
            cronPattern,
            () => runScheduler(appSettings),
            null,
            true,
            timeZone
        );
        
        console.log(`[INFO] Cron job re-initialized with pattern: "${cronPattern}" in timezone ${timeZone}`);
    } catch (err) {
        console.error(`[CRITICAL] Failed to create CronJob. Invalid cron pattern or timezone? Pattern: "${cronPattern}", TZ: "${timeZone}"`);
        logAuditEvent('CRITICAL', 'Scheduler failed to start: Invalid cron pattern.', { pattern: cronPattern, error: err.message });
    }
};

/**
 * @description A getter function to allow other modules to access the cronJob instance.
 * @returns {CronJob} The active cron job instance.
 */
export const getSchedulerInstance = () => cronJob;