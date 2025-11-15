import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  getAllOrders,
  getOrderStats,
  createAdminUser,
  getAllUsers,
  getUserStats,
  getUserById,
  deleteUser,
} from '../controllers/adminController';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

// Orders management
router.get('/orders', getAllOrders);
router.get('/orders/stats', getOrderStats);

// Users management
router.get('/users', getAllUsers);
router.get('/users/stats', getUserStats);
router.get('/users/:id', getUserById);
router.post('/users/create-admin', createAdminUser);
router.delete('/users/:id', deleteUser);

export default router;

