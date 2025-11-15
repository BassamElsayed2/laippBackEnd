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
import { OrdersService } from '../services/orders.service';
import { ApiError } from '../middleware/errorHandler';

const router = Router();

// Public routes
router.post('/', validate(createOrderSchema), createOrder);

// Protected routes
router.get('/my-orders', authenticate, getUserOrders);

// Admin routes (must come before dynamic :id routes)
router.get('/', authenticate, requireAdmin, getAllOrders);

// Delete order (Admin only) - must come before GET /:id
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await OrdersService.deleteOrder(id);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Dynamic routes (must come last)
router.get('/:id', optionalAuth, getOrderById);
router.put('/:id/status', authenticate, requireAdmin, updateOrderStatus);

export default router;


