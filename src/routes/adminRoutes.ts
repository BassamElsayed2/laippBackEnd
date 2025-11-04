import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  getAllOrders,
  getOrderStats,
  createAdminUser,
} from '../controllers/adminController';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

// Orders management
router.get('/orders', getAllOrders);
router.get('/orders/stats', getOrderStats);

// Users management
router.post('/users/create-admin', createAdminUser);

// TODO: Add more admin endpoints
// router.get('/users', getAllUsers);
// router.get('/users/stats', getUserStats);
// router.put('/users/:id', updateUser);
// router.delete('/users/:id', deleteUser);

export default router;

