import { pool } from "../config/database";
import { ApiError } from "../middleware/error.middleware";

export interface FeedbackFilters {
  page?: number;
  limit?: number;
  min_rating?: number;
  max_rating?: number;
  search?: string;
  branchId?: string;
  rating?: number;
  startDate?: string;
  endDate?: string;
}

export class FeedbackService {
  // Get feedback with filters
  static async getFeedback(filters: FeedbackFilters = {}) {
    const {
      page = 1,
      limit = 10,
      min_rating,
      max_rating,
      search,
      branchId,
      rating,
      startDate,
      endDate,
    } = filters;

    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = [];
    const request = pool.request();

    if (min_rating !== undefined) {
      conditions.push("cf.rating >= @minRating");
      request.input("minRating", min_rating);
    }

    if (max_rating !== undefined) {
      conditions.push("cf.rating <= @maxRating");
      request.input("maxRating", max_rating);
    }

    if (rating !== undefined) {
      conditions.push("cf.rating = @rating");
      request.input("rating", rating);
    }

    if (search) {
      conditions.push("(cf.comment LIKE @search OR p.full_name LIKE @search)");
      request.input("search", `%${search}%`);
    }

    if (branchId) {
      conditions.push("o.branch_id = @branchId");
      request.input("branchId", branchId);
    }

    if (startDate) {
      conditions.push("cf.created_at >= @startDate");
      request.input("startDate", new Date(startDate));
    }

    if (endDate) {
      conditions.push("cf.created_at <= @endDate");
      request.input("endDate", new Date(endDate));
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    request.input("offset", offset);
    request.input("limit", limit);

    // Get feedback with user details
    const feedbackResult = await request.query(`
      SELECT 
        cf.id,
        cf.order_id,
        cf.user_id,
        cf.branch_id,
        cf.rating as overall_rating,
        cf.comment,
        cf.opinion,
        cf.food_quality as quality_rating,
        cf.service_quality,
        cf.delivery_speed as service_speed_rating,
        cf.reception_rating,
        cf.cleanliness_rating,
        cf.catering_rating,
        cf.is_published,
        cf.created_at,
        -- Prioritize feedback table columns over joined tables
        COALESCE(cf.customer_name, p.full_name) as customer_name,
        COALESCE(cf.email, u.email) as email,
        COALESCE(cf.phone_number, p.phone) as phone_number,
        b.name_ar as branch_name_ar,
        b.name_en as branch_name_en,
        COALESCE(cf.branch_id, o.branch_id) as branch_id
      FROM customer_feedback cf
      LEFT JOIN users u ON cf.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN orders o ON cf.order_id = o.id
      LEFT JOIN branches b ON COALESCE(cf.branch_id, o.branch_id) = b.id
      ${whereClause}
      ORDER BY cf.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

    // Get total count
    const countRequest = pool.request();

    if (min_rating !== undefined) {
      countRequest.input("minRating", min_rating);
    }
    if (max_rating !== undefined) {
      countRequest.input("maxRating", max_rating);
    }
    if (rating !== undefined) {
      countRequest.input("rating", rating);
    }
    if (search) {
      countRequest.input("search", `%${search}%`);
    }
    if (branchId) {
      countRequest.input("branchId", branchId);
    }
    if (startDate) {
      countRequest.input("startDate", new Date(startDate));
    }
    if (endDate) {
      countRequest.input("endDate", new Date(endDate));
    }

    const countResult = await countRequest.query(`
      SELECT COUNT(*) as total 
      FROM customer_feedback cf
      LEFT JOIN users u ON cf.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN orders o ON cf.order_id = o.id
      ${whereClause}
    `);

    const total = countResult.recordset[0].total;

    return {
      feedback: feedbackResult.recordset,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Get feedback analytics
  static async getFeedbackAnalytics(filters: FeedbackFilters = {}) {
    const { branchId, startDate, endDate } = filters;

    const conditions: string[] = [];
    const request = pool.request();

    if (branchId) {
      conditions.push("o.branch_id = @branchId");
      request.input("branchId", branchId);
    }

    if (startDate) {
      conditions.push("cf.created_at >= @startDate");
      request.input("startDate", new Date(startDate));
    }

    if (endDate) {
      conditions.push("cf.created_at <= @endDate");
      request.input("endDate", new Date(endDate));
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get overall statistics
    const statsResult = await request.query(`
      SELECT 
        COUNT(*) as total_feedback,
        AVG(CAST(cf.rating AS FLOAT)) as average_rating,
        AVG(CAST(cf.food_quality AS FLOAT)) as average_food_quality,
        AVG(CAST(cf.service_quality AS FLOAT)) as average_service_quality,
        AVG(CAST(cf.delivery_speed AS FLOAT)) as average_delivery_speed,
        AVG(CAST(cf.reception_rating AS FLOAT)) as average_reception_rating,
        AVG(CAST(cf.cleanliness_rating AS FLOAT)) as average_cleanliness_rating,
        AVG(CAST(cf.catering_rating AS FLOAT)) as average_catering_rating,
        SUM(CASE WHEN cf.rating = 5 THEN 1 ELSE 0 END) as five_star_count,
        SUM(CASE WHEN cf.rating = 4 THEN 1 ELSE 0 END) as four_star_count,
        SUM(CASE WHEN cf.rating = 3 THEN 1 ELSE 0 END) as three_star_count,
        SUM(CASE WHEN cf.rating = 2 THEN 1 ELSE 0 END) as two_star_count,
        SUM(CASE WHEN cf.rating = 1 THEN 1 ELSE 0 END) as one_star_count
      FROM customer_feedback cf
      LEFT JOIN orders o ON cf.order_id = o.id
      ${whereClause}
    `);

    const stats = statsResult.recordset[0];

    // Get rating distribution
    const distributionRequest = pool.request();
    if (branchId) {
      distributionRequest.input("branchId", branchId);
    }
    if (startDate) {
      distributionRequest.input("startDate", new Date(startDate));
    }
    if (endDate) {
      distributionRequest.input("endDate", new Date(endDate));
    }

    const distributionResult = await distributionRequest.query(`
      SELECT 
        rating,
        COUNT(*) as count,
        CAST(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() AS DECIMAL(5,2)) as percentage
      FROM customer_feedback cf
      LEFT JOIN orders o ON cf.order_id = o.id
      ${whereClause}
      GROUP BY rating
      ORDER BY rating DESC
    `);

    return {
      total_feedback: stats.total_feedback || 0,
      average_rating: stats.average_rating
        ? parseFloat(stats.average_rating.toFixed(2))
        : 0,
      average_food_quality: stats.average_food_quality
        ? parseFloat(stats.average_food_quality.toFixed(2))
        : 0,
      average_service_quality: stats.average_service_quality
        ? parseFloat(stats.average_service_quality.toFixed(2))
        : 0,
      average_delivery_speed: stats.average_delivery_speed
        ? parseFloat(stats.average_delivery_speed.toFixed(2))
        : 0,
      average_reception_rating: stats.average_reception_rating
        ? parseFloat(stats.average_reception_rating.toFixed(2))
        : 0,
      average_cleanliness_rating: stats.average_cleanliness_rating
        ? parseFloat(stats.average_cleanliness_rating.toFixed(2))
        : 0,
      average_catering_rating: stats.average_catering_rating
        ? parseFloat(stats.average_catering_rating.toFixed(2))
        : 0,
      rating_distribution: {
        5: stats.five_star_count || 0,
        4: stats.four_star_count || 0,
        3: stats.three_star_count || 0,
        2: stats.two_star_count || 0,
        1: stats.one_star_count || 0,
      },
      rating_breakdown: distributionResult.recordset,
    };
  }

  // Get feedback by ID
  static async getFeedbackById(feedbackId: string) {
    const result = await pool.request().input("feedbackId", feedbackId).query(`
      SELECT 
        cf.id,
        cf.order_id,
        cf.user_id,
        cf.branch_id,
        cf.rating as overall_rating,
        cf.comment,
        cf.opinion,
        cf.food_quality as quality_rating,
        cf.service_quality,
        cf.delivery_speed as service_speed_rating,
        cf.reception_rating,
        cf.cleanliness_rating,
        cf.catering_rating,
        cf.is_published,
        cf.created_at,
        -- Prioritize feedback table columns over joined tables
        COALESCE(cf.customer_name, p.full_name) as customer_name,
        COALESCE(cf.email, u.email) as email,
        COALESCE(cf.phone_number, p.phone) as phone_number,
        b.name_ar as branch_name_ar,
        b.name_en as branch_name_en,
        COALESCE(cf.branch_id, o.branch_id) as branch_id
      FROM customer_feedback cf
      LEFT JOIN users u ON cf.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN orders o ON cf.order_id = o.id
      LEFT JOIN branches b ON COALESCE(cf.branch_id, o.branch_id) = b.id
      WHERE cf.id = @feedbackId
    `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, "Feedback not found");
    }

    return result.recordset[0];
  }

  // Delete feedback
  static async deleteFeedback(feedbackId: string) {
    const checkResult = await pool
      .request()
      .input("feedbackId", feedbackId)
      .query("SELECT id FROM customer_feedback WHERE id = @feedbackId");

    if (checkResult.recordset.length === 0) {
      throw new ApiError(404, "Feedback not found");
    }

    await pool
      .request()
      .input("feedbackId", feedbackId)
      .query("DELETE FROM customer_feedback WHERE id = @feedbackId");

    return { message: "Feedback deleted successfully" };
  }

  // Update feedback published status
  static async updateFeedbackStatus(feedbackId: string, isPublished: boolean) {
    const result = await pool
      .request()
      .input("feedbackId", feedbackId)
      .input("isPublished", isPublished).query(`
        UPDATE customer_feedback 
        SET is_published = @isPublished 
        WHERE id = @feedbackId
        SELECT * FROM customer_feedback WHERE id = @feedbackId
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, "Feedback not found");
    }

    return result.recordset[0];
  }

