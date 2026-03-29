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

function isSqlForeignKeyConflict(err: unknown): boolean {
  const e = err as {
    number?: number;
    originalError?: { number?: number };
    message?: string;
  };
  const n = e?.number ?? e?.originalError?.number;
  if (n === 547) return true;
  const msg = (e?.message || '').toLowerCase();
  return (
    msg.includes('conflicted with the reference') ||
    msg.includes('foreign key')
  );
}

const INTEGER_SQL_TYPES = new Set([
  'int',
  'bigint',
  'smallint',
  'tinyint',
]);

async function getColumnDataType(
  pool: ReturnType<typeof getPool>,
  tableName: string,
  columnName: string,
): Promise<string | null> {
  try {
    const r = await pool
      .request()
      .input('table', sql.NVarChar(128), tableName)
      .input('column', sql.NVarChar(128), columnName)
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

function getSqlErrorNumber(err: unknown): number | undefined {
  const e = err as {
    number?: number;
    originalError?: { number?: number };
  };
  return e?.number ?? e?.originalError?.number;
}

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
    const categoryId = parseInt(id, 10);
    if (Number.isNaN(categoryId) || categoryId < 1) {
      throw new ApiError(400, 'Invalid category id');
    }

    const pool = getPool();

    // Check if category exists
    const checkResult = await pool
      .request()
      .input('id', sql.Int, categoryId)
      .query('SELECT id FROM categories WHERE id = @id');

    if (checkResult.recordset.length === 0) {
      throw new ApiError(404, 'Category not found');
    }

    const productsCatType = await getColumnDataType(
      pool,
      'products',
      'category_id',
    );
    const newsCatType = await getColumnDataType(pool, 'news', 'category_id');
    const branchCatType = await getColumnDataType(
      pool,
      'branch_categories',
      'category_id',
    );

    const productsCategoryIdIsInt = isIntegerSqlDataType(productsCatType);
    const newsCategoryIdIsInt = isIntegerSqlDataType(newsCatType);
    const branchCategoryIdIsInt = isIntegerSqlDataType(branchCatType);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      if (productsCategoryIdIsInt) {
        const unlinkProducts = new sql.Request(transaction);
        await unlinkProducts
          .input('id', sql.Int, categoryId)
          .query(
            'UPDATE products SET category_id = NULL WHERE category_id = @id',
          );
      }

      if (newsCategoryIdIsInt) {
        const unlinkNews = new sql.Request(transaction);
        await unlinkNews
          .input('id', sql.Int, categoryId)
          .query(
            'UPDATE news SET category_id = NULL WHERE category_id = @id',
          );
      }

      if (branchCategoryIdIsInt) {
        const delBranch = new sql.Request(transaction);
        await delBranch
          .input('id', sql.Int, categoryId)
          .query('DELETE FROM branch_categories WHERE category_id = @id');
      }

      const delCat = new sql.Request(transaction);
      await delCat
        .input('id', sql.Int, categoryId)
        .query('DELETE FROM categories WHERE id = @id');

      await transaction.commit();
    } catch (txErr) {
      try {
        await transaction.rollback();
      } catch {
        /* noop */
      }
      if (isSqlForeignKeyConflict(txErr)) {
        throw new ApiError(
          409,
          'Cannot delete category while other records still reference it. Remove or reassign those records first.',
        );
      }
      const sqlNum = getSqlErrorNumber(txErr);
      // 245 conversion failed; 515 NULL into NOT NULL
      if (sqlNum === 245 || sqlNum === 515) {
        throw new ApiError(
          400,
          'Cannot delete category: failed to clear category links. Ensure category_id columns allow NULL where needed.',
        );
      }
      throw txErr;
    }

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};


