import { getPool } from "../config/database";
import { ApiError } from "../middleware/error.middleware";
import sql from "mssql";

export interface CreateOrderData {
  address_id?: string;
  delivery_type: "delivery" | "pickup";
  branch_id?: string;
  items: any[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  notes?: string;
  payment_method?: string;
}

export class OrdersService {
  // Get user profile (for phone validation)
  static async getUserProfile(userId: string) {
    const pool = getPool();
    const result = await pool.request().input("userId", userId).query(`
        SELECT phone
        FROM profiles
        WHERE user_id = @userId
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, "User profile not found");
    }

    return result.recordset[0];
  }

  // Get user orders
  static async getUserOrders(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    const pool = getPool();
    const offset = (page - 1) * limit;

    const ordersResult = await pool
      .request()
      .input("userId", userId)
      .input("offset", offset)
      .input("limit", limit).query(`
        SELECT 
          o.*,
          a.title as address_name, a.area, a.city,
          b.name_ar as branch_name_ar, b.name_en as branch_name_en
        FROM orders o
        LEFT JOIN addresses a ON o.address_id = a.id
        LEFT JOIN branches b ON o.branch_id = b.id
        WHERE o.user_id = @userId 
          AND o.status != 'pending_payment'
        ORDER BY o.created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    const orders = ordersResult.recordset.map((order: any) => ({
      ...order,
      items: JSON.parse(order.items),
    }));

    // Get total count
    const countResult = await pool
      .request()
      .input("userId", userId)
      .query(
        "SELECT COUNT(*) as total FROM orders WHERE user_id = @userId AND status != 'pending_payment'"
      );

    const total = countResult.recordset[0].total;

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Get order by ID
  static async getOrderById(orderId: string, userId?: string) {
    const pool = getPool();
    const request = pool.request().input("orderId", orderId);

    let userCondition = "";
    if (userId) {
      userCondition = "AND o.user_id = @userId";
      request.input("userId", userId);
    }

    const result = await request.query(`
      SELECT 
        o.*,
        p.full_name as customer_name, p.phone as customer_phone,
        a.title as address_name, a.street, a.building, a.floor, a.apartment, a.area, a.city, a.latitude, a.longitude, a.notes as address_notes,
        b.name_ar as branch_name_ar, b.name_en as branch_name_en, b.address_ar as branch_address_ar, b.address_en as branch_address_en, b.phone as branch_phone,
        pay.callback_data as payment_callback_data
      FROM orders o
      LEFT JOIN profiles p ON o.user_id = p.user_id
      LEFT JOIN addresses a ON o.address_id = a.id
      LEFT JOIN branches b ON o.branch_id = b.id
      LEFT JOIN payments pay ON o.id = pay.order_id
      WHERE o.id = @orderId ${userCondition}
    `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, "Order not found");
    }

    const order = result.recordset[0];
    order.items = JSON.parse(order.items);

    // Parse callback_data if available
    if (order.payment_callback_data) {
      try {
        order.payment_callback_data = JSON.parse(order.payment_callback_data);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    return order;
  }

  // Create order
  static async createOrder(userId: string, data: CreateOrderData) {
    // Validate delivery type
    if (data.delivery_type === "delivery" && !data.address_id) {
      throw new ApiError(400, "Address is required for delivery orders");
    }

    if (data.delivery_type === "pickup" && !data.branch_id) {
      throw new ApiError(400, "Branch is required for pickup orders");
    }

    // Create order using stored procedure
    const pool = getPool();
    const result = await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, userId)
      .input("address_id", sql.UniqueIdentifier, data.address_id || null)
      .input("delivery_type", sql.NVarChar(20), data.delivery_type)
      .input("branch_id", sql.UniqueIdentifier, data.branch_id || null)
      .input("items", sql.NVarChar(sql.MAX), JSON.stringify(data.items))
      .input("subtotal", sql.Decimal(10, 2), data.subtotal)
      .input("delivery_fee", sql.Decimal(10, 2), data.delivery_fee)
      .input("total", sql.Decimal(10, 2), data.total)
      .input("notes", sql.NVarChar(sql.MAX), data.notes || null)
      .input("payment_method", sql.NVarChar(50), data.payment_method || "cash")
      .output("order_id", sql.UniqueIdentifier)
      .execute("sp_CreateOrder");

    const orderId = result.output.order_id;
    return await this.getOrderById(orderId);
  }

  // Update order status (admin only)
  static async updateOrderStatus(orderId: string, status: string) {
    const pool = getPool();
    await pool
      .request()
      .input("order_id", sql.UniqueIdentifier, orderId)
      .input("status", sql.NVarChar(20), status)
      .execute("sp_UpdateOrderStatus");

    return await this.getOrderById(orderId);
  }

  // Mark order as paid (user)
  static async markOrderAsPaid(orderId: string, userId: string) {
    const pool = getPool();
    // Check if order belongs to user and is in pending_payment status
    const checkResult = await pool
      .request()
      .input("orderId", sql.UniqueIdentifier, orderId)
      .input("userId", sql.UniqueIdentifier, userId).query(`
        SELECT id, status, payment_status 
        FROM orders 
        WHERE id = @orderId AND user_id = @userId
      `);

    if (checkResult.recordset.length === 0) {
      throw new ApiError(404, "Order not found");
    }

    const order = checkResult.recordset[0];

    // Debug logging
    console.log("🔍 Mark Order As Paid - Debug Info:");
    console.log("Order ID:", orderId);
    console.log("User ID:", userId);
    console.log("Current Status:", order.status);
    console.log("Current Payment Status:", order.payment_status);

    // Allow marking as paid if order is in pending_payment status OR if payment_status is pending
    if (
      order.status !== "pending_payment" &&
      order.payment_status !== "pending"
    ) {
      console.log(
        "❌ Order is not in pending_payment status and payment_status is not pending."
      );
      console.log(
        "Current status:",
        order.status,
        "Payment status:",
        order.payment_status
      );
      throw new ApiError(
        400,
        `Order cannot be marked as paid. Status: ${order.status}, Payment Status: ${order.payment_status}`
      );
    }

    console.log("✅ Order can be marked as paid. Proceeding with update...");

    // Update order to paid status
    await pool.request().input("orderId", sql.UniqueIdentifier, orderId).query(`
        UPDATE orders 
        SET 
          payment_status = 'paid',
          status = 'confirmed',
          updated_at = GETDATE()
        WHERE id = @orderId
      `);

    console.log("✅ Order successfully updated to paid status");

    return await this.getOrderById(orderId);
  }

  // Cancel order (user)
  static async cancelOrder(orderId: string, userId: string) {
    const pool = getPool();
    // Check if order belongs to user
    const checkResult = await pool
      .request()
      .input("orderId", orderId)
      .input("userId", userId)
      .query(
        "SELECT id, status FROM orders WHERE id = @orderId AND user_id = @userId"
      );

    if (checkResult.recordset.length === 0) {
      throw new ApiError(404, "Order not found");
    }

    const order = checkResult.recordset[0];

    // Only allow cancellation if order is pending or confirmed
    if (!["pending", "confirmed"].includes(order.status)) {
      throw new ApiError(400, "Order cannot be cancelled at this stage");
    }

    await pool
      .request()
      .input("order_id", sql.UniqueIdentifier, orderId)
      .input("status", sql.NVarChar(20), "cancelled")
      .execute("sp_UpdateOrderStatus");

    return await this.getOrderById(orderId, userId);
  }

  // Get all orders (admin)
  static async getAllOrders(
    page: number = 1,
    limit: number = 10,
    status?: string,
    orderId?: string,
    customerName?: string
  ) {
    const pool = getPool();
    const offset = (page - 1) * limit;
    const request = pool
      .request()
      .input("offset", offset)
      .input("limit", limit);

    const conditions: string[] = [];

    if (status) {
      conditions.push("o.status = @status");
      request.input("status", status);
    } else {
      // إخفاء الطلبات pending_payment من Dashboard إلا إذا تم طلبها بشكل صريح
      conditions.push("o.status != 'pending_payment'");
    }

    if (orderId) {
      conditions.push("CAST(o.id AS NVARCHAR(36)) LIKE @orderId");
      request.input("orderId", `%${orderId}%`);
    }

    if (customerName) {
      conditions.push("p.full_name LIKE @customerName");
      request.input("customerName", `%${customerName}%`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const ordersResult = await request.query(`
      SELECT 
        o.*,
        p.full_name as customer_name, p.phone as customer_phone,
        a.area, a.city,
        b.name_ar as branch_name_ar, b.name_en as branch_name_en
      FROM orders o
      LEFT JOIN profiles p ON o.user_id = p.user_id
      LEFT JOIN addresses a ON o.address_id = a.id
      LEFT JOIN branches b ON o.branch_id = b.id
      ${whereClause}
      ORDER BY o.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

    const orders = ordersResult.recordset.map((order: any) => ({
      ...order,
      items: JSON.parse(order.items),
    }));

    // Get total count
    const countRequest = pool.request();
    if (status) {
      countRequest.input("status", status);
    }
    if (orderId) {
      countRequest.input("orderId", `%${orderId}%`);
    }
    if (customerName) {
      countRequest.input("customerName", `%${customerName}%`);
    }

    // Reconstruct where clause for count query
    const countConditions: string[] = [];
    if (status) {
      countConditions.push("o.status = @status");
    } else {
      // إخفاء الطلبات pending_payment من العدد أيضاً
      countConditions.push("o.status != 'pending_payment'");
    }
    if (orderId) {
      countConditions.push("CAST(o.id AS NVARCHAR(36)) LIKE @orderId");
    }
    if (customerName) {
      countConditions.push("p.full_name LIKE @customerName");
    }
    const countWhereClause =
      countConditions.length > 0
        ? `WHERE ${countConditions.join(" AND ")}`
        : "";

    const countResult = await countRequest.query(`
      SELECT COUNT(*) as total 
      FROM orders o
      LEFT JOIN profiles p ON o.user_id = p.user_id
      ${countWhereClause}
    `);

    const total = countResult.recordset[0].total;

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Get order statistics (admin)
  static async getOrderStats(filters?: {
    start_date?: string;
    end_date?: string;
    branch_id?: string;
  }) {
    const pool = getPool();
    const request = pool.request();
    let conditions: string[] = [];

    if (filters?.start_date) {
      conditions.push("o.created_at >= @startDate");
      request.input("startDate", filters.start_date);
    }

    if (filters?.end_date) {
      conditions.push("o.created_at <= @endDate");
      request.input("endDate", filters.end_date);
    }

    if (filters?.branch_id) {
      conditions.push("o.branch_id = @branchId");
      request.input("branchId", filters.branch_id);
    }

    // استثناء الطلبات pending_payment من الإحصائيات
    conditions.push("o.status != 'pending_payment'");

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await request.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN o.status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN o.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_orders,
        SUM(CASE WHEN o.status = 'preparing' THEN 1 ELSE 0 END) as preparing_orders,
        SUM(CASE WHEN o.status = 'ready' THEN 1 ELSE 0 END) as ready_orders,
        SUM(CASE WHEN o.status = 'delivering' THEN 1 ELSE 0 END) as delivering_orders,
        SUM(CASE WHEN o.status IN ('delivered', 'completed') THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
        COALESCE(SUM(CASE WHEN o.status IN ('delivered', 'completed') THEN o.total ELSE 0 END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN o.status IN ('delivered', 'completed') THEN o.total ELSE NULL END), 0) as average_order_value
      FROM orders o
      ${whereClause}
    `);

    return result.recordset[0];
  }

  // Delete order (admin only)
  static async deleteOrder(orderId: string) {
    const pool = getPool();
    // Check if order exists
    const checkResult = await pool
      .request()
      .input("orderId", sql.UniqueIdentifier, orderId)
      .query("SELECT id FROM orders WHERE id = @orderId");

    if (checkResult.recordset.length === 0) {
      throw new ApiError(404, "Order not found");
    }

    // Delete the order (cascade will delete order_items and payments)
    await pool
      .request()
      .input("orderId", sql.UniqueIdentifier, orderId)
      .query("DELETE FROM orders WHERE id = @orderId");

    return { success: true, message: "Order deleted successfully" };
  }
}
