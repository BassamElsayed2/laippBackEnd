import { Router } from 'express';
import {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
} from '../controllers/ordersController';
import { authenticate, requireAdmin, optionalAuth } from '../middleware/auth';
import { validate, createOrderSchema } from '../middleware/validation';

const router = Router();

// Public routes
router.post('/', validate(createOrderSchema), createOrder);

// Protected routes
router.get('/my-orders', authenticate, getUserOrders);
router.get('/:id', optionalAuth, getOrderById);

// Admin routes
router.get('/', authenticate, requireAdmin, getAllOrders);
router.put('/:id/status', authenticate, requireAdmin, updateOrderStatus);

export default router;


