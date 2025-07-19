import { CronJob } from 'cron';
import pool from '../db.js';
import * as trelloService from './trelloService.js';

let cronJob;

/**
 * @description Calculates the next due date for a given schedule.
 * @param {object} schedule - The schedule object from the database.
 * @returns {Date} The next due date.
 */
export const calculateNextDueDate = (schedule) => {
    const { frequency, frequency_interval, frequency_details, last_card_created_at, start_date, trigger_hour, trigger_minute, trigger_ampm } = schedule;
    const baseDate = last_card_created_at ? new Date(Math.max(new Date(last_card_created_at), new Date(start_date || 0))) : new Date(start_date || Date.now());
    let nextDate = new Date(baseDate);
    const interval = frequency_interval || 1;
    let hour = parseInt(trigger_hour, 10) || 9;
    if (trigger_ampm === 'pm' && hour !== 12) hour += 12;
    if (trigger_ampm === 'am' && hour === 12) hour = 0;
    nextDate.setHours(hour, parseInt(trigger_minute, 10) || 0, 0, 0);

    switch (frequency) {
        case 'daily':
            nextDate.setDate(nextDate.getDate() + interval);
            break;
        case 'weekly':
            const scheduledDays = (frequency_details || '').split(',').map(d => parseInt(d, 10));
            nextDate.setDate(baseDate.getDate() + 1);
            let lookahead = 0;
            while (!scheduledDays.includes(nextDate.getDay()) && lookahead < 14) {
                nextDate.setDate(nextDate.getDate() + 1);
                lookahead++;
            }
            break;
        case 'monthly':
            nextDate.setMonth(baseDate.getMonth() + interval, parseInt(frequency_details, 10) || 1);
            break;
        case 'yearly':
            const [month, day] = (frequency_details || '1-1').split('-').map(d => parseInt(d, 10));
            nextDate.setFullYear(baseDate.getFullYear() + interval, month - 1, day);
            break;
        default:
            return new Date();
    }
    return nextDate;
};

/**
 * @description The main logic that runs on a schedule to check for and create Trello cards.
 * @param {object} appSettings - The current application settings.
 * @param {function} logAuditEvent - The audit logging function.
 */
const runScheduler = async (appSettings, logAuditEvent) => {
    const runId = Math.random().toString(36).substring(2, 8);
    await logAuditEvent('INFO', 'Scheduler starting evaluation run.', { runId });
    const startTime = Date.now();
    
    try {
        const { rows: schedules } = await pool.query('SELECT * FROM schedules WHERE frequency != \'once\'');
        for (const schedule of schedules) {
            let shouldCreateNewCard = schedule.needs_new_card;
            if (schedule.active_card_id && !shouldCreateNewCard) {
                try {
                    const activeCard = await trelloService.getTrelloCard(schedule.active_card_id, appSettings);
                    if (!activeCard || activeCard.closed || activeCard.idList === appSettings.TRELLO_DONE_LIST_ID) {
                        await logAuditEvent('INFO', `Active card for schedule ${schedule.id} is completed.`, { cardId: schedule.active_card_id, runId });
                        shouldCreateNewCard = true;
                        await pool.query('UPDATE schedules SET needs_new_card = TRUE, active_card_id = NULL WHERE id = $1', [schedule.id]);
                    }
                } catch (error) {
                    await logAuditEvent('ERROR', `Failed to check status of active card for schedule ${schedule.id}.`, { cardId: schedule.active_card_id, error: String(error), runId });
                }
            }
            if (shouldCreateNewCard) {
                const nextDueDate = calculateNextDueDate(schedule);
                const startDate = schedule.start_date ? new Date(schedule.start_date) : null;
                const endDate = schedule.end_date ? new Date(schedule.end_date) : null;
                if ((startDate && nextDueDate < startDate) || (endDate && nextDueDate > endDate)) {
                    await logAuditEvent('INFO', `Next due date for schedule ${schedule.id} is outside the defined start/end range. Skipping.`, { nextDueDate, startDate, endDate, runId });
                    continue;
                }
                try {
                    const newCard = await trelloService.createTrelloCard(schedule, nextDueDate, appSettings, logAuditEvent, runId);
                    if (newCard) {
                        await pool.query('UPDATE schedules SET active_card_id = $1, last_card_created_at = NOW(), needs_new_card = FALSE WHERE id = $2', [newCard.id, schedule.id]);
                    }
                } catch (error) {
                    console.error(`Error during card creation for schedule ${schedule.id}:`, error);
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
 * @param {function} logAuditEvent - The audit logging function.
 */
export const reinitializeCronJob = (appSettings, logAuditEvent) => {
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
            () => runScheduler(appSettings, logAuditEvent),
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