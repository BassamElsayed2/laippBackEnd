import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { FeedbackService } from "../services/feedback.service";
import { asyncHandler } from "../middleware/error.middleware";

export class FeedbackController {
  // Get all feedback with filters
  static getFeedback = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const {
        page,
        limit,
        min_rating,
        max_rating,
        search,
        branchId,
        rating,
        startDate,
        endDate,
      } = req.query as any;

      const filters = {
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        min_rating: min_rating ? parseInt(min_rating) : undefined,
        max_rating: max_rating ? parseInt(max_rating) : undefined,
        rating: rating ? parseInt(rating) : undefined,
        search,
        branchId,
        startDate,
        endDate,
      };

      const result = await FeedbackService.getFeedback(filters);

      res.json({
        success: true,
        data: result,
      });
    }
  );

  // Get feedback analytics
  static getFeedbackAnalytics = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { branchId, startDate, endDate } = req.query as any;

      const filters = {
        branchId,
        startDate,
        endDate,
      };

      const analytics = await FeedbackService.getFeedbackAnalytics(filters);

      res.json({
        success: true,
        data: analytics,
      });
    }
  );

  // Get feedback by ID
  static getFeedbackById = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { id } = req.params;

      const feedback = await FeedbackService.getFeedbackById(id);

      res.json({
        success: true,
        data: { feedback },
      });
    }
  );

  // Delete feedback
  static deleteFeedback = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { id } = req.params;

      const result = await FeedbackService.deleteFeedback(id);

      res.json({
        success: true,
        message: result.message,
      });
    }
  );

  // Update feedback published status
  static updateFeedbackStatus = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { id } = req.params;
      const { is_published } = req.body;

      const feedback = await FeedbackService.updateFeedbackStatus(
        id,
        is_published
      );

      res.json({
        success: true,
        message: "Feedback status updated successfully",
        data: { feedback },
      });
    }
  );

  // Submit feedback from customer (public endpoint - no auth required)
  static submitFeedback = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const feedbackData = req.body;

      const feedback = await FeedbackService.submitCustomerFeedback(
        feedbackData
      );

      res.status(201).json({
        success: true,
        message: "تم إرسال تقييمك بنجاح، شكراً لك!",
        data: { feedback },
      });
    }
  );
}
