import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../config/database";
import { AuthRequest } from "../types";
import { ApiError } from "./error.middleware";

interface JWTPayload {
  userId: string;
  email: string;
  role?: "user" | "admin";
}

// Verify JWT token from cookie
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Get token from cookies - support both app and dashboard cookies
    const token =
      req.cookies["dashboard_session"] ||
      req.cookies["food_cms_session"] ||
      req.cookies["food_cms.session.token"];

    if (!token) {
      throw new ApiError(401, "Authentication required");
    }

    // Verify token
    const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret";
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Check if session exists and is valid
    const result = await pool.request().input("token", token).query(`
        SELECT s.*, u.email, u.email_verified
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = @token
        AND s.expires_at > GETDATE()
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(401, "Invalid or expired session");
    }

    const session = result.recordset[0];

    // Update last activity
    await pool.request().input("token", token).query(`
        UPDATE sessions
        SET last_activity = GETDATE()
        WHERE token = @token
      `);

    // Attach user to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role || "user",
      email_verified: session.email_verified,
      created_at: session.created_at,
      updated_at: session.updated_at,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new ApiError(401, "Invalid token"));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new ApiError(401, "Token expired"));
    }
    next(error);
  }
}

// Check if user is admin
export async function adminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new ApiError(401, "Authentication required");
    }

    // Check if user is admin
    const result = await pool.request().input("userId", req.user.id).query(`
        SELECT id, role
        FROM admin_profiles
        WHERE user_id = @userId
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(403, "Admin access required");
    }

    next();
  } catch (error) {
    next(error);
  }
}

// Optional auth - doesn't throw error if no token
export async function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token =
      req.cookies["dashboard_session"] ||
      req.cookies["food_cms_session"] ||
      req.cookies["food_cms.session.token"];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-jwt-secret"
    ) as JWTPayload;

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role || "user",
      email_verified: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    next();
  } catch (error) {
    // Ignore errors in optional auth
    next();
  }
}
