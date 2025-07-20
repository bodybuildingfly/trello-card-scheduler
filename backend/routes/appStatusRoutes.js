import express from 'express';
import { getAuditLogs, getSchedulerStatus, getAppVersion } from '../controllers/appStatusController.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @description Defines the application status routes.
 */

// This route is public, so it has no middleware.
router.get('/version', getAppVersion);

router.get('/audit-logs', protect, isAdmin, getAuditLogs);
router.get('/scheduler/status', protect, getSchedulerStatus);

export default router;