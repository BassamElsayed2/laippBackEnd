import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../config/database';
import { AuthRequest, Order, OrderItem } from '../types';
import { ApiError } from '../middleware/errorHandler';
import { parseJSON, getPaginationOffset, getTotalPages } from '../utils/helpers';

/**
 * Create a new order
 */
export const createOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      user_id,
      total_price,
      items,
      payment_method,
      notes,
      customer_first_name,
      customer_last_name,
      customer_phone,
      customer_email,
      customer_street_address,
      customer_city,
      customer_state,
      customer_postcode,
    } = req.body;

    const orderId = uuidv4();
    const pool = getPool();

    // Begin transaction
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      // Insert order
      await transaction
        .request()
        .input('id', sql.UniqueIdentifier, orderId)
        .input('user_id', sql.UniqueIdentifier, user_id || null)
        .input('total_price', sql.Decimal(10, 2), total_price)
        .input('customer_first_name', sql.NVarChar, customer_first_name)
        .input('customer_last_name', sql.NVarChar, customer_last_name)
        .input('customer_phone', sql.NVarChar, customer_phone)
        .input('customer_email', sql.NVarChar, customer_email || null)
        .input('customer_street_address', sql.NVarChar, customer_street_address)
        .input('customer_city', sql.NVarChar, customer_city)
        .input('customer_state', sql.NVarChar, customer_state || null)
        .input('customer_postcode', sql.NVarChar, customer_postcode || null)
        .input('order_notes', sql.NVarChar(sql.MAX), notes || null)
        .query(`
          INSERT INTO orders (
            id, user_id, total_price, status,
            customer_first_name, customer_last_name, customer_phone, customer_email,
            customer_street_address, customer_city, customer_state, customer_postcode,
            order_notes
          )
          VALUES (
            @id, @user_id, @total_price, 'pending',
            @customer_first_name, @customer_last_name, @customer_phone, @customer_email,
            @customer_street_address, @customer_city, @customer_state, @customer_postcode,
            @order_notes
          )
        `);

      // Insert order items
      for (const item of items) {
        const itemId = uuidv4();
        await transaction
          .request()
          .input('id', sql.UniqueIdentifier, itemId)
          .input('order_id', sql.UniqueIdentifier, orderId)
          .input('product_id', sql.UniqueIdentifier, item.product_id)
          .input('quantity', sql.Int, item.quantity)
          .input('price', sql.Decimal(10, 2), item.price)
          .query(`
            INSERT INTO order_items (id, order_id, product_id, quantity, price)
            VALUES (@id, @order_id, @product_id, @quantity, @price)
          `);
      }

      // Insert payment record
      const paymentId = uuidv4();
      await transaction
        .request()
        .input('id', sql.UniqueIdentifier, paymentId)
        .input('order_id', sql.UniqueIdentifier, orderId)
        .input('payment_method', sql.NVarChar, payment_method)
        .input('amount', sql.Decimal(10, 2), total_price)
        .input('payment_status', sql.NVarChar, payment_method === 'cod' ? 'pending' : 'pending')
        .input('customer_reference', sql.NVarChar, orderId) // Use orderId as reference
        .query(`
          INSERT INTO payments (id, order_id, payment_method, amount, payment_status, customer_reference)
          VALUES (@id, @order_id, @payment_method, @amount, @payment_status, @customer_reference)
        `);

      // Commit transaction
      await transaction.commit();

      // Get created order with items
      const orderResult = await pool
        .request()
        .input('orderId', sql.UniqueIdentifier, orderId)
        .query(`
          SELECT o.*,
                 (
                   SELECT oi.*, 
                          p.name_ar, 
                          p.name_en, 
                          p.name_ar as title, 
                          p.price as product_price, 
                          p.images
                   FROM order_items oi
                   INNER JOIN products p ON oi.product_id = p.id
                   WHERE oi.order_id = o.id
                   FOR JSON PATH
                 ) as order_items,
                 (
                   SELECT *
                   FROM payments
                   WHERE order_id = o.id
                   FOR JSON PATH
                 ) as payments
          FROM orders o
          WHERE o.id = @orderId
        `);

      const order = {
        ...orderResult.recordset[0],
        order_items: parseJSON(orderResult.recordset[0].order_items, []),
        payments: parseJSON(orderResult.recordset[0].payments, []),
      };

      res.status(201).json({
        success: true,
        data: order,
        message: 'Order created successfully',
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get user orders (authenticated)
 */
export const getUserOrders = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = getPaginationOffset(page, limit);

    const pool = getPool();

    // Get total count
    const countResult = await pool
      .request()
      .input('user_id', sql.UniqueIdentifier, req.user.id)
      .query(`
        SELECT COUNT(*) as total
        FROM orders
        WHERE user_id = @user_id
      `);

    const total = countResult.recordset[0].total;

    // Get orders
    const ordersResult = await pool
      .request()
      .input('user_id', sql.UniqueIdentifier, req.user.id)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT o.*,
               (
                 SELECT oi.*, 
                        p.name_ar, 
                        p.name_en, 
                        p.name_ar as title,
                        p.price as product_price, 
                        p.images
                 FROM order_items oi
                 INNER JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = o.id
                 FOR JSON PATH
               ) as order_items,
               (
                 SELECT *
                 FROM payments
                 WHERE order_id = o.id
                 FOR JSON PATH
               ) as payments
        FROM orders o
        WHERE o.user_id = @user_id
        ORDER BY o.created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    const orders = ordersResult.recordset.map(order => ({
      ...order,
      order_items: parseJSON(order.order_items, []),
      payments: parseJSON(order.payments, []),
    }));

    res.json({
      success: true,
      data: orders,
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
 * Get order by ID
 */
export const getOrderById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const orderResult = await pool
      .request()
      .input('orderId', sql.UniqueIdentifier, id)
      .query(`
        SELECT o.*,
               (
                 SELECT oi.*, 
                        p.name_ar, 
                        p.name_en, 
                        p.name_ar as title, 
                        p.price as product_price, 
                        p.images
                 FROM order_items oi
                 INNER JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = o.id
                 FOR JSON PATH
               ) as order_items,
               (
                 SELECT *
                 FROM payments
                 WHERE order_id = o.id
                 FOR JSON PATH
               ) as payments
        FROM orders o
        WHERE o.id = @orderId
      `);

    if (orderResult.recordset.length === 0) {
      throw new ApiError(404, 'Order not found');
    }

    const order = {
      ...orderResult.recordset[0],
      order_items: parseJSON(orderResult.recordset[0].order_items, []),
      payments: parseJSON(orderResult.recordset[0].payments, []),
    };

    // Check authorization (user can only see their own orders, admin can see all)
    if (req.user) {
      if (order.user_id && order.user_id !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(403, 'Access denied');
      }
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order status (Admin only)
 */
export const updateOrderStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, 'Invalid status');
    }

    const pool = getPool();

    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .input('status', sql.NVarChar, status)
      .query(`
        UPDATE orders
        SET status = @status, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, 'Order not found');
    }

    res.json({
      success: true,
      data: result.recordset[0],
      message: 'Order status updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all orders (Admin only)
 */
export const getAllOrders = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const offset = getPaginationOffset(page, limit);

    const pool = getPool();

    // Build where clause
    let whereClause = '';
    const request = pool.request();

    if (status) {
      whereClause = 'WHERE o.status = @status';
      request.input('status', sql.NVarChar, status);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM orders o ${whereClause}`;
    const countResult = await request.query(countQuery);
    const total = countResult.recordset[0].total;

    // Get orders
    const request2 = pool.request();
    if (status) request2.input('status', sql.NVarChar, status);
    request2.input('offset', sql.Int, offset);
    request2.input('limit', sql.Int, limit);

    const ordersResult = await request2.query(`
      SELECT o.*,
             (
               SELECT oi.*, 
                      p.name_ar, 
                      p.name_en, 
                      p.name_ar as title, 
                      p.price as product_price
               FROM order_items oi
               INNER JOIN products p ON oi.product_id = p.id
               WHERE oi.order_id = o.id
               FOR JSON PATH
             ) as order_items,
             (
               SELECT *
               FROM payments
               WHERE order_id = o.id
               FOR JSON PATH
             ) as payments
      FROM orders o
      ${whereClause}
      ORDER BY o.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

    const orders = ordersResult.recordset.map(order => ({
      ...order,
      order_items: parseJSON(order.order_items, []),
      payments: parseJSON(order.payments, []),
    }));

    res.json({
      success: true,
      data: orders,
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


