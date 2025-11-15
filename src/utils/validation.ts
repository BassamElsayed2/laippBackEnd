import { z } from "zod";

// Password validation schema
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character"
  );

// Email validation schema
export const emailSchema = z.string().email("Invalid email address");

// Phone validation schema (Egyptian format)
export const phoneSchema = z
  .string()
  .regex(/^(\+?20)?[0-9]{10,11}$/, "Invalid Egyptian phone number");

// UUID validation schema
export const uuidSchema = z.string().uuid("Invalid ID format");

// Validate password strength
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Sanitize input to prevent XSS
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove < and >
    .trim();
}

// Validate and normalize phone number
export function normalizePhone(phone: string): string {
  // Remove spaces, dashes, parentheses
  let normalized = phone.replace(/[\s\-()]/g, "");

  // Add +20 prefix if not present
  if (!normalized.startsWith("+")) {
    if (normalized.startsWith("20")) {
      normalized = "+" + normalized;
    } else if (normalized.startsWith("0")) {
      normalized = "+20" + normalized.slice(1);
    } else {
      normalized = "+20" + normalized;
    }
  }

  return normalized;
}
