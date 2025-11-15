import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { logger } from "../utils/logger";

// Log security event to database
export async function logSecurityEvent(
  eventType: string,
  req: Request,
  userId?: string,
  email?: string,
  details?: any
) {
  try {
    await pool
      .request()
      .input("eventType", eventType)
      .input("userId", userId || null)
      .input("email", email || null)
      .input("ipAddress", req.ip || null)
      .input("userAgent", req.get("user-agent") || null)
      .input("location", null) // Can be populated with IP geolocation
      .input("details", details ? JSON.stringify(details) : null)
      .execute("sp_RecordSecurityEvent");
  } catch (error) {
    logger.error("Failed to log security event:", error);
  }
}

// Middleware to detect suspicious activity
export async function suspiciousActivityDetector(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const ip = req.ip;
    const path = req.path;

    // Check for SQL injection patterns
    const sqlInjectionPattern =
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b|--|\/\*|\*\/|;|'|"|\bOR\b|\bAND\b)/gi;
    const bodyStr = JSON.stringify(req.body);
    const queryStr = JSON.stringify(req.query);

    if (
      sqlInjectionPattern.test(bodyStr) ||
      sqlInjectionPattern.test(queryStr)
    ) {
      logger.warn("Potential SQL injection detected", {
        ip,
        path,
        body: req.body,
        query: req.query,
      });

      await logSecurityEvent("SUSPICIOUS_ACTIVITY", req, undefined, undefined, {
        reason: "SQL injection attempt",
        path,
      });

      return res.status(400).json({
        success: false,
        message: "Invalid request",
      });
    }

    // Check for XSS patterns
    const xssPattern = /<script|javascript:|onerror=|onload=/gi;
    if (xssPattern.test(bodyStr) || xssPattern.test(queryStr)) {
      logger.warn("Potential XSS detected", {
        ip,
        path,
      });

      await logSecurityEvent("SUSPICIOUS_ACTIVITY", req, undefined, undefined, {
        reason: "XSS attempt",
        path,
      });

      return res.status(400).json({
        success: false,
        message: "Invalid request",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}

// CSRF protection for state-changing operations
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Check origin header
  const origin = req.get("origin");
  const referer = req.get("referer");
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.DASHBOARD_URL,
    process.env.API_URL,
  ].filter(Boolean);

  if (
    origin &&
    !allowedOrigins.some((allowed) => origin.startsWith(allowed!))
  ) {
    logger.warn("CSRF: Invalid origin", { origin, path: req.path });
    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }

  next();
}

// Security headers middleware (complementing Helmet)
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Prevent MIME sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Enable XSS filter
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Remove X-Powered-By
  res.removeHeader("X-Powered-By");

  next();
}
