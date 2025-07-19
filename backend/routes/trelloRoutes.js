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

// --- Apply the 'protect' middleware to all routes in this file ---
// This ensures that only authenticated users can access these endpoints,
// and it makes the req.user object available to the controllers.
router.use(protect, isAdmin);

router.post('/credentials/test', testCredentials);
router.get('/boards', getBoards);
router.get('/lists/:boardId', getLists);
router.get('/labels/:boardId', getLabels);
router.get('/members', getMembers);

export default router;