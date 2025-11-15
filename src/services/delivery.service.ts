import { pool } from "../config/database";
import { ApiError } from "../middleware/error.middleware";
import { calculateDistance, findNearestBranch } from "../utils/distance";

export interface DeliveryFeeConfig {
  id: string;
  min_distance_km: number;
  max_distance_km: number;
  fee: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CalculateDeliveryFeeParams {
  user_latitude: number;
  user_longitude: number;
  branch_id?: string; // Branch ID selected by user
}

export interface CalculateDeliveryFeeResult {
  fee: number;
  distance_km: number;
  nearest_branch: {
    id: string;
    name_ar: string;
    name_en: string;
    address_ar: string;
    address_en: string;
  };
}

export class DeliveryService {
  // Calculate delivery fee based on distance
  static async calculateDeliveryFee(
    params: CalculateDeliveryFeeParams
  ): Promise<CalculateDeliveryFeeResult> {
    const { user_latitude, user_longitude, branch_id } = params;

    // Get all active branches or specific branch
    // Support both lat/lng and latitude/longitude column names
    let branchQuery = `
      SELECT id, name_ar, name_en, address_ar, address_en, 
             COALESCE(lat, latitude) as latitude,
             COALESCE(lng, longitude) as longitude
      FROM branches
      WHERE is_active = 1 
        AND (lat IS NOT NULL OR latitude IS NOT NULL)
        AND (lng IS NOT NULL OR longitude IS NOT NULL)
    `;

    const request = pool.request();

    if (branch_id) {
      branchQuery += " AND id = @branch_id";
      request.input("branch_id", branch_id);
    }

    const branchesResult = await request.query(branchQuery);

    if (branchesResult.recordset.length === 0) {
      throw new ApiError(
        404,
        branch_id
          ? "Branch not found or inactive"
          : "No active branches found with valid coordinates"
      );
    }

    // If branch_id provided, calculate distance to that specific branch
    // Otherwise, find nearest branch
    let nearest;
    if (branch_id) {
      // User selected a specific branch
      const branch = branchesResult.recordset[0];
      const distance = calculateDistance(
        user_latitude,
        user_longitude,
        branch.latitude,
        branch.longitude
      );
      nearest = { branch, distance };
    } else {
      // Find nearest branch (backward compatibility)
      nearest = findNearestBranch(
        user_latitude,
        user_longitude,
        branchesResult.recordset
      );
    }

    if (!nearest) {
      throw new ApiError(500, "Failed to calculate distance");
    }

    // Get active delivery fee configurations
    const configsResult = await pool.query(`
      SELECT *
      FROM delivery_fees_config
      WHERE is_active = 1
      ORDER BY min_distance_km
    `);

    if (configsResult.recordset.length === 0) {
      throw new ApiError(404, "No active delivery fee configurations found");
    }

    // Find the maximum delivery distance from all active configs
    const maxDeliveryDistance = Math.max(
      ...configsResult.recordset.map((c: any) => c.max_distance_km)
    );

    // Check if the customer's distance exceeds the maximum
    if (nearest.distance > maxDeliveryDistance) {
      throw new ApiError(
        400,
        `عذراً، التوصيل غير متاح لهذه المسافة (${nearest.distance.toFixed(
          2
        )} كم). أقصى مسافة توصيل هي ${maxDeliveryDistance} كم.`
      );
    }

    // Find the appropriate fee config for this distance
    const applicableConfig = configsResult.recordset.find(
      (config: any) =>
        nearest.distance >= config.min_distance_km &&
        nearest.distance <= config.max_distance_km
    );

    if (!applicableConfig) {
      throw new ApiError(
        404,
        `لم يتم العثور على رسوم توصيل لهذه المسافة (${nearest.distance.toFixed(
          2
        )} كم)`
      );
    }

    return {
      fee: applicableConfig.fee,
      distance_km: nearest.distance,
      nearest_branch: {
        id: nearest.branch.id,
        name_ar: nearest.branch.name_ar,
        name_en: nearest.branch.name_en,
        address_ar: nearest.branch.address_ar,
        address_en: nearest.branch.address_en,
      },
    };
  }

  // Get all delivery fee configurations
  static async getDeliveryFeeConfigs(): Promise<DeliveryFeeConfig[]> {
    const result = await pool.query(`
      SELECT *
      FROM delivery_fees_config
      ORDER BY min_distance_km
    `);

    return result.recordset;
  }

  // Create delivery fee configuration
  static async createDeliveryFeeConfig(config: {
    min_distance_km: number;
    max_distance_km: number;
    fee: number;
  }): Promise<DeliveryFeeConfig> {
    const result = await pool
      .request()
      .input("min_distance_km", config.min_distance_km)
      .input("max_distance_km", config.max_distance_km)
      .input("fee", config.fee).query(`
        INSERT INTO delivery_fees_config (min_distance_km, max_distance_km, fee)
        OUTPUT INSERTED.*
        VALUES (@min_distance_km, @max_distance_km, @fee)
      `);

    return result.recordset[0];
  }

  // Update delivery fee configuration
  static async updateDeliveryFeeConfig(
    id: string,
    config: {
      min_distance_km?: number;
      max_distance_km?: number;
      fee?: number;
      is_active?: boolean;
    }
  ): Promise<DeliveryFeeConfig> {
    const updates: string[] = [];
    const request = pool.request().input("id", id);

    // Helper function to check if value is valid (not null, undefined, or NaN)
    const isValidValue = (value: any): boolean => {
      return value !== undefined && value !== null && !Number.isNaN(value);
    };

    if (isValidValue(config.min_distance_km)) {
      updates.push("min_distance_km = @min_distance_km");
      request.input("min_distance_km", config.min_distance_km);
    }

    if (isValidValue(config.max_distance_km)) {
      updates.push("max_distance_km = @max_distance_km");
      request.input("max_distance_km", config.max_distance_km);
    }

    if (isValidValue(config.fee)) {
      updates.push("fee = @fee");
      request.input("fee", config.fee);
    }

    // Boolean can be false, so check explicitly for undefined/null
    if (config.is_active !== undefined && config.is_active !== null) {
      updates.push("is_active = @is_active");
      request.input("is_active", config.is_active);
    }

    if (updates.length === 0) {
      throw new ApiError(400, "No valid fields to update");
    }

    updates.push("updated_at = GETDATE()");

    const result = await request.query(`
      UPDATE delivery_fees_config
      SET ${updates.join(", ")}
      OUTPUT INSERTED.*
      WHERE id = @id
    `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, "Delivery fee configuration not found");
    }

    return result.recordset[0];
  }

  // Delete delivery fee configuration
  static async deleteDeliveryFeeConfig(id: string): Promise<void> {
    const result = await pool
      .request()
      .input("id", id)
      .query("DELETE FROM delivery_fees_config WHERE id = @id");

    if (result.rowsAffected[0] === 0) {
      throw new ApiError(404, "Delivery fee configuration not found");
    }
  }
}
