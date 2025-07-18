import express from 'express';
import { createUser, getAllUsers, deleteUser } from '../controllers/usersController.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @description Defines the user management routes. All routes in this file
 * require the user to be an authenticated administrator.
 */

// Apply the 'protect' and 'isAdmin' middleware to all routes in this file.
// This ensures only logged-in admins can access these endpoints.
router.use(protect, isAdmin);

// @route   GET /api/users
// @desc    Get all users
// @access  Private/Admin
router.get('/', getAllUsers);

// @route   POST /api/users
// @desc    Create a new user
// @access  Private/Admin
router.post('/', createUser);

// @route   DELETE /api/users/:id
// @desc    Delete a user
// @access  Private/Admin
router.delete('/:id', deleteUser);

export default router;
