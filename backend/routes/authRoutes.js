import express from 'express';
import { loginUser, refreshToken, logoutUser } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @description Defines the authentication routes for the application.
 */

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', loginUser);

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public (relies on httpOnly cookie)
router.post('/refresh', refreshToken);

// @route   POST /api/auth/logout
// @desc    Logout user and clear refresh token
// @access  Public (relies on httpOnly cookie)
router.post('/logout', logoutUser);

export default router;
