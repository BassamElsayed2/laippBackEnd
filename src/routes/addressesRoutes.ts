import { Router } from 'express';
import {
  getAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/addressesController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All address routes require authentication
router.get('/', authenticate, getAddresses);
router.get('/:id', authenticate, getAddress);
router.post('/', authenticate, createAddress);
router.put('/:id', authenticate, updateAddress);
router.delete('/:id', authenticate, deleteAddress);
router.patch('/:id/default', authenticate, setDefaultAddress);

export default router;

