import { pool } from "../config/database";
import { ApiError } from "../middleware/error.middleware";

export interface CategoryFilters {
  search?: string;
  is_active?: boolean;
}

export class CategoriesService {
  // Get all categories with optional filters
  static async getCategories(filters: CategoryFilters = {}) {
    let whereConditions: string[] = [];
    const request = pool.request();

    // Apply filters
    if (filters.search) {
      whereConditions.push("(name_ar LIKE @search OR name_en LIKE @search)");
      request.input("search", `%${filters.search}%`);
    }

    if (filters.is_active !== undefined) {
      whereConditions.push("is_active = @isActive");
      request.input("isActive", filters.is_active);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const result = await request.query(`
      SELECT 
        id, name_ar, name_en,
        description_ar, description_en,
        image_url, display_order, is_active,
        created_at, updated_at
      FROM categories
      ${whereClause}
      ORDER BY display_order ASC, name_en ASC
    `);

    return result.recordset;
  }

  // Get category by ID
  static async getCategoryById(id: string) {
    const result = await pool.request().input("id", id).query(`
      SELECT 
        id, name_ar, name_en,
        description_ar, description_en,
        image_url, display_order, is_active,
        created_at, updated_at
      FROM categories
      WHERE id = @id
    `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, "Category not found");
    }

    return result.recordset[0];
  }

  // Create category (admin only)
  static async createCategory(data: any) {
    const {
      name_ar,
      name_en,
      description_ar,
      description_en,
      image_url,
      display_order,
      is_active,
    } = data;

    const result = await pool
      .request()
      .input("nameAr", name_ar)
      .input("nameEn", name_en)
      .input("descriptionAr", description_ar || null)
      .input("descriptionEn", description_en || null)
      .input("imageUrl", image_url || null)
      .input("displayOrder", display_order || 0)
      .input("isActive", is_active !== undefined ? is_active : true).query(`
        INSERT INTO categories 
        (name_ar, name_en, description_ar, description_en, image_url, display_order, is_active)
        OUTPUT INSERTED.*
        VALUES (@nameAr, @nameEn, @descriptionAr, @descriptionEn, @imageUrl, @displayOrder, @isActive)
      `);

    return result.recordset[0];
  }

  // Update category (admin only)
  static async updateCategory(id: string, data: any) {
    const {
      name_ar,
      name_en,
      description_ar,
      description_en,
      image_url,
      display_order,
      is_active,
    } = data;

    // Check if category exists
    const existsCheck = await pool
      .request()
      .input("id", id)
      .query("SELECT id FROM categories WHERE id = @id");

    if (existsCheck.recordset.length === 0) {
      throw new ApiError(404, "Category not found");
    }

    // Build dynamic update query
    const updates: string[] = [];
    const request = pool.request().input("id", id);

    if (name_ar !== undefined) {
      updates.push("name_ar = @nameAr");
      request.input("nameAr", name_ar);
    }
    if (name_en !== undefined) {
      updates.push("name_en = @nameEn");
      request.input("nameEn", name_en);
    }
    if (description_ar !== undefined) {
      updates.push("description_ar = @descriptionAr");
      request.input("descriptionAr", description_ar);
    }
    if (description_en !== undefined) {
      updates.push("description_en = @descriptionEn");
      request.input("descriptionEn", description_en);
    }
    if (image_url !== undefined) {
      updates.push("image_url = @imageUrl");
      request.input("imageUrl", image_url);
    }
    if (display_order !== undefined) {
      updates.push("display_order = @displayOrder");
      request.input("displayOrder", display_order);
    }
    if (is_active !== undefined) {
      updates.push("is_active = @isActive");
      request.input("isActive", is_active);
    }

    if (updates.length === 0) {
      return await this.getCategoryById(id);
    }

    updates.push("updated_at = GETDATE()");

    await request.query(`
      UPDATE categories
      SET ${updates.join(", ")}
      WHERE id = @id
    `);

    return await this.getCategoryById(id);
  }

  // Delete category (admin only)
  static async deleteCategory(id: string) {
    // Check if category has products
    const productsCheck = await pool
      .request()
      .input("id", id)
      .query("SELECT COUNT(*) as count FROM products WHERE category_id = @id");

    const productCount = productsCheck.recordset[0].count;

    if (productCount > 0) {
      throw new ApiError(
        400,
        `Cannot delete category. It has ${productCount} product(s) associated with it.`
      );
    }

    const result = await pool
      .request()
      .input("id", id)
      .query("DELETE FROM categories WHERE id = @id");

    if (result.rowsAffected[0] === 0) {
      throw new ApiError(404, "Category not found");
    }

    return { success: true };
  }
}
