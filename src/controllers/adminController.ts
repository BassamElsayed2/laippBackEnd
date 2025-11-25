import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import sql from 'mssql';
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

    // Filter by status - if no status selected, exclude pending orders
    if (status) {
      query += ` AND o.status = @param${paramIndex}`;
      params.push({ name: `param${paramIndex}`, type: 'NVarChar', value: status });
      paramIndex++;
    } else {
      // Exclude pending orders when no specific status is selected
      query += ` AND o.status != 'pending'`;
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
        .input('order_id', sql.UniqueIdentifier, order.id)
        .query(`
          SELECT oi.*, 
                 p.name_ar, 
                 p.name_en, 
                 p.price, 
                 p.images as image_url,
                 p.offer_price
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = @order_id
        `);
      
      // Transform order items to match expected format
      order.order_items = itemsResult.recordset.map((item: any) => ({
        ...item,
        products: item.name_ar || item.name_en ? {
          name_ar: item.name_ar,
          name_en: item.name_en,
          price: item.price,
          offer_price: item.offer_price,
          image_url: item.image_url ? (typeof item.image_url === 'string' ? JSON.parse(item.image_url) : item.image_url) : [],
        } : null,
      }));

      // Get payments
      const paymentsResult = await pool
        .request()
        .input('order_id', sql.UniqueIdentifier, order.id)
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
        COUNT(CASE WHEN status != 'pending' THEN 1 END) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
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
/**
 * Get all users (Admin only)
 */
export const getAllUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = '1',
      limit = '10',
      role,
      search,
      date,
    } = req.query;

    const pool = getPool();
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build query based on role (admin uses admin_profiles, user uses profiles)
    let query = `
      SELECT 
        u.id,
        u.email,
        u.name,
        u.role,
        u.email_verified,
        u.created_at,
        u.updated_at
    `;

    // If filtering by admin, join with admin_profiles
    // If filtering by user, join with profiles
    // If no filter, get both with UNION
    let fromClause = '';
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (role === 'admin') {
      query += `,
        ap.full_name,
        ap.phone,
        ap.avatar_url`;
      fromClause = `
        FROM users u
        LEFT JOIN admin_profiles ap ON u.id = ap.user_id
      `;
      whereClause += ` AND u.role = 'admin'`;
    } else if (role === 'user') {
      query += `,
        p.full_name,
        p.phone,
        p.avatar_url`;
      fromClause = `
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
      `;
      whereClause += ` AND u.role = 'user'`;
    } else {
      // Get all users - use COALESCE to get profile data from either table
      query += `,
        COALESCE(ap.full_name, p.full_name) as full_name,
        COALESCE(ap.phone, p.phone) as phone,
        COALESCE(ap.avatar_url, p.avatar_url) as avatar_url`;
      fromClause = `
        FROM users u
        LEFT JOIN admin_profiles ap ON u.id = ap.user_id AND u.role = 'admin'
        LEFT JOIN profiles p ON u.id = p.user_id AND u.role = 'user'
      `;
    }

    // Filter by search
    if (search) {
      const searchValue = `%${search}%`;
      if (role === 'admin') {
        whereClause += ` AND (
          u.email LIKE @param${paramIndex} 
          OR u.name LIKE @param${paramIndex}
          OR ap.full_name LIKE @param${paramIndex}
          OR ap.phone LIKE @param${paramIndex}
        )`;
      } else if (role === 'user') {
        whereClause += ` AND (
          u.email LIKE @param${paramIndex} 
          OR u.name LIKE @param${paramIndex}
          OR p.full_name LIKE @param${paramIndex}
          OR p.phone LIKE @param${paramIndex}
        )`;
      } else {
        whereClause += ` AND (
          u.email LIKE @param${paramIndex} 
          OR u.name LIKE @param${paramIndex}
          OR COALESCE(ap.full_name, p.full_name, '') LIKE @param${paramIndex}
          OR COALESCE(ap.phone, p.phone, '') LIKE @param${paramIndex}
        )`;
      }
      params.push({ name: `param${paramIndex}`, type: 'NVarChar', value: searchValue });
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

      whereClause += ` AND u.created_at >= @param${paramIndex}`;
      params.push({ name: `param${paramIndex}`, type: 'DateTime2', value: startDate });
      paramIndex++;
    }

    // Build complete query
    const fullQuery = `
      ${query}
      ${fromClause}
      ${whereClause}
      ORDER BY u.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      ${fromClause}
      ${whereClause}
    `;

    // Execute queries
    const request = pool.request();
    params.forEach((param) => {
      request.input(param.name, sql[param.type as keyof typeof sql], param.value);
    });
    request.input('offset', sql.Int, offset);
    request.input('limit', sql.Int, limitNum);

    const countRequest = pool.request();
    params.forEach((param) => {
      countRequest.input(param.name, sql[param.type as keyof typeof sql], param.value);
    });

    const [usersResult, countResult] = await Promise.all([
      request.query(fullQuery),
      countRequest.query(countQuery),
    ]);

    const users = usersResult.recordset;
    const total = countResult.recordset[0].total;

    res.json({
      success: true,
      data: {
        users,
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
 * Get user stats (Admin only)
 */
export const getUserStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as users
      FROM users
    `);

    const stats = result.recordset[0];

    res.json({
      success: true,
      data: {
        total: stats.total || 0,
        admins: stats.admins || 0,
        users: stats.users || 0,
        active: 0, // TODO: Implement active user tracking
        inactive: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID (Admin only)
 */
export const getUserById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // First, get user role to determine which profile table to use
    const userResult = await pool
      .request()
      .input('userId', sql.UniqueIdentifier, id)
      .query('SELECT role FROM users WHERE id = @userId');

    if (userResult.recordset.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const userRole = userResult.recordset[0].role;
    const profileTable = userRole === 'admin' ? 'admin_profiles' : 'profiles';
    const profileColumns =
      userRole === 'admin'
        ? 'p.full_name, p.phone, p.avatar_url, p.job_title, p.address, p.about'
        : 'p.full_name, p.phone, p.avatar_url';

    const result = await pool
      .request()
      .input('userId', sql.UniqueIdentifier, id)
      .query(`
        SELECT 
          u.id,
          u.email,
          u.name,
          u.role,
          u.email_verified,
          u.created_at,
          u.updated_at,
          ${profileColumns}
        FROM users u
        LEFT JOIN ${profileTable} p ON u.id = p.user_id
        WHERE u.id = @userId
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, 'User not found');
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
 * Delete user (Admin only)
 */
export const deleteUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Check if user exists
    const userResult = await pool
      .request()
      .input('userId', sql.UniqueIdentifier, id)
      .query('SELECT id FROM users WHERE id = @userId');

    if (userResult.recordset.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    // Delete user (cascade will delete related records)
    await pool
      .request()
      .input('userId', sql.UniqueIdentifier, id)
      .query('DELETE FROM users WHERE id = @userId');

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

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

