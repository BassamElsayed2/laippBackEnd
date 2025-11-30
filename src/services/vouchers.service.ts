import sql from "mssql";
import { getPool } from "../config/database";
import { v4 as uuidv4 } from "uuid";

export interface Voucher {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  user_id: string;
  phone_number: string;
  is_active: boolean;
  is_used: boolean;
  used_at: Date | null;
  used_order_id: string | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  user_name?: string;
  user_email?: string;
}

export interface CreateVoucherData {
  code?: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  user_id: string;
  phone_number: string;
  expires_at?: Date | null;
}

export interface VoucherFilters {
  is_active?: boolean;
  is_used?: boolean;
  search?: string;
  user_id?: string;
}

/**
 * Generate a random voucher code
 */
export function generateVoucherCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "LAPIP-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class VouchersService {
  /**
   * Get all vouchers with pagination and filters (Admin)
   */
  static async getAllVouchers(
    page: number = 1,
    limit: number = 10,
    filters: VoucherFilters = {}
  ): Promise<{ vouchers: Voucher[]; total: number }> {
    const pool = getPool();
    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    const request = pool.request();

    if (filters.is_active !== undefined) {
      whereClause += " AND v.is_active = @is_active";
      request.input("is_active", sql.Bit, filters.is_active);
    }

    if (filters.is_used !== undefined) {
      whereClause += " AND v.is_used = @is_used";
      request.input("is_used", sql.Bit, filters.is_used);
    }

    if (filters.user_id) {
      whereClause += " AND v.user_id = @user_id";
      request.input("user_id", sql.UniqueIdentifier, filters.user_id);
    }

    if (filters.search) {
      whereClause +=
        " AND (v.code LIKE @search OR v.phone_number LIKE @search OR p.full_name LIKE @search OR u.email LIKE @search)";
      request.input("search", sql.NVarChar, `%${filters.search}%`);
    }

    // Get total count
    const countResult = await request.query(`
      SELECT COUNT(*) as total
      FROM vouchers v
      LEFT JOIN users u ON v.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      ${whereClause}
    `);

    const total = countResult.recordset[0].total;

    // Get paginated results
    const request2 = pool.request();
    request2.input("offset", sql.Int, offset);
    request2.input("limit", sql.Int, limit);

    if (filters.is_active !== undefined) {
      request2.input("is_active", sql.Bit, filters.is_active);
    }
    if (filters.is_used !== undefined) {
      request2.input("is_used", sql.Bit, filters.is_used);
    }
    if (filters.user_id) {
      request2.input("user_id", sql.UniqueIdentifier, filters.user_id);
    }
    if (filters.search) {
      request2.input("search", sql.NVarChar, `%${filters.search}%`);
    }

    const result = await request2.query(`
      SELECT 
        v.*,
        p.full_name as user_name,
        u.email as user_email
      FROM vouchers v
      LEFT JOIN users u ON v.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      ${whereClause}
      ORDER BY v.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

    return {
      vouchers: result.recordset,
      total,
    };
  }

  /**
   * Get voucher by ID
   */
  static async getVoucherById(id: string): Promise<Voucher | null> {
    const pool = getPool();

    const result = await pool.request().input("id", sql.UniqueIdentifier, id)
      .query(`
        SELECT 
          v.*,
          p.full_name as user_name,
          u.email as user_email
        FROM vouchers v
        LEFT JOIN users u ON v.user_id = u.id
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE v.id = @id
      `);

    return result.recordset[0] || null;
  }

  /**
   * Get voucher by code (case-insensitive)
   */
  static async getVoucherByCode(code: string): Promise<Voucher | null> {
    const pool = getPool();
    const upperCode = code.toUpperCase();

    // Try exact match first (assuming codes are stored in uppercase)
    let result = await pool
      .request()
      .input("code", sql.NVarChar, upperCode).query(`
        SELECT v.*
        FROM vouchers v
        WHERE v.code = @code
      `);

    if (result.recordset.length > 0) {
      return result.recordset[0];
    }

    // Fallback: try case-insensitive search if exact match fails
    result = await pool
      .request()
      .input("code", sql.NVarChar, upperCode).query(`
        SELECT v.*
        FROM vouchers v
        WHERE UPPER(v.code) = @code
      `);

    return result.recordset[0] || null;
  }

  /**
   * Get vouchers for a specific user
   */
  static async getUserVouchers(userId: string): Promise<Voucher[]> {
    const pool = getPool();

    const result = await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, userId).query(`
        SELECT *
        FROM vouchers
        WHERE user_id = @user_id
        AND is_active = 1
        AND is_used = 0
        AND (expires_at IS NULL OR expires_at > GETDATE())
        ORDER BY created_at DESC
      `);

    return result.recordset;
  }

  /**
   * Create a new voucher
   */
  static async createVoucher(data: CreateVoucherData): Promise<Voucher> {
    const pool = getPool();
    const id = uuidv4();
    const code = (data.code || generateVoucherCode()).toUpperCase();

    // Validate discount value
    if (data.discount_type === "percentage") {
      if (data.discount_value <= 0 || data.discount_value > 100) {
        throw new Error("Percentage discount must be between 1 and 100");
      }
    } else if (data.discount_type === "fixed") {
      if (data.discount_value <= 0) {
        throw new Error("Fixed discount must be greater than 0");
      }
      if (data.discount_value > 100000) {
        throw new Error("Fixed discount cannot exceed 100,000");
      }
    }

    // Check if code already exists
    const existingVoucher = await this.getVoucherByCode(code);
    if (existingVoucher) {
      throw new Error("Voucher code already exists");
    }

    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("code", sql.NVarChar, code)
      .input("discount_type", sql.NVarChar, data.discount_type)
      .input("discount_value", sql.Decimal(10, 2), data.discount_value)
      .input("user_id", sql.UniqueIdentifier, data.user_id)
      .input("phone_number", sql.NVarChar, data.phone_number)
      .input("expires_at", sql.DateTime, data.expires_at || null).query(`
        INSERT INTO vouchers (id, code, discount_type, discount_value, user_id, phone_number, expires_at)
        VALUES (@id, @code, @discount_type, @discount_value, @user_id, @phone_number, @expires_at)
      `);

    const voucher = await this.getVoucherById(id);
    return voucher!;
  }

  /**
   * Activate a voucher
   */
  static async activateVoucher(id: string): Promise<Voucher | null> {
    const pool = getPool();

    await pool.request().input("id", sql.UniqueIdentifier, id).query(`
        UPDATE vouchers
        SET is_active = 1
        WHERE id = @id
      `);

    return this.getVoucherById(id);
  }

  /**
   * Deactivate a voucher
   */
  static async deactivateVoucher(id: string): Promise<Voucher | null> {
    const pool = getPool();

    await pool.request().input("id", sql.UniqueIdentifier, id).query(`
        UPDATE vouchers
        SET is_active = 0
        WHERE id = @id
      `);

    return this.getVoucherById(id);
  }

  /**
   * Validate and apply voucher for a user (without locking)
   * Use this for preview/check purposes only, not for actual order creation
   */
  static async validateVoucher(
    code: string,
    userId: string
  ): Promise<{
    valid: boolean;
    voucher?: Voucher;
    error?: string;
  }> {
    const voucher = await this.getVoucherByCode(code);

    if (!voucher) {
      return { valid: false, error: "Voucher not found" };
    }

    if (!voucher.is_active) {
      return { valid: false, error: "Voucher is not active" };
    }

    if (voucher.is_used) {
      return { valid: false, error: "Voucher has already been used" };
    }

    if (voucher.user_id !== userId) {
      return { valid: false, error: "Voucher is not assigned to this user" };
    }

    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
      return { valid: false, error: "Voucher has expired" };
    }

    return { valid: true, voucher };
  }

  /**
   * Validate and lock voucher inside a transaction (Race condition safe)
   * This should be used during actual order creation
   */
  static async validateAndLockVoucher(
    code: string,
    userId: string,
    transaction: any
  ): Promise<{
    valid: boolean;
    voucher?: Voucher;
    error?: string;
  }> {
    try {
      // Validate voucher - simplified query without UPPER() to use index if available
      // Using transaction isolation for consistency
      console.log("🔍 Executing voucher query in transaction...", { code: code.toUpperCase(), userId });
      const queryStartTime = Date.now();
      
      const result = await transaction
        .request()
        .input("code", sql.NVarChar, code.toUpperCase())
        .input("user_id", sql.UniqueIdentifier, userId)
        .query(`
          SELECT 
            v.*
          FROM vouchers v
          WHERE v.code = @code
          AND v.user_id = @user_id
          AND v.is_active = 1
          AND v.is_used = 0
          AND (v.expires_at IS NULL OR v.expires_at > GETDATE())
        `);
      
      const queryTime = Date.now() - queryStartTime;
      console.log(`⏱️ Voucher query completed in ${queryTime}ms`, { found: result.recordset.length > 0 });

      if (result.recordset.length === 0) {
        // Try to get the voucher to provide a more specific error message (without transaction for speed)
        const pool = getPool();
        const voucherCheck = await pool
          .request()
          .input("code", sql.NVarChar, code.toUpperCase()).query(`
            SELECT * FROM vouchers WHERE code = @code
          `);

        if (voucherCheck.recordset.length === 0) {
          return { valid: false, error: "Voucher not found" };
        }

        const voucher = voucherCheck.recordset[0];
        if (!voucher.is_active) {
          return { valid: false, error: "Voucher is not active" };
        }
        if (voucher.is_used) {
          return { valid: false, error: "Voucher has already been used" };
        }
        if (voucher.user_id !== userId) {
          return { valid: false, error: "Voucher is not assigned to this user" };
        }
        if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
          return { valid: false, error: "Voucher has expired" };
        }

        return { valid: false, error: "Invalid voucher" };
      }

      return { valid: true, voucher: result.recordset[0] };
    } catch (error: any) {
      console.error("Error in validateAndLockVoucher:", error);
      // If there's a timeout or deadlock, return a clear error
      if (error.message?.includes("timeout") || error.message?.includes("deadlock")) {
        throw new Error("Voucher validation timed out. Please try again.");
      }
      throw error;
    }
  }

  /**
   * Mark voucher as used (with optional transaction support)
   */
  static async useVoucher(
    id: string,
    orderId: string,
    transaction?: any
  ): Promise<Voucher | null> {
    const requestObj = transaction
      ? transaction.request()
      : getPool().request();

    // Update voucher (can't use OUTPUT clause if table has triggers)
    await requestObj
      .input("id", sql.UniqueIdentifier, id)
      .input("order_id", sql.UniqueIdentifier, orderId).query(`
        UPDATE vouchers
        SET is_used = 1, used_at = GETDATE(), used_order_id = @order_id
        WHERE id = @id
      `);

    // Get updated voucher (if inside transaction, use transaction request)
    if (transaction) {
      const getResult = await transaction
        .request()
        .input("id", sql.UniqueIdentifier, id).query(`
          SELECT * FROM vouchers WHERE id = @id
        `);
      return getResult.recordset[0] || null;
    }

    return this.getVoucherById(id);
  }

  /**
   * Delete a voucher
   */
  static async deleteVoucher(id: string): Promise<boolean> {
    const pool = getPool();

    const result = await pool.request().input("id", sql.UniqueIdentifier, id)
      .query(`
        DELETE FROM vouchers WHERE id = @id
      `);

    return result.rowsAffected[0] > 0;
  }

  /**
   * Deactivate all vouchers (that are not used)
   */
  static async deactivateAllVouchers(): Promise<number> {
    const pool = getPool();

    const result = await pool.request().query(`
      UPDATE vouchers
      SET is_active = 0, updated_at = GETDATE()
      WHERE is_active = 1 AND is_used = 0
    `);

    return result.rowsAffected[0];
  }

  /**
   * Delete all unused vouchers
   */
  static async deleteAllUnusedVouchers(): Promise<number> {
    const pool = getPool();

    const result = await pool.request().query(`
      DELETE FROM vouchers WHERE is_used = 0
    `);

    return result.rowsAffected[0];
  }

  /**
   * Delete all vouchers (including used ones)
   */
  static async deleteAllVouchers(): Promise<number> {
    const pool = getPool();

    const result = await pool.request().query(`
      DELETE FROM vouchers
    `);

    return result.rowsAffected[0];
  }

  /**
   * Get voucher statistics
   */
  static async getVoucherStats(): Promise<{
    total: number;
    active: number;
    used: number;
    inactive: number;
  }> {
    const pool = getPool();

    const result = await pool.request().query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 AND is_used = 0 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used,
        SUM(CASE WHEN is_active = 0 AND is_used = 0 THEN 1 ELSE 0 END) as inactive
      FROM vouchers
    `);

    return {
      total: result.recordset[0].total || 0,
      active: result.recordset[0].active || 0,
      used: result.recordset[0].used || 0,
      inactive: result.recordset[0].inactive || 0,
    };
  }

  /**
   * Find user by phone number
   */
  static async findUserByPhone(phone: string): Promise<{
    id: string;
    email: string;
    full_name: string;
    phone: string;
    created_at: Date;
  } | null> {
    const pool = getPool();

    // Normalize phone number (remove spaces, dashes, and handle different formats)
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, "");

    const result = await pool
      .request()
      .input("phone", sql.NVarChar, normalizedPhone).query(`
        SELECT 
          u.id,
          u.email,
          p.full_name,
          p.phone,
          u.created_at
        FROM users u
        INNER JOIN profiles p ON u.id = p.user_id
        WHERE p.phone = @phone
           OR p.phone LIKE '%' + @phone
           OR @phone LIKE '%' + p.phone
      `);

    return result.recordset[0] || null;
  }

  /**
   * Get all users with their phone numbers
   */
  static async getAllUsersWithPhone(): Promise<
    Array<{
      id: string;
      email: string;
      full_name: string;
      phone: string;
    }>
  > {
    const pool = getPool();

    const result = await pool.request().query(`
      SELECT 
        u.id,
        u.email,
        p.full_name,
        p.phone
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      WHERE p.phone IS NOT NULL AND p.phone != ''
    `);

    return result.recordset;
  }

  /**
   * Create vouchers for all users (bulk creation)
   */
  static async createBulkVouchers(data: {
    discount_type: "percentage" | "fixed";
    discount_value: number;
    expires_at?: Date | null;
    code_prefix?: string;
  }): Promise<{ created: number; failed: number; vouchers: Voucher[] }> {
    const users = await this.getAllUsersWithPhone();
    const createdVouchers: Voucher[] = [];
    let failed = 0;

    for (const user of users) {
      try {
        // Generate unique code for each user
        const code = data.code_prefix
          ? `${data.code_prefix}-${this.generateShortCode()}`
          : generateVoucherCode();

        const voucher = await this.createVoucher({
          code,
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          user_id: user.id,
          phone_number: user.phone,
          expires_at: data.expires_at,
        });

        createdVouchers.push(voucher);
      } catch (error) {
        console.error(`Failed to create voucher for user ${user.id}:`, error);
        failed++;
      }
    }

    return {
      created: createdVouchers.length,
      failed,
      vouchers: createdVouchers,
    };
  }

  /**
   * Generate a short random code
   */
  private static generateShortCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Calculate discount amount
   */
  static calculateDiscount(voucher: Voucher, totalAmount: number): number {
    if (voucher.discount_type === "percentage") {
      return (totalAmount * voucher.discount_value) / 100;
    }
    return Math.min(voucher.discount_value, totalAmount);
  }
}
