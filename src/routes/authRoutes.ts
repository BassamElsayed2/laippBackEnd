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

// Try to import CSRF protection middleware (if exists)
let csrfProtection: any = (req: any, res: any, next: any) => next();
try {
  const securityMiddleware = require('../middleware/security.middleware');
  if (securityMiddleware.csrfProtection) {
    csrfProtection = securityMiddleware.csrfProtection;
  }
} catch (error) {
  console.warn('⚠️ CSRF Protection middleware not found, continuing without it');
}

// Public routes with rate limiting and CSRF protection
router.post('/register', csrfProtection, authLimiter, validate(registerSchema), register);
router.post('/login', csrfProtection, authLimiter, validate(loginSchema), login);
router.get('/check-email', checkEmailAvailability); // Check if email is available
router.get('/check-phone', checkPhoneAvailability); // Check if phone is available

// Protected routes with CSRF protection
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, csrfProtection, validate(updateProfileSchema), updateProfile);
router.post('/change-password', authenticate, csrfProtection, passwordLimiter, validate(changePasswordSchema), changePassword);
router.post('/logout', authenticate, csrfProtection, logout);

export default router;


