import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { logger } from "../utils/logger";
import sql from "mssql";

export const branchesController = {
  // Get all branches
  getAllBranches: async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { is_active, search } = req.query;

      let query = `
        SELECT 
          id, name_ar, name_en, address_ar, address_en,
          phone,  lat, lng, image_url, is_active,
          created_at, updated_at
        FROM branches
        WHERE 1=1
      `;

      const request = pool.request();

      if (is_active !== undefined) {
        query += " AND is_active = @isActive";
        request.input("isActive", sql.Bit, is_active === "true" ? 1 : 0);
      }

      if (search) {
        query += ` AND (
          name_ar LIKE @search OR 
          name_en LIKE @search OR 
          address_ar LIKE @search OR 
          address_en LIKE @search
        )`;
        request.input("search", sql.NVarChar, `%${search}%`);
      }

      query += " ORDER BY created_at DESC";

      const result = await request.query(query);

      res.json({
        success: true,
        branches: result.recordset,
      });
    } catch (error) {
      logger.error("Error fetching branches:", error);
      next(error);
    }
  },

  // Get branch by ID
  getBranchById: async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const result = await pool.request().input("id", sql.UniqueIdentifier, id)
        .query(`
          SELECT 
            id, name_ar, name_en, address_ar, address_en,
            phone,  lat, lng, image_url, is_active,
            created_at, updated_at
          FROM branches
          WHERE id = @id
        `);

      if (result.recordset.length === 0) {
        res.status(404).json({
          success: false,
          message: "Branch not found",
        });
        return;
      }

      res.json({
        success: true,
        branch: result.recordset[0],
      });
    } catch (error) {
      logger.error("Error fetching branch:", error);
      next(error);
    }
  },

  // Create new branch
  createBranch: async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        name_ar,
        name_en,
        address_ar,
        address_en,
        phone,

        lat,
        lng,
        image_url,
        is_active = true,
      } = req.body;

      const result = await pool
        .request()
        .input("name_ar", sql.NVarChar, name_ar)
        .input("name_en", sql.NVarChar, name_en)
        .input("address_ar", sql.NVarChar, address_ar)
        .input("address_en", sql.NVarChar, address_en)
        .input("phone", sql.NVarChar, phone || null)

        .input("lat", sql.Decimal(10, 8), lat || 0)
        .input("lng", sql.Decimal(11, 8), lng || 0)
        .input("image_url", sql.NVarChar, image_url || null)
        .input("is_active", sql.Bit, is_active ? 1 : 0).query(`
          INSERT INTO branches (
            name_ar, name_en, address_ar, address_en,
            phone,  lat, lng, image_url, is_active
          )
          OUTPUT INSERTED.*
          VALUES (
            @name_ar, @name_en, @address_ar, @address_en,
            @phone,  @lat, @lng, @image_url, @is_active
          )
        `);

      logger.info(`Branch created: ${result.recordset[0].id}`);

      res.status(201).json({
        success: true,
        message: "Branch created successfully",
        branch: result.recordset[0],
      });
    } catch (error) {
      logger.error("Error creating branch:", error);
      next(error);
    }
  },

  // Update branch
  updateBranch: async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        name_ar,
        name_en,
        address_ar,
        address_en,
        phone,

        lat,
        lng,
        image_url,
        is_active,
      } = req.body;

      const request = pool.request().input("id", sql.UniqueIdentifier, id);

      const updates: string[] = [];

      if (name_ar !== undefined) {
        updates.push("name_ar = @name_ar");
        request.input("name_ar", sql.NVarChar, name_ar);
      }
      if (name_en !== undefined) {
        updates.push("name_en = @name_en");
        request.input("name_en", sql.NVarChar, name_en);
      }
      if (address_ar !== undefined) {
        updates.push("address_ar = @address_ar");
        request.input("address_ar", sql.NVarChar, address_ar);
      }
      if (address_en !== undefined) {
        updates.push("address_en = @address_en");
        request.input("address_en", sql.NVarChar, address_en);
      }
      if (phone !== undefined) {
        updates.push("phone = @phone");
        request.input("phone", sql.NVarChar, phone);
      }

      if (lat !== undefined) {
        updates.push("lat = @lat");
        request.input("lat", sql.Decimal(10, 8), lat);
      }
      if (lng !== undefined) {
        updates.push("lng = @lng");
        request.input("lng", sql.Decimal(11, 8), lng);
      }
      if (image_url !== undefined) {
        updates.push("image_url = @image_url");
        request.input("image_url", sql.NVarChar, image_url);
      }
      if (is_active !== undefined) {
        updates.push("is_active = @is_active");
        request.input("is_active", sql.Bit, is_active ? 1 : 0);
      }

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          message: "No fields to update",
        });
        return;
      }

      updates.push("updated_at = GETUTCDATE()");

      const result = await request.query(`
        UPDATE branches
        SET ${updates.join(", ")}
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

      if (result.recordset.length === 0) {
        res.status(404).json({
          success: false,
          message: "Branch not found",
        });
        return;
      }

      logger.info(`Branch updated: ${id}`);

      res.json({
        success: true,
        message: "Branch updated successfully",
        branch: result.recordset[0],
      });
    } catch (error) {
      logger.error("Error updating branch:", error);
      next(error);
    }
  },

  // Delete branch
  deleteBranch: async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const result = await pool.request().input("id", sql.UniqueIdentifier, id)
        .query(`
          DELETE FROM branches
          OUTPUT DELETED.id
          WHERE id = @id
        `);

      if (result.recordset.length === 0) {
        res.status(404).json({
          success: false,
          message: "Branch not found",
        });
        return;
      }

      logger.info(`Branch deleted: ${id}`);

      res.json({
        success: true,
        message: "Branch deleted successfully",
      });
    } catch (error) {
      logger.error("Error deleting branch:", error);
      next(error);
    }
  },
};
