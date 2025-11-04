import { Router } from 'express';
import {
  initiatePayment,
  handlePaymentCallback,
  getPaymentStatus,
} from '../controllers/paymentController';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// Payment routes
router.post('/initiate', initiatePayment);
router.post('/callback', handlePaymentCallback); // Easykash webhook
router.get('/:order_id/status', optionalAuth, getPaymentStatus);

export default router;


