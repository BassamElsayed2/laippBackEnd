import { Router } from 'express';
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
  checkEmailAvailability,
  checkPhoneAvailability,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import {
  validate,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../middleware/validation';
import { authLimiter, passwordLimiter } from '../middleware/rateLimiter';

const router = Router();

// CSRF Protection - DISABLED
// Public routes with rate limiting (CSRF protection removed)
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/check-email', checkEmailAvailability); // Check if email is available
router.get('/check-phone', checkPhoneAvailability); // Check if phone is available

// Protected routes (CSRF protection removed)
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, validate(updateProfileSchema), updateProfile);
router.post('/change-password', authenticate, passwordLimiter, validate(changePasswordSchema), changePassword);
router.post('/logout', authenticate, logout);

export default router;


