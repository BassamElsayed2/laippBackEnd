import { Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { getPool, sql } from "../config/database";
import { AuthRequest, Product } from "../types";
import { ApiError } from "../middleware/errorHandler";
import {
  parseJSON,
  getPaginationOffset,
  getTotalPages,
} from "../utils/helpers";

/**
 * Get all products with pagination and filters
 */
export const getProducts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const categoryId = req.query.categoryId as string;
    const search = req.query.search as string;
    const isBestSeller = req.query.isBestSeller === "true";
    const limitedTimeOffer = req.query.limitedTimeOffer === "true";

    const offset = getPaginationOffset(page, limit);
    const pool = getPool();

    // Build query
    let whereConditions: string[] = [];
    const request = pool.request();

    if (categoryId) {
      whereConditions.push("category_id = @categoryId");
      request.input("categoryId", sql.Int, parseInt(categoryId));
    }

    if (search) {
      whereConditions.push(
        "(name_ar LIKE @search OR name_en LIKE @search)"
      );
      request.input("search", sql.NVarChar, `%${search}%`);
    }

    if (isBestSeller) {
      whereConditions.push("is_best_seller = 1");
    }

    if (limitedTimeOffer) {
      whereConditions.push("limited_time_offer = 1");
    }

    // Always exclude soft-deleted products
    whereConditions.push("(deleted_at IS NULL OR deleted_at = '')");

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // Get total count
    const countResult = await request.query(`
      SELECT COUNT(*) as total
      FROM products
      ${whereClause}
    `);
    const total = countResult.recordset[0].total;

    // Get products
    const request2 = pool.request();
    if (categoryId) request2.input("categoryId", sql.Int, parseInt(categoryId));
    if (search) request2.input("search", sql.NVarChar, `%${search}%`);
    // Note: isBestSeller and limitedTimeOffer are not parameterized, they're hard-coded in the WHERE clause
    // So we don't need to add them as parameters
    request2.input("offset", sql.Int, offset);
    request2.input("limit", sql.Int, limit);

    const productsResult = await request2.query<Product>(`
      SELECT *
      FROM products
      ${whereClause}
      ORDER BY created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

    // Parse images JSON
    const products = productsResult.recordset.map((product) => ({
      ...product,
      images: parseJSON(product.images as string, []),
    }));

    res.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: getTotalPages(total, limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get product by ID
 */
export const getProductById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const productResult = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id).query<Product>(`
        SELECT *
        FROM products
        WHERE id = @id AND (deleted_at IS NULL OR deleted_at = '')
      `);

    if (productResult.recordset.length === 0) {
      throw new ApiError(404, "Product not found or has been deleted");
    }

    const product = {
      ...productResult.recordset[0],
      images: parseJSON(productResult.recordset[0].images as string, []),
    };

    // Get product attributes
    const attributesResult = await pool
      .request()
      .input("product_id", sql.UniqueIdentifier, id).query(`
        SELECT attribute_name, attribute_value
        FROM product_attributes
        WHERE product_id = @product_id
      `);

    product.attributes = attributesResult.recordset;

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get best seller products
 */
export const getBestSellers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const pool = getPool();

    const productsResult = await pool.request().query<Product>(`
        SELECT *
        FROM products
        WHERE is_best_seller = 1 AND (deleted_at IS NULL OR deleted_at = '')
        ORDER BY created_at DESC
      `);

    const products = productsResult.recordset.map((product) => ({
      ...product,
      images: parseJSON(product.images as string, []),
    }));

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get limited time offer products
 */
export const getLimitedOffers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const pool = getPool();

    const productsResult = await pool.request().query<Product>(`
        SELECT *
        FROM products
        WHERE limited_time_offer = 1 AND (deleted_at IS NULL OR deleted_at = '')
        ORDER BY created_at DESC
      `);

    const products = productsResult.recordset.map((product) => ({
      ...product,
      images: parseJSON(product.images as string, []),
    }));

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create product (Admin only)
 */
export const createProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      name_ar,
      name_en,
      description_ar,
      description_en,
      price,
      offer_price,
      images,
      category_id,
      quantity,
      stock_quantity, // backwards compatibility
      is_best_seller,
      limited_time_offer,
      attributes,
    } = req.body;

    const productId = uuidv4();
    const pool = getPool();

    // Convert images to JSON string
    const imagesJson = Array.isArray(images) ? JSON.stringify(images) : images;

    // Insert product
    await pool
      .request()
      .input("id", sql.UniqueIdentifier, productId)
      .input("name_ar", sql.NVarChar, name_ar)
      .input("name_en", sql.NVarChar, name_en)
      .input("description_ar", sql.NVarChar(sql.MAX), description_ar || null)
      .input("description_en", sql.NVarChar(sql.MAX), description_en || null)
      .input("price", sql.Decimal(10, 2), price)
      .input("offer_price", sql.Decimal(10, 2), offer_price || null)
      .input("images", sql.NVarChar(sql.MAX), imagesJson || null)
      .input("category_id", sql.Int, category_id || null)
      .input("stock_quantity", sql.Int, quantity || stock_quantity || 0) // support both quantity and stock_quantity
      .input("is_best_seller", sql.Bit, is_best_seller || false)
      .input("limited_time_offer", sql.Bit, limited_time_offer || false).query(`
        INSERT INTO products (
          id, name_ar, name_en, description_ar, description_en,
          price, offer_price, images, category_id, stock_quantity,
          is_best_seller, limited_time_offer
        )
        VALUES (
          @id, @name_ar, @name_en, @description_ar, @description_en,
          @price, @offer_price, @images, @category_id, @stock_quantity,
          @is_best_seller, @limited_time_offer
        )
      `);

    // Insert attributes if provided
    if (attributes && attributes.length > 0) {
      for (const attr of attributes) {
        await pool
          .request()
          .input("product_id", sql.UniqueIdentifier, productId)
          .input("attribute_name", sql.NVarChar, attr.attribute_name)
          .input("attribute_value", sql.NVarChar, attr.attribute_value).query(`
            INSERT INTO product_attributes (product_id, attribute_name, attribute_value)
            VALUES (@product_id, @attribute_name, @attribute_value)
          `);
      }
    }

    // Get created product
    const productResult = await pool
      .request()
      .input("id", sql.UniqueIdentifier, productId).query<Product>(`
        SELECT *
        FROM products
        WHERE id = @id
      `);

    const product = {
      ...productResult.recordset[0],
      images: parseJSON(productResult.recordset[0].images as string, []),
    };

    res.status(201).json({
      success: true,
      data: product,
      message: "Product created successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product (Admin only)
 */
export const updateProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const pool = getPool();

    // Convert images to JSON string if array
    if (updateData.images && Array.isArray(updateData.images)) {
      updateData.images = JSON.stringify(updateData.images);
    }

    // Build update query dynamically
    const fields = Object.keys(updateData);
    const setClause = fields.map((field) => `${field} = @${field}`).join(", ");

    if (fields.length === 0) {
      throw new ApiError(400, "No fields to update");
    }

    const request = pool.request().input("id", sql.UniqueIdentifier, id);

    fields.forEach((field) => {
      let value = updateData[field];
      if (field === "price" || field === "offer_price") {
        request.input(field, sql.Decimal(10, 2), value);
      } else if (field === "stock_quantity" || field === "category_id") {
        request.input(field, sql.Int, value);
      } else if (field === "is_best_seller" || field === "limited_time_offer") {
        request.input(field, sql.Bit, value);
      } else {
        request.input(field, sql.NVarChar(sql.MAX), value);
      }
    });

    await request.query(`
      UPDATE products
      SET ${setClause}, updated_at = GETDATE()
      WHERE id = @id AND (deleted_at IS NULL OR deleted_at = '')
    `);

    // Get updated product
    const productResult = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id).query<Product>(`
        SELECT *
        FROM products
        WHERE id = @id AND (deleted_at IS NULL OR deleted_at = '')
      `);

    if (productResult.recordset.length === 0) {
      throw new ApiError(404, "Product not found or has been deleted");
    }

    const product = {
      ...productResult.recordset[0],
      images: parseJSON(productResult.recordset[0].images as string, []),
    };

    res.json({
      success: true,
      data: product,
      message: "Product updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product (Admin only) - Soft Delete
 */
export const deleteProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Check if product exists and is not already deleted
    const checkResult = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query("SELECT id FROM products WHERE id = @id AND (deleted_at IS NULL OR deleted_at = '')");

    if (checkResult.recordset.length === 0) {
      throw new ApiError(404, "Product not found");
    }

    // Soft delete: Set deleted_at to current timestamp instead of deleting
    const deleteResult = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query("UPDATE products SET deleted_at = GETDATE() WHERE id = @id");

    if (deleteResult.rowsAffected[0] === 0) {
      throw new ApiError(404, "Product not found");
    }

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
