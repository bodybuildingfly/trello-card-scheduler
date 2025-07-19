import express from 'express';
import {
    getSettings,
    updateSettings,
    updateCredentials
} from '../controllers/settingsController.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// --- Apply the 'protect' middleware to all routes in this file ---
// This ensures that only authenticated users can access these endpoints,
// and it makes the req.user object available to the controllers.
router.use(protect, isAdmin);

// The routes directly reference the controller functions.
router.get('/', getSettings);
router.put('/', updateSettings);
router.put('/credentials', updateCredentials);

export default router;