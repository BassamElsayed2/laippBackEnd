import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ApiError } from "./error.middleware";
import { sanitizeInput } from "../utils/validation";

// Recursively sanitize nested objects
function sanitizeObject(obj: any): any {
  if (typeof obj === "string") {
    return sanitizeInput(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (typeof obj === "object" && obj !== null) {
    const sanitized: any = {};
    for (const key in obj) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
    return sanitized;
  }

  return obj;
}

// Validate request body against Zod schema
export function validateBody(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize string inputs (including nested objects)
      if (typeof req.body === "object" && req.body !== null) {
        req.body = sanitizeObject(req.body);
      }

      // Validate against schema
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          field: String(err.path.join(".")),
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors,
        });
      }
      next(error);
    }
  };
}

// Validate request query params
export function validateQuery(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          field: String(err.path.join(".")),
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          message: "Invalid query parameters",
          errors,
        });
      }
      next(error);
    }
  };
}

// Validate request params
export function validateParams(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          field: String(err.path.join(".")),
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          message: "Invalid parameters",
          errors,
        });
      }
      next(error);
    }
  };
}

// Sanitize all request data
export function sanitizeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Sanitize body
    if (typeof req.body === "object" && req.body !== null) {
      for (const key in req.body) {
        if (typeof req.body[key] === "string") {
          req.body[key] = sanitizeInput(req.body[key]);
        }
      }
    }

    // Sanitize query
    if (typeof req.query === "object" && req.query !== null) {
      for (const key in req.query) {
        if (typeof req.query[key] === "string") {
          req.query[key] = sanitizeInput(req.query[key] as string);
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}
