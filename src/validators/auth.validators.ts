import { z } from "zod";
import { emailSchema, passwordSchema, phoneSchema } from "../utils/validation";

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100),
  phone: phoneSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z
  .object({
    full_name: z.string().min(2).max(100).optional(),
    phone: phoneSchema.optional(),
  })
  .refine((data) => data.full_name || data.phone, {
    message: "At least one field must be provided",
  });

export const changePasswordSchema = z.object({
  old_password: z.string().min(1, "Current password is required"),
  new_password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});
