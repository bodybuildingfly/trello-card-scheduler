import express from 'express';
import { 
  getAllSchedules, 
  createSchedule, 
  updateSchedule, 
  deleteSchedule, 
  triggerSchedule 
} from '../controllers/schedulesController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply the 'protect' middleware to all routes in this file
router.use(protect);

router.get('/', getAllSchedules);
router.post('/', createSchedule);
router.put('/:id', updateSchedule);
router.delete('/:id', deleteSchedule);
router.post('/:id/trigger', triggerSchedule);

export default router;