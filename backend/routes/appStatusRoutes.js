import express from 'express';
import { getAuditLogs, getSchedulerStatus } from '../controllers/appStatusController.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @description Defines the application status routes.
 */

// @route   GET /api/audit-logs
// @desc    Get the most recent audit logs
// @access  Private/Admin (Requires both authentication and admin role)
router.get('/audit-logs', protect, isAdmin, getAuditLogs);

// @route   GET /api/scheduler/status
// @desc    Get the current status of the scheduler
// @access  Private (Requires authentication, but is available to all roles)
router.get('/scheduler/status', protect, getSchedulerStatus);

export default router;