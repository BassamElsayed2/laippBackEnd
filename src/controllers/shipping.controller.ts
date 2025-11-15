import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { ShippingService } from "../services/shipping.service";
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../middleware/errorHandler";

/**
 * Get shipping fee by governorate name
 */
export const getShippingFee = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { governorate } = req.query;

    if (!governorate) {
      throw new ApiError(400, "Governorate name is required");
    }

    const fee = await ShippingService.getShippingFeeByGovernorate(
      governorate as string
    );

    // If fee is null, governorate is not available for shipping
    if (fee === null) {
      return res.json({
        success: false,
        message: "Shipping is not available for this governorate",
        data: {
          governorate: governorate as string,
          fee: null,
        },
      });
    }

    res.json({
      success: true,
      data: {
        governorate: governorate as string,
        fee,
      },
    });
  }
);

/**
 * Get all shipping fees (admin)
 */
export const getAllShippingFees = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const fees = await ShippingService.getAllShippingFees();

    res.json({
      success: true,
      data: fees,
    });
  }
);

/**
 * Get active shipping fees only
 */
export const getActiveShippingFees = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const fees = await ShippingService.getActiveShippingFees();

    res.json({
      success: true,
      data: fees,
    });
  }
);

/**
 * Get shipping fee by ID (admin)
 */
export const getShippingFeeById = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const fee = await ShippingService.getShippingFeeById(parseInt(id));

    res.json({
      success: true,
      data: fee,
    });
  }
);

/**
 * Create shipping fee (admin)
 */
export const createShippingFee = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { governorate_name_ar, governorate_name_en, fee, is_active } = req.body;

    if (!governorate_name_ar || !governorate_name_en || fee === undefined) {
      throw new ApiError(
        400,
        "governorate_name_ar, governorate_name_en, and fee are required"
      );
    }

    const shippingFee = await ShippingService.createShippingFee({
      governorate_name_ar,
      governorate_name_en,
      fee: parseFloat(fee),
      is_active,
    });

    res.status(201).json({
      success: true,
      message: "Shipping fee created successfully",
      data: shippingFee,
    });
  }
);

/**
 * Update shipping fee (admin)
 */
export const updateShippingFee = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { governorate_name_ar, governorate_name_en, fee, is_active } = req.body;

    const shippingFee = await ShippingService.updateShippingFee(parseInt(id), {
      governorate_name_ar,
      governorate_name_en,
      fee: fee !== undefined ? parseFloat(fee) : undefined,
      is_active,
    });

    res.json({
      success: true,
      message: "Shipping fee updated successfully",
      data: shippingFee,
    });
  }
);

/**
 * Delete shipping fee (admin)
 */
export const deleteShippingFee = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    await ShippingService.deleteShippingFee(parseInt(id));

    res.json({
      success: true,
      message: "Shipping fee deleted successfully",
    });
  }
);

/**
 * Get Egyptian governorates list
 */
export const getGovernorates = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const governorates = ShippingService.getEgyptianGovernorates();

    res.json({
      success: true,
      data: governorates,
    });
  }
);

