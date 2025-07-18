import express from 'express';
import { 
  getAllRecords, 
  createRecord, 
  updateRecord, 
  deleteRecord, 
  triggerRecord 
} from '../controllers/recordsController.js';

const router = express.Router();

router.get('/', getAllRecords);
router.post('/', createRecord);
router.put('/:id', updateRecord);
router.delete('/:id', deleteRecord);
router.post('/:id/trigger', triggerRecord);

export default router;
