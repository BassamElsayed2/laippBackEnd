import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getPool } from '../config/database';
import { AuthRequest, User } from '../types';
import { ApiError } from './errorHandler';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header or cookie
    const token =
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies?.auth_token;

    if (!token) {
      throw new ApiError(401, 'Authentication required');
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Get user from database
    const pool = getPool();
    const result = await pool
      .request()
      .input('userId', decoded.userId)
      .query<User>(`
        SELECT id, email, email_verified, name, role, created_at, updated_at
        FROM users
        WHERE id = @userId
      `);

    if (!result.recordset.length) {
      throw new ApiError(401, 'User not found');
    }

    const user = result.recordset[0];

    // Attach user to request
    req.user = user;

    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return next(new ApiError(401, 'Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Token expired'));
    }
    next(error);
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token =
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies?.auth_token;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    const pool = getPool();
    const result = await pool
      .request()
      .input('userId', decoded.userId)
      .query<User>(`
        SELECT id, email, email_verified, name, role, created_at, updated_at
        FROM users
        WHERE id = @userId
      `);

    if (result.recordset.length) {
      req.user = result.recordset[0];
    }

    next();
  } catch (error) {
    // Don't fail, just continue without user
    next();
  }
};

/**
 * Admin authorization middleware
 * Only allows users with role='admin' to access
 */
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }

  if (req.user.role !== 'admin') {
    return next(new ApiError(403, 'Admin access required. This endpoint is only for dashboard administrators.'));
  }

  next();
};

/**
 * Customer authorization middleware
 * Only allows users with role='user' to access (excludes admins)
 * Use this for customer-specific endpoints like placing orders, managing addresses, etc.
 */
export const requireCustomer = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }

  if (req.user.role !== 'user') {
    return next(new ApiError(403, 'This endpoint is only for customer accounts. Please use a customer account to access this feature.'));
  }

  next();
};

/**
 * Generate JWT token
 */
export const generateToken = (user: User, rememberMe: boolean = false): string => {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  // If rememberMe is true, token expires in 30 days, otherwise 7 days
  const expiresIn = rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '7d');

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
  } as jwt.SignOptions);
};

