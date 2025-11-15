import { getPool, sql } from "../config/database";
import { ApiError } from "../middleware/errorHandler";

export interface ShippingFee {
  id: number;
  governorate_name_ar: string;
  governorate_name_en: string;
  fee: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateShippingFeeData {
  governorate_name_ar: string;
  governorate_name_en: string;
  fee: number;
  is_active?: boolean;
}

export interface UpdateShippingFeeData {
  governorate_name_ar?: string;
  governorate_name_en?: string;
  fee?: number;
  is_active?: boolean;
}

export class ShippingService {
  /**
   * Get shipping fee by governorate name
   * Returns null if governorate is not found in shipping_fees table
   * Returns 0 if governorate exists but fee is 0 (free shipping)
   * Returns the fee amount if governorate exists and has a fee
   */
  static async getShippingFeeByGovernorate(
    governorateName: string
  ): Promise<number | null> {
    const pool = getPool();
    const result = await pool
      .request()
      .input("governorate", sql.NVarChar(255), governorateName)
      .query(`
        SELECT fee
        FROM shipping_fees
        WHERE (governorate_name_ar = @governorate OR governorate_name_en = @governorate)
          AND is_active = 1
      `);

    if (result.recordset.length === 0) {
      // Return null if governorate not found (shipping not available)
      return null;
    }

    const fee = parseFloat(result.recordset[0].fee);
    // Return null if fee is invalid, otherwise return the fee (can be 0 for free shipping)
    return isNaN(fee) ? null : fee;
  }

  /**
   * Get all shipping fees
   */
  static async getAllShippingFees(): Promise<ShippingFee[]> {
    const pool = getPool();
    const result = await pool.query(`
      SELECT *
      FROM shipping_fees
      ORDER BY governorate_name_ar
    `);

    return result.recordset;
  }

  /**
   * Get active shipping fees only
   */
  static async getActiveShippingFees(): Promise<ShippingFee[]> {
    const pool = getPool();
    const result = await pool.query(`
      SELECT *
      FROM shipping_fees
      WHERE is_active = 1
      ORDER BY governorate_name_ar
    `);

    return result.recordset;
  }

  /**
   * Get shipping fee by ID
   */
  static async getShippingFeeById(id: number): Promise<ShippingFee> {
    const pool = getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT *
        FROM shipping_fees
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, "Shipping fee not found");
    }

    return result.recordset[0];
  }

  /**
   * Create shipping fee
   */
  static async createShippingFee(
    data: CreateShippingFeeData
  ): Promise<ShippingFee> {
    const pool = getPool();
    const result = await pool
      .request()
      .input("governorate_name_ar", sql.NVarChar(255), data.governorate_name_ar)
      .input("governorate_name_en", sql.NVarChar(255), data.governorate_name_en)
      .input("fee", sql.Decimal(10, 2), data.fee)
      .input("is_active", sql.Bit, data.is_active !== undefined ? data.is_active : true)
      .query(`
        INSERT INTO shipping_fees (governorate_name_ar, governorate_name_en, fee, is_active)
        OUTPUT INSERTED.*
        VALUES (@governorate_name_ar, @governorate_name_en, @fee, @is_active)
      `);

    return result.recordset[0];
  }

  /**
   * Update shipping fee
   */
  static async updateShippingFee(
    id: number,
    data: UpdateShippingFeeData
  ): Promise<ShippingFee> {
    const pool = getPool();
    const updates: string[] = [];
    const request = pool.request().input("id", sql.Int, id);

    if (data.governorate_name_ar !== undefined) {
      updates.push("governorate_name_ar = @governorate_name_ar");
      request.input("governorate_name_ar", sql.NVarChar(255), data.governorate_name_ar);
    }

    if (data.governorate_name_en !== undefined) {
      updates.push("governorate_name_en = @governorate_name_en");
      request.input("governorate_name_en", sql.NVarChar(255), data.governorate_name_en);
    }

    if (data.fee !== undefined) {
      updates.push("fee = @fee");
      request.input("fee", sql.Decimal(10, 2), data.fee);
    }

    if (data.is_active !== undefined) {
      updates.push("is_active = @is_active");
      request.input("is_active", sql.Bit, data.is_active);
    }

    if (updates.length === 0) {
      throw new ApiError(400, "No fields to update");
    }

    updates.push("updated_at = GETDATE()");

    const result = await request.query(`
      UPDATE shipping_fees
      SET ${updates.join(", ")}
      OUTPUT INSERTED.*
      WHERE id = @id
    `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, "Shipping fee not found");
    }

    return result.recordset[0];
  }

  /**
   * Delete shipping fee
   */
  static async deleteShippingFee(id: number): Promise<void> {
    const pool = getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM shipping_fees WHERE id = @id");

    if (result.rowsAffected[0] === 0) {
      throw new ApiError(404, "Shipping fee not found");
    }
  }

  /**
   * Get all Egyptian governorates (static list)
   */
  static getEgyptianGovernorates(): Array<{ ar: string; en: string }> {
    return [
      { ar: "القاهرة", en: "Cairo" },
      { ar: "الجيزة", en: "Giza" },
      { ar: "الإسكندرية", en: "Alexandria" },
      { ar: "الدقهلية", en: "Dakahlia" },
      { ar: "البحيرة", en: "Beheira" },
      { ar: "المنيا", en: "Minya" },
      { ar: "القليوبية", en: "Qalyubia" },
      { ar: "سوهاج", en: "Sohag" },
      { ar: "أسيوط", en: "Asyut" },
      { ar: "الشرقية", en: "Sharqia" },
      { ar: "المنوفية", en: "Monufia" },
      { ar: "كفر الشيخ", en: "Kafr El Sheikh" },
      { ar: "الغربية", en: "Gharbia" },
      { ar: "بني سويف", en: "Beni Suef" },
      { ar: "قنا", en: "Qena" },
      { ar: "أسوان", en: "Aswan" },
      { ar: "الأقصر", en: "Luxor" },
      { ar: "البحر الأحمر", en: "Red Sea" },
      { ar: "الوادي الجديد", en: "New Valley" },
      { ar: "مطروح", en: "Matruh" },
      { ar: "شمال سيناء", en: "North Sinai" },
      { ar: "جنوب سيناء", en: "South Sinai" },
      { ar: "الإسماعيلية", en: "Ismailia" },
      { ar: "بورسعيد", en: "Port Said" },
      { ar: "السويس", en: "Suez" },
      { ar: "دمياط", en: "Damietta" },
      { ar: "الفيوم", en: "Faiyum" },
    ];
  }
}

