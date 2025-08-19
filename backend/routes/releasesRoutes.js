import express from 'express';
import axios from 'axios';

const router = express.Router();

const GITHUB_REPO_URL = 'https://api.github.com/repos/bodybuildingfly/trello-card-scheduler/releases';

/**
 * @route   GET /api/releases
 * @desc    Get latest releases from GitHub
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const response = await axios.get(GITHUB_REPO_URL);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching GitHub releases:', error.message);
        res.status(500).json({ message: 'Failed to fetch releases from GitHub' });
    }
});

export default router;
