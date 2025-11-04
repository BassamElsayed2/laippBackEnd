import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database';
import { AuthRequest } from '../types';
import { ApiError } from '../middleware/errorHandler';

/**
 * Get all orders (Admin only)
 */
export const getAllOrders = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = '1',
      limit = '10',
      status,
      search,
      date,
    } = req.query;

    const pool = getPool();
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT 
        o.*,
        u.email as user_email,
        u.name as user_name,
        p.full_name,
        p.phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN profiles p ON o.user_id = p.user_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Filter by status
    if (status) {
      query += ` AND o.status = @param${paramIndex}`;
      params.push({ name: `param${paramIndex}`, type: 'NVarChar', value: status });
      paramIndex++;
    }

    // Filter by date
    if (date) {
      const now = new Date();
      let startDate = new Date();

      switch (date) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      query += ` AND o.created_at >= @param${paramIndex}`;
      params.push({ name: `param${paramIndex}`, type: 'DateTime2', value: startDate });
      paramIndex++;
    }

    // Search filter (email, phone, name, order id)
    if (search) {
      query += ` AND (
        o.id LIKE @param${paramIndex}
        OR u.email LIKE @param${paramIndex}
        OR p.full_name LIKE @param${paramIndex}
        OR p.phone LIKE @param${paramIndex}
        OR o.customer_first_name LIKE @param${paramIndex}
        OR o.customer_last_name LIKE @param${paramIndex}
        OR o.customer_phone LIKE @param${paramIndex}
        OR o.customer_email LIKE @param${paramIndex}
      )`;
      params.push({ name: `param${paramIndex}`, type: 'NVarChar', value: `%${search}%` });
      paramIndex++;
    }

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
    const countRequest = pool.request();
    params.forEach(p => countRequest.input(p.name, p.value));
    const countResult = await countRequest.query(countQuery);
    const total = countResult.recordset[0].total;

    // Add pagination and ordering
    query += ` ORDER BY o.created_at DESC`;
    query += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

    // Execute main query
    const request = pool.request();
    params.forEach(p => request.input(p.name, p.value));
    request.input('offset', offset);
    request.input('limit', limitNum);

    const result = await request.query(query);
    const orders = result.recordset;

    // Get order items and payments for each order
    for (const order of orders) {
      // Get order items
      const itemsResult = await pool
        .request()
        .input('order_id', order.id)
        .query(`
          SELECT oi.*, p.title, p.name_ar, p.name_en, p.price, p.images
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = @order_id
        `);
      order.order_items = itemsResult.recordset;

      // Get payments
      const paymentsResult = await pool
        .request()
        .input('order_id', order.id)
        .query(`
          SELECT * FROM payments WHERE order_id = @order_id
        `);
      order.payments = paymentsResult.recordset;
    }

    res.json({
      success: true,
      data: {
        orders,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get order statistics (Admin only)
 */
export const getOrderStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const pool = getPool();

    const result = await pool.request().query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM orders
    `);

    res.json({
      success: true,
      data: result.recordset[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new admin user (Admin only)
 */
export const createAdminUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      email,
      password,
      name,
      phone,
      image_url,
      job_title,
      address,
      about,
    } = req.body;

    if (!email || !password) {
      throw new ApiError(400, 'Email and password are required');
    }

    const pool = getPool();

    // Check if email already exists
    const existingUser = await pool
      .request()
      .input('email', email)
      .query('SELECT id FROM users WHERE email = @email');

    if (existingUser.recordset.length > 0) {
      throw new ApiError(400, 'Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate IDs
    const userId = uuidv4();
    const accountId = uuidv4();
    const profileId = uuidv4();

    // Create user
    await pool
      .request()
      .input('id', userId)
      .input('email', email)
      .input('name', name || email.split('@')[0])
      .query(`
        INSERT INTO users (id, email, name, role, email_verified, created_at, updated_at)
        VALUES (@id, @email, @name, 'admin', 1, GETDATE(), GETDATE())
      `);

    // Create account
    await pool
      .request()
      .input('id', accountId)
      .input('user_id', userId)
      .input('password_hash', passwordHash)
      .query(`
        INSERT INTO accounts (id, user_id, account_type, password_hash, created_at)
        VALUES (@id, @user_id, 'email', @password_hash, GETDATE())
      `);

    // Create admin profile
    await pool
      .request()
      .input('id', profileId)
      .input('user_id', userId)
      .input('full_name', name || null)
      .input('phone', phone || null)
      .query(`
        INSERT INTO admin_profiles (id, user_id, full_name, phone, created_at, updated_at)
        VALUES (@id, @user_id, @full_name, @phone, GETDATE(), GETDATE())
      `);

    // Get created user
    const userResult = await pool
      .request()
      .input('userId', userId)
      .query(`
        SELECT u.id, u.email, u.name, u.role, u.email_verified, u.created_at, u.updated_at,
               p.full_name, p.phone
        FROM users u
        LEFT JOIN admin_profiles p ON u.id = p.user_id
        WHERE u.id = @userId
      `);

    res.status(201).json({
      success: true,
      data: userResult.recordset[0],
      message: 'Admin user created successfully',
    });
  } catch (error) {
    next(error);
  }
};

