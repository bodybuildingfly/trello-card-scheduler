import express from 'express';
import {
    getAuditLogs,
    getSchedulerStatus
} from '../controllers/appStatusController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// --- Apply the 'protect' middleware to all routes in this file ---
// This ensures that only authenticated users can access these endpoints,
// and it makes the req.user object available to the controllers.
router.use(protect);

// Define the routes
router.get('/audit-logs', getAuditLogs);
router.get('/scheduler/status', getSchedulerStatus);

export default router;