import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { pool } from "../config/database";
import { asyncHandler, ApiError } from "../middleware/error.middleware";

export class OffersController {
  // Get all offers
  static getAllOffers = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { is_active, search } = req.query;

      let query = `
        SELECT 
          id, title_ar, title_en, description_ar, description_en,
          image_url, discount_type, discount_value,
          start_date, end_date, is_active,
          created_at, updated_at
        FROM offers
        WHERE 1=1
      `;

      const request = pool.request();

      if (is_active !== undefined) {
        query += " AND is_active = @is_active";
        request.input("is_active", is_active === "true" || is_active === "1");
      }

      if (search) {
        query += " AND (title_ar LIKE @search OR title_en LIKE @search)";
        request.input("search", `%${search}%`);
      }

      query += " ORDER BY created_at DESC";

      const result = await request.query(query);

      res.json({
        success: true,
        data: {
          offers: result.recordset,
        },
      });
    }
  );

  // Get offer by ID
  static getOfferById = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { id } = req.params;

      const result = await pool
        .request()
        .input("id", id)
        .query("SELECT * FROM offers WHERE id = @id");

      if (result.recordset.length === 0) {
        throw new ApiError(404, "Offer not found");
      }

      res.json({
        success: true,
        data: {
          offer: result.recordset[0],
        },
      });
    }
  );

  // Create offer
  static createOffer = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const {
        title_ar,
        title_en,
        description_ar,
        description_en,
        image_url,
        discount_type,
        discount_value,
        start_date,
        end_date,
        is_active = true,
      } = req.body;

      const result = await pool
        .request()
        .input("title_ar", title_ar)
        .input("title_en", title_en)
        .input("description_ar", description_ar || null)
        .input("description_en", description_en || null)
        .input("image_url", image_url || null)
        .input("discount_type", discount_type || null)
        .input("discount_value", discount_value || null)
        .input("start_date", start_date || null)
        .input("end_date", end_date || null)
        .input("is_active", is_active).query(`
          INSERT INTO offers (
            title_ar, title_en, description_ar, description_en,
            image_url, discount_type, discount_value,
            start_date, end_date, is_active
          )
          OUTPUT INSERTED.*
          VALUES (
            @title_ar, @title_en, @description_ar, @description_en,
            @image_url, @discount_type, @discount_value,
            @start_date, @end_date, @is_active
          )
        `);

      res.status(201).json({
        success: true,
        message: "Offer created successfully",
        data: {
          offer: result.recordset[0],
        },
      });
    }
  );

  // Update offer
  static updateOffer = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { id } = req.params;
      const {
        title_ar,
        title_en,
        description_ar,
        description_en,
        image_url,
        discount_type,
        discount_value,
        start_date,
        end_date,
        is_active,
      } = req.body;

      // Check if offer exists
      const checkResult = await pool
        .request()
        .input("id", id)
        .query("SELECT id FROM offers WHERE id = @id");

      if (checkResult.recordset.length === 0) {
        throw new ApiError(404, "Offer not found");
      }

      const updates: string[] = [];
      const request = pool.request().input("id", id);

      if (title_ar !== undefined) {
        updates.push("title_ar = @title_ar");
        request.input("title_ar", title_ar);
      }
      if (title_en !== undefined) {
        updates.push("title_en = @title_en");
        request.input("title_en", title_en);
      }
      if (description_ar !== undefined) {
        updates.push("description_ar = @description_ar");
        request.input("description_ar", description_ar);
      }
      if (description_en !== undefined) {
        updates.push("description_en = @description_en");
        request.input("description_en", description_en);
      }
      if (image_url !== undefined) {
        updates.push("image_url = @image_url");
        request.input("image_url", image_url);
      }
      if (discount_type !== undefined) {
        updates.push("discount_type = @discount_type");
        request.input("discount_type", discount_type);
      }
      if (discount_value !== undefined) {
        updates.push("discount_value = @discount_value");
        request.input("discount_value", discount_value);
      }
      if (start_date !== undefined) {
        updates.push("start_date = @start_date");
        request.input("start_date", start_date);
      }
      if (end_date !== undefined) {
        updates.push("end_date = @end_date");
        request.input("end_date", end_date);
      }
      if (is_active !== undefined) {
        updates.push("is_active = @is_active");
        request.input("is_active", is_active);
      }

      if (updates.length === 0) {
        throw new ApiError(400, "No fields to update");
      }

      updates.push("updated_at = GETDATE()");

      const result = await request.query(`
        UPDATE offers
        SET ${updates.join(", ")}
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

      res.json({
        success: true,
        message: "Offer updated successfully",
        data: {
          offer: result.recordset[0],
        },
      });
    }
  );

  // Delete offer
  static deleteOffer = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { id } = req.params;

      const result = await pool
        .request()
        .input("id", id)
        .query("DELETE FROM offers WHERE id = @id");

      if (result.rowsAffected[0] === 0) {
        throw new ApiError(404, "Offer not found");
      }

      res.json({
        success: true,
        message: "Offer deleted successfully",
      });
    }
  );
}
