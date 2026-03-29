import { pool, sql, getPool } from "../config/database";
import { ApiError } from "../middleware/error.middleware";

const INTEGER_SQL_TYPES = new Set([
  "int",
  "bigint",
  "smallint",
  "tinyint",
]);

async function getColumnDataType(
  tableName: string,
  columnName: string,
): Promise<string | null> {
  try {
    const r = await pool
      .request()
      .input("table", sql.NVarChar(128), tableName)
      .input("column", sql.NVarChar(128), columnName)
      .query(
        `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = @table AND COLUMN_NAME = @column`,
      );
    const t = r.recordset[0]?.DATA_TYPE as string | undefined;
    return t ? String(t).toLowerCase() : null;
  } catch {
    return null;
  }
}

function isIntegerSqlDataType(dataType: string | null): boolean {
  return dataType != null && INTEGER_SQL_TYPES.has(dataType);
}

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

  // Delete category (admin only): clears product/news links, branch rows, then deletes row
  static async deleteCategory(id: string) {
    const categoryId = parseInt(id, 10);
    if (Number.isNaN(categoryId) || categoryId < 1) {
      throw new ApiError(400, "Invalid category id");
    }

    const existsCheck = await pool
      .request()
      .input("id", sql.Int, categoryId)
      .query("SELECT id FROM categories WHERE id = @id");

    if (existsCheck.recordset.length === 0) {
      throw new ApiError(404, "Category not found");
    }

    const productsCatType = await getColumnDataType(
      "products",
      "category_id",
    );
    const newsCatType = await getColumnDataType("news", "category_id");
    const branchCatType = await getColumnDataType(
      "branch_categories",
      "category_id",
    );

    const productsCategoryIdIsInt = isIntegerSqlDataType(productsCatType);
    const newsCategoryIdIsInt = isIntegerSqlDataType(newsCatType);
    const branchCategoryIdIsInt = isIntegerSqlDataType(branchCatType);

    const connection = getPool();
    const transaction = new sql.Transaction(connection);
    await transaction.begin();
    try {
      if (productsCategoryIdIsInt) {
        const unlinkProducts = new sql.Request(transaction);
        await unlinkProducts
          .input("id", sql.Int, categoryId)
          .query(
            "UPDATE products SET category_id = NULL WHERE category_id = @id"
          );
      }

      if (newsCategoryIdIsInt) {
        const unlinkNews = new sql.Request(transaction);
        await unlinkNews
          .input("id", sql.Int, categoryId)
          .query(
            "UPDATE news SET category_id = NULL WHERE category_id = @id"
          );
      }

      if (branchCategoryIdIsInt) {
        const delBranch = new sql.Request(transaction);
        await delBranch
          .input("id", sql.Int, categoryId)
          .query("DELETE FROM branch_categories WHERE category_id = @id");
      }

      const delCat = new sql.Request(transaction);
      const delResult = await delCat
        .input("id", sql.Int, categoryId)
        .query("DELETE FROM categories WHERE id = @id");

      if (delResult.rowsAffected[0] === 0) {
        throw new ApiError(404, "Category not found");
      }

      await transaction.commit();
    } catch (e) {
      try {
        await transaction.rollback();
      } catch {
        /* transaction may already be finished */
      }
      throw e;
    }

    return { success: true };
  }
}
