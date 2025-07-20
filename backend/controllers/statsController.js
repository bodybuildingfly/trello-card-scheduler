import pool from '../db.js';

/**
 * @description Gathers various application statistics from the database.
 * @route GET /api/stats
 * @access Private/Admin
 */
export const getStats = async (req, res) => {
    try {
        // Run all statistics queries in parallel for efficiency
        const [
            totalSchedulesResult,
            totalCardsCreatedResult,
            cardsPerUserResult,
            schedulesPerCategoryResult
        ] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM schedules'),
            pool.query("SELECT COUNT(*) FROM audit_logs WHERE message LIKE 'Card creation successful%'"),
            pool.query("SELECT username, COUNT(*) as count FROM audit_logs WHERE message LIKE 'Card creation successful%' AND username IS NOT NULL GROUP BY username ORDER BY count DESC"),
            pool.query("SELECT COALESCE(category, 'Uncategorized') as category, COUNT(*) as count FROM schedules GROUP BY COALESCE(category, 'Uncategorized') ORDER BY count DESC")
        ]);

        // Assemble the final statistics object
        const stats = {
            totalSchedules: parseInt(totalSchedulesResult.rows[0].count, 10),
            totalCardsCreated: parseInt(totalCardsCreatedResult.rows[0].count, 10),
            cardsPerUser: cardsPerUserResult.rows,
            schedulesPerCategory: schedulesPerCategoryResult.rows
        };

        res.status(200).json(stats);

    } catch (error) {
        console.error('Failed to fetch statistics:', error);
        res.status(500).json({ message: 'Server error while fetching statistics.' });
    }
};