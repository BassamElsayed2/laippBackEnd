import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database';
import { AuthRequest } from '../types';
import { ApiError } from '../middleware/errorHandler';

/**
 * Get all addresses for current user
 */
export const getAddresses = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Not authenticated');
    }

    const pool = getPool();

    const result = await pool
      .request()
      .input('userId', req.user.id)
      .query(`
        SELECT id, user_id, street, building, floor, apartment, 
               area, city, notes, is_default, created_at, updated_at
        FROM addresses
        WHERE user_id = @userId
        ORDER BY is_default DESC, created_at DESC
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
 * Get single address by ID
 */
export const getAddress = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Not authenticated');
    }

    const { id } = req.params;
    const pool = getPool();

    const result = await pool
      .request()
      .input('id', id)
      .input('userId', req.user.id)
      .query(`
        SELECT id, user_id, street, building, floor, apartment, 
               area, city, notes, is_default, created_at, updated_at
        FROM addresses
        WHERE id = @id AND user_id = @userId
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, 'Address not found');
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
 * Create new address
 */
export const createAddress = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Not authenticated');
    }

    const { street, building, floor, apartment, area, city, notes, is_default } = req.body;
    const pool = getPool();

    // If this is set as default, unset other default addresses
    if (is_default) {
      await pool
        .request()
        .input('userId', req.user.id)
        .query(`
          UPDATE addresses
          SET is_default = 0
          WHERE user_id = @userId
        `);
    }

    // Create new address
    const addressId = uuidv4();
    await pool
      .request()
      .input('id', addressId)
      .input('user_id', req.user.id)
      .input('street', street || null)
      .input('building', building || null)
      .input('floor', floor || null)
      .input('apartment', apartment || null)
      .input('area', area || null)
      .input('city', city || null)
      .input('notes', notes || null)
      .input('is_default', is_default ? 1 : 0)
      .query(`
        INSERT INTO addresses (id, user_id, street, building, floor, apartment, area, city, notes, is_default)
        VALUES (@id, @user_id, @street, @building, @floor, @apartment, @area, @city, @notes, @is_default)
      `);

    // Get created address
    const result = await pool
      .request()
      .input('addressId', addressId)
      .query(`
        SELECT id, user_id, street, building, floor, apartment, 
               area, city, notes, is_default, created_at, updated_at
        FROM addresses
        WHERE id = @addressId
      `);

    res.status(201).json({
      success: true,
      data: result.recordset[0],
      message: 'Address created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update address
 */
export const updateAddress = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Not authenticated');
    }

    const { id } = req.params;
    const { street, building, floor, apartment, area, city, notes, is_default } = req.body;
    const pool = getPool();

    // Check if address belongs to user
    const checkResult = await pool
      .request()
      .input('id', id)
      .input('userId', req.user.id)
      .query(`
        SELECT id FROM addresses
        WHERE id = @id AND user_id = @userId
      `);

    if (checkResult.recordset.length === 0) {
      throw new ApiError(404, 'Address not found');
    }

    // If this is set as default, unset other default addresses
    if (is_default) {
      await pool
        .request()
        .input('userId', req.user.id)
        .input('addressId', id)
        .query(`
          UPDATE addresses
          SET is_default = 0
          WHERE user_id = @userId AND id != @addressId
        `);
    }

    // Update address
    await pool
      .request()
      .input('id', id)
      .input('street', street || null)
      .input('building', building || null)
      .input('floor', floor || null)
      .input('apartment', apartment || null)
      .input('area', area || null)
      .input('city', city || null)
      .input('notes', notes || null)
      .input('is_default', is_default ? 1 : 0)
      .query(`
        UPDATE addresses
        SET street = @street,
            building = @building,
            floor = @floor,
            apartment = @apartment,
            area = @area,
            city = @city,
            notes = @notes,
            is_default = @is_default,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    // Get updated address
    const result = await pool
      .request()
      .input('addressId', id)
      .query(`
        SELECT id, user_id, street, building, floor, apartment, 
               area, city, notes, is_default, created_at, updated_at
        FROM addresses
        WHERE id = @addressId
      `);

    res.json({
      success: true,
      data: result.recordset[0],
      message: 'Address updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete address
 */
export const deleteAddress = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Not authenticated');
    }

    const { id } = req.params;
    const pool = getPool();

    // Check if address belongs to user
    const checkResult = await pool
      .request()
      .input('id', id)
      .input('userId', req.user.id)
      .query(`
        SELECT id FROM addresses
        WHERE id = @id AND user_id = @userId
      `);

    if (checkResult.recordset.length === 0) {
      throw new ApiError(404, 'Address not found');
    }

    // Delete address
    await pool
      .request()
      .input('id', id)
      .query(`
        DELETE FROM addresses
        WHERE id = @id
      `);

    res.json({
      success: true,
      message: 'Address deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set address as default
 */
export const setDefaultAddress = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Not authenticated');
    }

    const { id } = req.params;
    const pool = getPool();

    // Check if address belongs to user
    const checkResult = await pool
      .request()
      .input('id', id)
      .input('userId', req.user.id)
      .query(`
        SELECT id FROM addresses
        WHERE id = @id AND user_id = @userId
      `);

    if (checkResult.recordset.length === 0) {
      throw new ApiError(404, 'Address not found');
    }

    // Unset all default addresses for this user
    await pool
      .request()
      .input('userId', req.user.id)
      .query(`
        UPDATE addresses
        SET is_default = 0
        WHERE user_id = @userId
      `);

    // Set this address as default
    await pool
      .request()
      .input('id', id)
      .query(`
        UPDATE addresses
        SET is_default = 1, updated_at = GETDATE()
        WHERE id = @id
      `);

    res.json({
      success: true,
      message: 'Default address updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

