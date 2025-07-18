import express from 'express';
import {
    getSettings,
    updateSettings,
    updateCredentials
} from '../controllers/settingsController.js';

const router = express.Router();

// The routes directly reference the controller functions.
router.get('/', getSettings);
router.put('/', updateSettings);
router.put('/credentials', updateCredentials);

export default router;