import express from 'express';
import { getStats } from '../controllers/statsController.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @description Defines the statistics routes for the application.
 * All routes in this file require the user to be an authenticated administrator.
 */

// Apply the 'protect' and 'isAdmin' middleware to the route.
router.get('/', protect, isAdmin, getStats);

export default router;