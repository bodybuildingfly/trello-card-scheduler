import express from 'express';
import { 
  getAllRecords, 
  createRecord, 
  updateRecord, 
  deleteRecord, 
  triggerRecord 
} from '../controllers/recordsController.js';
import { protect } from '../middleware/authMiddleware.js'; // <-- ADDED: Import the protect middleware

const router = express.Router();

// --- Apply the 'protect' middleware to all routes in this file ---
// This ensures that only authenticated users can access these endpoints,
// and it makes the req.user object available to the controllers.
router.use(protect);

router.get('/', getAllRecords);
router.post('/', createRecord);
router.put('/:id', updateRecord);
router.delete('/:id', deleteRecord);
router.post('/:id/trigger', triggerRecord);

export default router;
