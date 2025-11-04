import { Response, NextFunction } from 'express';
import { getPool, sql } from '../config/database';
import { AuthRequest, Category } from '../types';
import { ApiError } from '../middleware/errorHandler';

/**
 * Get all categories
 */
export const getCategories = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const pool = getPool();

    const result = await pool.request().query<Category>(`
      SELECT *
      FROM categories
      ORDER BY id ASC
    `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get category by ID
 */
export const getCategoryById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query<Category>(`
        SELECT *
        FROM categories
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, 'Category not found');
    }

    res.json({
      success: true,
      data: result.recordset[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create category (Admin only)
 */
export const createCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name_ar, name_en, image_url } = req.body;
    const pool = getPool();

    const result = await pool
      .request()
      .input('name_ar', sql.NVarChar, name_ar)
      .input('name_en', sql.NVarChar, name_en)
      .input('image_url', sql.NVarChar(sql.MAX), image_url || null)
      .query<Category>(`
        INSERT INTO categories (name_ar, name_en, image_url)
        OUTPUT INSERTED.*
        VALUES (@name_ar, @name_en, @image_url)
      `);

    res.status(201).json({
      success: true,
      data: result.recordset[0],
      message: 'Category created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update category (Admin only)
 */
export const updateCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name_ar, name_en, image_url } = req.body;
    const pool = getPool();

    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .input('name_ar', sql.NVarChar, name_ar)
      .input('name_en', sql.NVarChar, name_en)
      .input('image_url', sql.NVarChar(sql.MAX), image_url || null)
      .query<Category>(`
        UPDATE categories
        SET name_ar = @name_ar,
            name_en = @name_en,
            image_url = @image_url
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, 'Category not found');
    }

    res.json({
      success: true,
      data: result.recordset[0],
      message: 'Category updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete category (Admin only)
 */
export const deleteCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Check if category exists
    const checkResult = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query('SELECT id FROM categories WHERE id = @id');

    if (checkResult.recordset.length === 0) {
      throw new ApiError(404, 'Category not found');
    }

    // Delete category
    await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query('DELETE FROM categories WHERE id = @id');

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};


