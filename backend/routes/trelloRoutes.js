import express from 'express';
import {
    testCredentials,
    getBoards,
    getLists,
    getLabels,
    getMembers
} from '../controllers/trelloController.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @description Defines the Trello-related API routes for the application.
 * Access is controlled on a per-route basis.
 */

// --- Admin-Only Routes ---
// These routes are used in the settings page and should only be accessible by admins.
router.post('/credentials/test', protect, isAdmin, testCredentials);
router.get('/boards', protect, isAdmin, getBoards);
router.get('/lists/:boardId', protect, isAdmin, getLists);

// --- Authenticated User Routes ---
// Any logged-in user needs to be able to fetch labels and members for the schedule form.
router.get('/labels/:boardId', protect, getLabels);
router.get('/members', protect, getMembers);


export default router;