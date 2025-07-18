import express from 'express';
import {
    testCredentials,
    getBoards,
    getLists,
    getLabels,
    getMembers
} from '../controllers/trelloController.js';

const router = express.Router();

// The routes now directly reference the controller functions.
// The necessary config will be available on the `req` object via middleware.
router.post('/credentials/test', testCredentials);
router.get('/boards', getBoards);
router.get('/lists/:boardId', getLists);
router.get('/labels/:boardId', getLabels);
router.get('/members', getMembers);

export default router;