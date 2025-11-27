import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { VouchersService } from "../services/vouchers.service";
import { ApiError, asyncHandler } from "../middleware/errorHandler";

/**
 * Get all vouchers with pagination and filters (Admin only)
 */
export const getAllVouchers = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { is_active, is_used, search } = req.query;

    const filters: any = {};
    if (is_active !== undefined) {
      filters.is_active = is_active === "true";
    }
    if (is_used !== undefined) {
      filters.is_used = is_used === "true";
    }
    if (search) {
      filters.search = search as string;
    }

    const { vouchers, total } = await VouchersService.getAllVouchers(
      page,
      limit,
      filters
    );

    res.json({
      success: true,
      data: {
        vouchers,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);

/**
 * Get voucher by ID (Admin only)
 */
export const getVoucherById = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const voucher = await VouchersService.getVoucherById(id);

    if (!voucher) {
      throw new ApiError(404, "Voucher not found");
    }

    res.json({
      success: true,
      data: voucher,
    });
  }
);

/**
 * Create a new voucher for a user (Admin only)
 */
export const createVoucher = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { phone_number, code, discount_type, discount_value, expires_at } =
      req.body;

    // Find user by phone number
    const user = await VouchersService.findUserByPhone(phone_number);

    if (!user) {
      throw new ApiError(404, "User not found with this phone number");
    }

    // Validate discount value
    if (discount_type === "percentage" && (discount_value <= 0 || discount_value > 100)) {
      throw new ApiError(400, "Percentage discount must be between 1 and 100");
    }

    if (discount_type === "fixed" && discount_value <= 0) {
      throw new ApiError(400, "Fixed discount must be greater than 0");
    }

    const voucher = await VouchersService.createVoucher({
      code,
      discount_type,
      discount_value,
      user_id: user.id,
      phone_number: user.phone,
      expires_at: expires_at ? new Date(expires_at) : null,
    });

    res.status(201).json({
      success: true,
      message: "Voucher created successfully",
      data: voucher,
    });
  }
);

/**
 * Activate a voucher (Admin only)
 */
export const activateVoucher = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const voucher = await VouchersService.getVoucherById(id);
    if (!voucher) {
      throw new ApiError(404, "Voucher not found");
    }

    const updatedVoucher = await VouchersService.activateVoucher(id);

    res.json({
      success: true,
      message: "Voucher activated successfully",
      data: updatedVoucher,
    });
  }
);

/**
 * Deactivate a voucher (Admin only)
 */
export const deactivateVoucher = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const voucher = await VouchersService.getVoucherById(id);
    if (!voucher) {
      throw new ApiError(404, "Voucher not found");
    }

    const updatedVoucher = await VouchersService.deactivateVoucher(id);

    res.json({
      success: true,
      message: "Voucher deactivated successfully",
      data: updatedVoucher,
    });
  }
);

/**
 * Delete a voucher (Admin only)
 */
export const deleteVoucher = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const voucher = await VouchersService.getVoucherById(id);
    if (!voucher) {
      throw new ApiError(404, "Voucher not found");
    }

    await VouchersService.deleteVoucher(id);

    res.json({
      success: true,
      message: "Voucher deleted successfully",
    });
  }
);

/**
 * Find user by phone number (Admin only)
 */
export const findUserByPhone = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { phone } = req.params;

    const user = await VouchersService.findUserByPhone(phone);

    if (!user) {
      throw new ApiError(404, "User not found with this phone number");
    }

    res.json({
      success: true,
      data: user,
    });
  }
);

/**
 * Create vouchers for all users (Admin only) - Bulk creation
 */
export const createBulkVouchers = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { discount_type, discount_value, expires_at, code_prefix } = req.body;

    // Validate discount value
    if (discount_type === "percentage" && (discount_value <= 0 || discount_value > 100)) {
      throw new ApiError(400, "Percentage discount must be between 1 and 100");
    }

    if (discount_type === "fixed" && discount_value <= 0) {
      throw new ApiError(400, "Fixed discount must be greater than 0");
    }

    const result = await VouchersService.createBulkVouchers({
      discount_type,
      discount_value,
      expires_at: expires_at ? new Date(expires_at) : null,
      code_prefix: code_prefix || undefined,
    });

    res.status(201).json({
      success: true,
      message: `Created ${result.created} vouchers successfully. ${result.failed} failed.`,
      data: {
        created: result.created,
        failed: result.failed,
        total_users: result.created + result.failed,
      },
    });
  }
);

/**
 * Deactivate all vouchers (Admin only)
 */
export const deactivateAllVouchers = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const deactivatedCount = await VouchersService.deactivateAllVouchers();

    res.json({
      success: true,
      message: `تم إلغاء تفعيل ${deactivatedCount} كود خصم`,
      data: {
        deactivated: deactivatedCount,
      },
    });
  }
);

/**
 * Delete all unused vouchers (Admin only)
 */
export const deleteAllUnusedVouchers = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const deletedCount = await VouchersService.deleteAllUnusedVouchers();

    res.json({
      success: true,
      message: `تم حذف ${deletedCount} كود خصم غير مستخدم`,
      data: {
        deleted: deletedCount,
      },
    });
  }
);

/**
 * Delete all vouchers (Admin only)
 */
export const deleteAllVouchers = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const deletedCount = await VouchersService.deleteAllVouchers();

    res.json({
      success: true,
      message: `تم حذف ${deletedCount} كود خصم`,
      data: {
        deleted: deletedCount,
      },
    });
  }
);

/**
 * Get voucher statistics (Admin only)
 */
export const getVoucherStats = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const stats = await VouchersService.getVoucherStats();

    res.json({
      success: true,
      data: stats,
    });
  }
);

/**
 * Get current user's vouchers (Authenticated user)
 */
export const getMyVouchers = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const vouchers = await VouchersService.getUserVouchers(req.user.id);

    res.json({
      success: true,
      data: vouchers,
    });
  }
);

/**
 * Validate a voucher code (Authenticated user)
 */
export const validateVoucher = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const { code, total_amount } = req.body;

    if (!code) {
      throw new ApiError(400, "Voucher code is required");
    }

    const result = await VouchersService.validateVoucher(code, req.user.id);

    if (!result.valid) {
      throw new ApiError(400, result.error || "Invalid voucher");
    }

    // Calculate discount if total_amount is provided
    let discount_amount = 0;
    if (total_amount && result.voucher) {
      discount_amount = VouchersService.calculateDiscount(
        result.voucher,
        total_amount
      );
    }

    res.json({
      success: true,
      data: {
        valid: true,
        voucher: result.voucher,
        discount_amount,
      },
    });
  }
);

/**
 * Apply voucher to an order (used internally during order creation)
 */
export const applyVoucherToOrder = async (
  voucherCode: string,
  userId: string,
  orderId: string
): Promise<{ success: boolean; voucher?: any; error?: string }> => {
  const result = await VouchersService.validateVoucher(voucherCode, userId);

  if (!result.valid || !result.voucher) {
    return { success: false, error: result.error };
  }

  // Mark voucher as used
  await VouchersService.useVoucher(result.voucher.id, orderId);

  return { success: true, voucher: result.voucher };
};

