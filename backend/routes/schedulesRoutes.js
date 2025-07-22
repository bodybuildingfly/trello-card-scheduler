import express from 'express';
import { 
  getAllSchedules, 
  getUniqueCategories,
  createSchedule, 
  updateSchedule, 
  deleteSchedule, 
  triggerSchedule,
  cloneSchedule,
  toggleScheduleStatus
} from '../controllers/schedulesController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply the 'protect' middleware to all routes in this file
router.use(protect);

// It's a best practice to put more specific routes before more general ones.
router.get('/categories', getUniqueCategories); // Add the new route

router.get('/', getAllSchedules);
router.post('/', createSchedule);
router.put('/:id', updateSchedule);
router.delete('/:id', deleteSchedule);
router.post('/:id/trigger', triggerSchedule);
router.post('/:id/clone', cloneSchedule);
router.put('/:id/toggle-active', toggleScheduleStatus); // New route for toggling active status

export default router;