import express from 'express';
import { getAuditLogs, getSchedulerStatus } from '../controllers/appStatusController.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @description Defines the application status routes.
 * These routes are protected individually to avoid conflicts with other /api routes.
 */

// @route   GET /api/audit-logs
// @desc    Get the most recent audit logs
// @access  Private/Admin
router.get('/audit-logs', protect, isAdmin, getAuditLogs);

// @route   GET /api/scheduler/status
// @desc    Get the current status of the scheduler
// @access  Private/Admin
router.get('/scheduler/status', protect, isAdmin, getSchedulerStatus);

export default router;