  // Submit customer feedback (public endpoint - no auth required)
  static async submitCustomerFeedback(feedbackData: any) {
    const {
      branch_id,
      customer_name,
      phone_number,
      email,
      overall_rating,
      reception_rating,
      service_speed_rating,
      quality_rating,
      cleanliness_rating,
      catering_rating,
      opinion,
    } = feedbackData;

    // Validate required fields
    if (!branch_id || !customer_name || !phone_number || !overall_rating) {
      throw new ApiError(400, "Missing required fields");
    }

    // Validate rating values (1-4 scale)
    if (overall_rating < 1 || overall_rating > 4) {
      throw new ApiError(400, "Rating must be between 1 and 4");
    }

    // Helper function to convert 0 to null for optional ratings
    const normalizeRating = (rating: number | undefined) => {
      return rating && rating > 0 ? rating : null;
    };

    const result = await pool
      .request()
      .input("branch_id", branch_id)
      .input("customer_name", customer_name)
      .input("phone_number", phone_number)
      .input("email", email && email.trim() ? email.trim() : null)
      .input("rating", overall_rating) // Use 'rating' column (existing in DB)
      .input("reception_rating", normalizeRating(reception_rating))
      .input("delivery_speed", normalizeRating(service_speed_rating)) // Use 'delivery_speed' column (existing in DB)
      .input("food_quality", normalizeRating(quality_rating)) // Use 'food_quality' column (existing in DB)
      .input("cleanliness_rating", normalizeRating(cleanliness_rating))
      .input("catering_rating", normalizeRating(catering_rating))
      .input("opinion", opinion && opinion.trim() ? opinion.trim() : null)
      .query(`
        INSERT INTO customer_feedback (
          branch_id,
          customer_name,
          phone_number,
          email,
          rating,
          reception_rating,
          delivery_speed,
          food_quality,
          cleanliness_rating,
          catering_rating,
          opinion,
          created_at
        )
        OUTPUT INSERTED.*
        VALUES (
          @branch_id,
          @customer_name,
          @phone_number,
          @email,
          @rating,
          @reception_rating,
          @delivery_speed,
          @food_quality,
          @cleanliness_rating,
          @catering_rating,
          @opinion,
          GETDATE()
        )
      `);

    return result.recordset[0];
  }
}
