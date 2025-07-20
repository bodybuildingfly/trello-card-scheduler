import express from 'express';
import { createUser, getAllUsers, deleteUser, resetPassword } from '../controllers/usersController.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @description Defines the user management routes. All routes in this file
 * require the user to be an authenticated administrator.
 */

// Apply the 'protect' and 'isAdmin' middleware to all routes in this file.
router.use(protect, isAdmin);

// --- User Collection Routes ---
router.route('/')
    .get(getAllUsers)
    .post(createUser);

// --- Single User Routes ---
router.route('/:id')
    .delete(deleteUser);

// --- Password Reset Route ---
router.put('/:id/reset-password', resetPassword);


export default router;
