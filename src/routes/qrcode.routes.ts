import express from "express";
import { qrcodeController } from "../controllers/qrcode.controller";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware";

const router = express.Router();

// Get all QR Codes (admin only) - Must be before /:branchId route
router.get(
  "/all",
  authMiddleware,
  adminMiddleware,
  qrcodeController.getAllQRCodes
);

// Generate QR Code for a branch (admin only)
router.post(
  "/generate/:branchId",
  authMiddleware,
  adminMiddleware,
  qrcodeController.generateQRCode
);

// Get QR Code for a branch (public or authenticated)
router.get("/:branchId", qrcodeController.getQRCode);

// Delete QR Code (admin only)
router.delete(
  "/:branchId",
  authMiddleware,
  adminMiddleware,
  qrcodeController.deleteQRCode
);

export default router;
