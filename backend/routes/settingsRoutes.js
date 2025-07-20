import express from 'express';
import { getSettings, updateSettings, updateCredentials } from '../controllers/settingsController.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @description Defines the settings routes for the application.
 * Reading settings is available to all authenticated users, while
 * modifying settings is restricted to administrators.
 */

// @route   GET /api/settings
// @desc    Get the current application settings
// @access  Private (All authenticated users)
router.get('/', protect, getSettings);

// @route   PUT /api/settings
// @desc    Update general application settings
// @access  Private/Admin
router.put('/', protect, isAdmin, updateSettings);

// @route   PUT /api/settings/credentials
// @desc    Update sensitive Trello API credentials
// @access  Private/Admin
router.put('/credentials', protect, isAdmin, updateCredentials);

export default router;