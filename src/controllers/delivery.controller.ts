import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { DeliveryService } from "../services/delivery.service";
import { asyncHandler } from "../middleware/error.middleware";

export class DeliveryController {
  // Calculate delivery fee
  static calculateDeliveryFee = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { user_latitude, user_longitude, branch_id } = req.body;

      const result = await DeliveryService.calculateDeliveryFee({
        user_latitude,
        user_longitude,
        branch_id,
      });

      res.json({
        success: true,
        data: result,
      });
    }
  );

  // Get all delivery fee configurations (admin)
  static getDeliveryFeeConfigs = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const configs = await DeliveryService.getDeliveryFeeConfigs();

      res.json({
        success: true,
        data: { configs },
      });
    }
  );

  // Create delivery fee configuration (admin)
  static createDeliveryFeeConfig = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const config = await DeliveryService.createDeliveryFeeConfig(req.body);

      res.status(201).json({
        success: true,
        message: "Delivery fee configuration created successfully",
        data: { config },
      });
    }
  );

  // Update delivery fee configuration (admin)
  static updateDeliveryFeeConfig = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { id } = req.params;

      // Log the received data for debugging
      console.log("Update delivery fee config request:", {
        id,
        body: req.body,
        bodyType: typeof req.body,
        keys: Object.keys(req.body),
      });

      const config = await DeliveryService.updateDeliveryFeeConfig(
        id,
        req.body
      );

      res.json({
        success: true,
        message: "Delivery fee configuration updated successfully",
        data: { config },
      });
    }
  );

  // Delete delivery fee configuration (admin)
  static deleteDeliveryFeeConfig = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { id } = req.params;
      await DeliveryService.deleteDeliveryFeeConfig(id);

      res.json({
        success: true,
        message: "Delivery fee configuration deleted successfully",
      });
    }
  );
}
