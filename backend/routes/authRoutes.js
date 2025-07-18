import express from 'express';
import { loginUser } from '../controllers/authController.js';

const router = express.Router();

/**
 * @description Defines the authentication routes for the application.
 */

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', loginUser);

export default router;
