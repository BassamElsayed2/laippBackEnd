import { Router } from "express";
import { FeedbackController } from "../controllers/feedback.controller";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware";
import {
  validateQuery,
  validateParams,
  validateBody,
} from "../middleware/validation.middleware";
import { z } from "zod";

const router = Router();

// Submit feedback schema (for customer submissions - no auth required)
const submitFeedbackSchema = z.object({
  branch_id: z.string().uuid(),
  customer_name: z.string().min(1),
  phone_number: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  overall_rating: z.number().min(1).max(4),
  reception_rating: z.number().min(0).max(4).optional(),
  service_speed_rating: z.number().min(0).max(4).optional(),
  quality_rating: z.number().min(0).max(4).optional(),
  cleanliness_rating: z.number().min(0).max(4).optional(),
  catering_rating: z.number().min(0).max(4).optional(),
  opinion: z.string().optional().or(z.literal("")),
});

// Query schema for filtering
const feedbackQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  min_rating: z.string().optional(),
  max_rating: z.string().optional(),
  rating: z.string().optional(),
  search: z.string().optional(),
  branchId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Analytics query schema
const analyticsQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Update status schema
const updateStatusSchema = z.object({
  is_published: z.boolean(),
});

// Public routes (no auth required)
router.post(
  "/submit",
  validateBody(submitFeedbackSchema),
  FeedbackController.submitFeedback
);

// Admin routes
router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  validateQuery(feedbackQuerySchema),
  FeedbackController.getFeedback
);

router.get(
  "/analytics",
  authMiddleware,
  adminMiddleware,
  validateQuery(analyticsQuerySchema),
  FeedbackController.getFeedbackAnalytics
);

router.get(
  "/:id",
  authMiddleware,
  adminMiddleware,
  validateParams(z.object({ id: z.string().uuid() })),
  FeedbackController.getFeedbackById
);

router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  validateParams(z.object({ id: z.string().uuid() })),
  FeedbackController.deleteFeedback
);

router.patch(
  "/:id/status",
  authMiddleware,
  adminMiddleware,
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(updateStatusSchema),
  FeedbackController.updateFeedbackStatus
);

export default router;
