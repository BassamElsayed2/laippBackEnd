import { Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { getPool, sql } from "../config/database";
import { AuthRequest, Order, OrderItem } from "../types";
import { ApiError } from "../middleware/errorHandler";
import {
  parseJSON,
  getPaginationOffset,
  getTotalPages,
} from "../utils/helpers";
import { VouchersService } from "../services/vouchers.service";

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
      voucher_code,
      shipping_fee,
    } = req.body;

    console.log("📦 Creating order with data:", {
      itemsCount: items?.length,
      payment_method,
      voucher_code: voucher_code || "none",
      shipping_fee: shipping_fee !== undefined ? shipping_fee : "not provided",
    });

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, "Order must contain at least one item");
    }

    const orderId = uuidv4();
    const pool = getPool();

    // Begin transaction with READ COMMITTED isolation level (default)
    // This provides good balance between performance and data consistency
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      // Step 1: Calculate subtotal from database prices (prevent price manipulation)
      let calculatedSubtotal = 0;
      const validatedItems = [];

      for (const item of items) {
        // Get actual price from database
        const productResult = await transaction
          .request()
          .input("product_id", sql.UniqueIdentifier, item.product_id).query(`
            SELECT id, price, stock_quantity 
            FROM products 
            WHERE id = @product_id AND is_active = 1
          `);

        if (productResult.recordset.length === 0) {
          throw new ApiError(
            400,
            `Product not found or inactive: ${item.product_id}`
          );
        }

        const product = productResult.recordset[0];

        // Validate stock (optional - remove if you don't track stock)
        if (
          product.stock_quantity !== null &&
          product.stock_quantity < item.quantity
        ) {
          throw new ApiError(
            400,
            `Insufficient stock for product: ${item.product_id}`
          );
        }

        const itemTotal = product.price * item.quantity;
        calculatedSubtotal += itemTotal;

        validatedItems.push({
          product_id: item.product_id,
          quantity: item.quantity,
          price: product.price, // Use database price, not frontend price
        });
      }

      // Step 2: Validate voucher if provided (simplified - validate outside transaction first)
      let validatedVoucher = null;
      let discountAmount = 0;

      if (voucher_code && user_id) {
        try {
          console.log("🔍 Starting voucher validation...", { voucher_code, user_id });
          const startTime = Date.now();
          
          // First, quick validation outside transaction (fast, no locks)
          const quickValidation = await VouchersService.validateVoucher(
            voucher_code,
            user_id
          );
          
          if (!quickValidation.valid) {
            throw new ApiError(400, quickValidation.error || "Invalid voucher code");
          }
          
          console.log("✅ Quick validation passed, voucher is valid");
          validatedVoucher = quickValidation.voucher;

          // Calculate discount
          if (validatedVoucher) {
            if (validatedVoucher.discount_type === "percentage") {
              discountAmount =
                (calculatedSubtotal * validatedVoucher.discount_value) / 100;
            } else {
              discountAmount = Math.min(
                validatedVoucher.discount_value,
                calculatedSubtotal
              );
            }
          }
          
          const validationTime = Date.now() - startTime;
          console.log(`✅ Voucher validation completed in ${validationTime}ms`, { 
            valid: true, 
            discountAmount 
          });
        } catch (voucherError: any) {
          // If voucher validation fails due to table not existing, continue without voucher
          if (
            voucherError.message?.includes("Invalid object name 'vouchers'")
          ) {
            console.warn(
              "Vouchers table not found, skipping voucher validation"
            );
            validatedVoucher = null;
            discountAmount = 0;
          } else if (voucherError instanceof ApiError) {
            throw voucherError;
          } else {
            console.error("Voucher validation error:", voucherError);
            throw new ApiError(
              400,
              voucherError.message || "Failed to validate voucher"
            );
          }
        }
      }

      // Step 3: Calculate final total
      const shippingFee = shipping_fee !== undefined && shipping_fee !== null ? Number(shipping_fee) : 0;
      const originalPrice = calculatedSubtotal + shippingFee;
      const finalTotalPrice = Math.max(0, calculatedSubtotal + shippingFee - discountAmount);

      console.log("💰 Order totals calculated:", {
        calculatedSubtotal,
        shippingFee,
        discountAmount,
        originalPrice,
        finalTotalPrice,
      });

      // Step 4: Insert order with voucher information
      await transaction
        .request()
        .input("id", sql.UniqueIdentifier, orderId)
        .input("user_id", sql.UniqueIdentifier, user_id || null)
        .input("total_price", sql.Decimal(10, 2), finalTotalPrice)
        .input("original_price", sql.Decimal(10, 2), originalPrice)
        .input("discount_amount", sql.Decimal(10, 2), discountAmount)
        .input("voucher_code", sql.NVarChar, validatedVoucher?.code || null)
        .input(
          "voucher_discount_type",
          sql.NVarChar,
          validatedVoucher?.discount_type || null
        )
        .input(
          "voucher_discount_value",
          sql.Decimal(10, 2),
          validatedVoucher?.discount_value || null
        )
        .input("customer_first_name", sql.NVarChar, customer_first_name)
        .input("customer_last_name", sql.NVarChar, customer_last_name)
        .input("customer_phone", sql.NVarChar, customer_phone)
        .input("customer_email", sql.NVarChar, customer_email || null)
        .input("customer_street_address", sql.NVarChar, customer_street_address)
        .input("customer_city", sql.NVarChar, customer_city)
        .input("customer_state", sql.NVarChar, customer_state || null)
        .input("customer_postcode", sql.NVarChar, customer_postcode || null)
        .input("order_notes", sql.NVarChar(sql.MAX), notes || null).query(`
          INSERT INTO orders (
            id, user_id, total_price, original_price, discount_amount,
            voucher_code, voucher_discount_type, voucher_discount_value,
            status,
            customer_first_name, customer_last_name, customer_phone, customer_email,
            customer_street_address, customer_city, customer_state, customer_postcode,
            order_notes
          )
          VALUES (
            @id, @user_id, @total_price, @original_price, @discount_amount,
            @voucher_code, @voucher_discount_type, @voucher_discount_value,
            'pending',
            @customer_first_name, @customer_last_name, @customer_phone, @customer_email,
            @customer_street_address, @customer_city, @customer_state, @customer_postcode,
            @order_notes
          )
        `);

      // Step 5: Insert order items with validated prices
      for (const item of validatedItems) {
        const itemId = uuidv4();
        await transaction
          .request()
          .input("id", sql.UniqueIdentifier, itemId)
          .input("order_id", sql.UniqueIdentifier, orderId)
          .input("product_id", sql.UniqueIdentifier, item.product_id)
          .input("quantity", sql.Int, item.quantity)
          .input("price", sql.Decimal(10, 2), item.price).query(`
            INSERT INTO order_items (id, order_id, product_id, quantity, price)
            VALUES (@id, @order_id, @product_id, @quantity, @price)
          `);
      }

      // Step 6: Insert payment record only for COD (Cash on Delivery)
      // For EasyKash, payment record will be created by initiateEasykashPayment service
      if (payment_method === "cod") {
        const paymentId = uuidv4();
        await transaction
          .request()
          .input("id", sql.UniqueIdentifier, paymentId)
          .input("order_id", sql.UniqueIdentifier, orderId)
          .input("payment_method", sql.NVarChar, payment_method)
          .input("amount", sql.Decimal(10, 2), finalTotalPrice)
          .input("payment_status", sql.NVarChar, "pending")
          .input("customer_reference", sql.NVarChar, orderId).query(`
            INSERT INTO payments (id, order_id, payment_method, amount, payment_status, customer_reference)
            VALUES (@id, @order_id, @payment_method, @amount, @payment_status, @customer_reference)
          `);
      }

      // Step 7: Don't mark voucher as used yet - wait for payment confirmation
      // Voucher will be marked as used only after successful payment in payment callback

      // Step 8: Commit transaction
      console.log("💾 Committing transaction...");
      const commitStartTime = Date.now();
      await transaction.commit();
      const commitTime = Date.now() - commitStartTime;
      console.log(`✅ Transaction committed in ${commitTime}ms`);

      // Get created order with items
      const orderResult = await pool
        .request()
        .input("orderId", sql.UniqueIdentifier, orderId).query(`
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
        message: "Order created successfully",
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
      throw new ApiError(401, "Authentication required");
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = getPaginationOffset(page, limit);

    const pool = getPool();

    // Get total count
    const countResult = await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, req.user.id).query(`
        SELECT COUNT(*) as total
        FROM orders
        WHERE user_id = @user_id
      `);

    const total = countResult.recordset[0].total;

    // Get orders
    const ordersResult = await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, req.user.id)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, limit).query(`
        SELECT o.*,
               (
                 SELECT oi.id, 
                        oi.order_id,
                        oi.product_id, 
                        oi.quantity, 
                        oi.price,
                        oi.created_at,
                        (
                          SELECT p.id,
                                 p.name_ar as title,
                                 p.name_en,
                                 p.price,
                                 p.images
                          FROM products p
                          WHERE p.id = oi.product_id
                          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                        ) as product
                 FROM order_items oi
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

    const orders = ordersResult.recordset.map((order) => ({
      ...order,
      order_items: parseJSON(order.order_items, []).map((item: any) => {
        const product =
          typeof item.product === "string"
            ? parseJSON(item.product, null)
            : item.product;
        if (product && typeof product.images === "string") {
          product.images = parseJSON(product.images, []);
        }
        return {
          ...item,
          product,
        };
      }),
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
      .input("orderId", sql.UniqueIdentifier, id).query(`
        SELECT o.*,
               (
                 SELECT oi.id, 
                        oi.order_id,
                        oi.product_id, 
                        oi.quantity, 
                        oi.price,
                        oi.created_at,
                        (
                          SELECT p.id,
                                 p.name_ar as title,
                                 p.name_en,
                                 p.price,
                                 p.images
                          FROM products p
                          WHERE p.id = oi.product_id
                          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                        ) as product
                 FROM order_items oi
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
      throw new ApiError(404, "Order not found");
    }

    const order = {
      ...orderResult.recordset[0],
      order_items: parseJSON(orderResult.recordset[0].order_items, []).map(
        (item: any) => {
          const product =
            typeof item.product === "string"
              ? parseJSON(item.product, null)
              : item.product;
          if (product && typeof product.images === "string") {
            product.images = parseJSON(product.images, []);
          }
          // Rename 'product' to 'products' for consistency with getAllOrders
          return {
            ...item,
            products: product
              ? {
                  id: product.id,
                  name_ar: product.title || product.name_ar,
                  name_en: product.name_en,
                  price: product.price,
                  image_url: product.images || [],
                }
              : null,
          };
        }
      ),
      payments: parseJSON(orderResult.recordset[0].payments, []),
    };

    // Check authorization (user can only see their own orders, admin can see all)
    if (req.user) {
      if (
        order.user_id &&
        order.user_id !== req.user.id &&
        req.user.role !== "admin"
      ) {
        throw new ApiError(403, "Access denied");
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

    const validStatuses = [
      "pending",
      "paid",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, "Invalid status");
    }

    const pool = getPool();

    const result = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("status", sql.NVarChar, status).query(`
        UPDATE orders
        SET status = @status, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, "Order not found");
    }

    res.json({
      success: true,
      data: result.recordset[0],
      message: "Order status updated successfully",
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

    // Build where clause - exclude pending orders by default
    let whereClause = "";
    let countQuery = "";

    if (status) {
      // If a specific status is selected, show only that status
      whereClause = "WHERE o.status = @status";
      countQuery = `SELECT COUNT(*) as total FROM orders o WHERE o.status = @status`;
    } else {
      // Otherwise, show all orders EXCEPT pending
      whereClause = "WHERE o.status != 'pending'";
      countQuery = `SELECT COUNT(*) as total FROM orders o WHERE o.status != 'pending'`;
    }

    // Get total count
    const request = pool.request();
    if (status) {
      request.input("status", sql.NVarChar, status);
    }
    const countResult = await request.query(countQuery);
    const total = countResult.recordset[0].total;

    // Get orders - apply same where clause
    const request2 = pool.request();
    if (status) {
      request2.input("status", sql.NVarChar, status);
    }
    request2.input("offset", sql.Int, offset);
    request2.input("limit", sql.Int, limit);

    const ordersResult = await request2.query(`
      SELECT o.*,
             (
               SELECT oi.id, 
                      oi.order_id,
                      oi.product_id, 
                      oi.quantity, 
                      oi.price,
                      oi.created_at,
                      (
                        SELECT p.id,
                               p.name_ar as title,
                               p.name_en,
                               p.price,
                               p.images
                        FROM products p
                        WHERE p.id = oi.product_id
                        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                      ) as product
               FROM order_items oi
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

    const orders = ordersResult.recordset.map((order) => ({
      ...order,
      order_items: parseJSON(order.order_items, []).map((item: any) => {
        const product =
          typeof item.product === "string"
            ? parseJSON(item.product, null)
            : item.product;
        if (product && typeof product.images === "string") {
          product.images = parseJSON(product.images, []);
        }
        return {
          ...item,
          product,
        };
      }),
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
