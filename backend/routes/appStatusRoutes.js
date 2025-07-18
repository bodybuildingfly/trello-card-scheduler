import express from 'express';
import { getAuditLogs, getSchedulerStatus } from '../controllers/appStatusController.js';

const router = express.Router();

// Define the routes
router.get('/audit-logs', getAuditLogs);
router.get('/scheduler/status', getSchedulerStatus);

export default router;