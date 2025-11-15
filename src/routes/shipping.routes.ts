import { Router } from "express";
import {
  getShippingFee,
  getAllShippingFees,
  getActiveShippingFees,
  getShippingFeeById,
  createShippingFee,
  updateShippingFee,
  deleteShippingFee,
  getGovernorates,
} from "../controllers/shipping.controller";
import { optionalAuth, authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

// Public routes
router.get("/governorates", getGovernorates); // Get list of Egyptian governorates
router.get("/fee", optionalAuth, getShippingFee); // Get shipping fee by governorate name
router.get("/fees/active", optionalAuth, getActiveShippingFees); // Get active shipping fees

// Admin routes
router.get("/fees", authenticate, requireAdmin, getAllShippingFees);
router.get("/fees/:id", authenticate, requireAdmin, getShippingFeeById);
router.post("/fees", authenticate, requireAdmin, createShippingFee);
router.put("/fees/:id", authenticate, requireAdmin, updateShippingFee);
router.delete("/fees/:id", authenticate, requireAdmin, deleteShippingFee);

export default router;

