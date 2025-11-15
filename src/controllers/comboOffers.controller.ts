import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { pool } from "../config/database";
import { asyncHandler, ApiError } from "../middleware/error.middleware";

export class ComboOffersController {
  // Get all combo offers
  static getAllComboOffers = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { is_active, search } = req.query;

      let query = `
        SELECT 
          id, title_ar, title_en, description_ar, description_en,
          image_url, price, original_price, 
          NULL as starts_at, NULL as ends_at, is_active,
          created_at, updated_at
        FROM combo_offers
        WHERE 1=1
      `;

      const request = pool.request();

      if (is_active !== undefined) {
        query += " AND is_active = @is_active";
        request.input("is_active", is_active === "true" || is_active === "1");
      } else {
        // Default to active offers only for public API
        query += " AND is_active = 1";
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

  // Get combo offer by ID
  static getComboOfferById = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { id } = req.params;

      const result = await pool
        .request()
        .input("id", id)
        .query("SELECT * FROM combo_offers WHERE id = @id");

      if (result.recordset.length === 0) {
        throw new ApiError(404, "Combo offer not found");
      }

      res.json({
        success: true,
        data: {
          offer: result.recordset[0],
        },
      });
    }
  );

  // Create combo offer
  static createComboOffer = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const {
        title_ar,
        title_en,
        description_ar,
        description_en,
        image_url,
        price,
        original_price,
        is_active = true,
      } = req.body;

      const result = await pool
        .request()
        .input("title_ar", title_ar)
        .input("title_en", title_en)
        .input("description_ar", description_ar || null)
        .input("description_en", description_en || null)
        .input("image_url", image_url || null)
        .input("price", price)
        .input("original_price", original_price || null)
        .input("is_active", is_active).query(`
          INSERT INTO combo_offers (
            title_ar, title_en, description_ar, description_en,
            image_url, price, original_price, is_active
          )
          OUTPUT INSERTED.*
          VALUES (
            @title_ar, @title_en, @description_ar, @description_en,
            @image_url, @price, @original_price, @is_active
          )
        `);

      res.status(201).json({
        success: true,
        message: "Combo offer created successfully",
        data: {
          offer: result.recordset[0],
        },
      });
    }
  );

  // Update combo offer
  static updateComboOffer = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { id } = req.params;
      const {
        title_ar,
        title_en,
        description_ar,
        description_en,
        image_url,
        price,
        original_price,
        is_active,
      } = req.body;

      // Check if combo offer exists
      const checkResult = await pool
        .request()
        .input("id", id)
        .query("SELECT id FROM combo_offers WHERE id = @id");

      if (checkResult.recordset.length === 0) {
        throw new ApiError(404, "Combo offer not found");
      }

      const result = await pool
        .request()
        .input("id", id)
        .input("title_ar", title_ar)
        .input("title_en", title_en)
        .input("description_ar", description_ar || null)
        .input("description_en", description_en || null)
        .input("image_url", image_url)
        .input("price", price)
        .input("original_price", original_price || null)
        .input("is_active", is_active !== undefined ? is_active : true).query(`
          UPDATE combo_offers
          SET 
            title_ar = @title_ar,
            title_en = @title_en,
            description_ar = @description_ar,
            description_en = @description_en,
            image_url = @image_url,
            price = @price,
            original_price = @original_price,
            is_active = @is_active,
            updated_at = GETDATE()
          OUTPUT INSERTED.*
          WHERE id = @id
        `);

      res.json({
        success: true,
        message: "Combo offer updated successfully",
        data: {
          offer: result.recordset[0],
        },
      });
    }
  );

  // Delete combo offer
  static deleteComboOffer = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { id } = req.params;

      const result = await pool
        .request()
        .input("id", id)
        .query("DELETE FROM combo_offers WHERE id = @id");

      if (result.rowsAffected[0] === 0) {
        throw new ApiError(404, "Combo offer not found");
      }

      res.json({
        success: true,
        message: "Combo offer deleted successfully",
      });
    }
  );
}
