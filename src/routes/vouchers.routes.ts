import { Router } from "express";
import {
  getAllVouchers,
  getVoucherById,
  createVoucher,
  createBulkVouchers,
  activateVoucher,
  deactivateVoucher,
  deleteVoucher,
  deactivateAllVouchers,
  deleteAllUnusedVouchers,
  deleteAllVouchers,
  getVoucherStats,
  findUserByPhone,
  getMyVouchers,
  validateVoucher,
} from "../controllers/vouchers.controller";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

// ==========================================
// User Routes (Authenticated)
// ==========================================

// Get current user's vouchers
router.get("/my-vouchers", authenticate, getMyVouchers);

// Validate a voucher code
router.post("/validate", authenticate, validateVoucher);

// ==========================================
// Admin Routes
// ==========================================

// Get all vouchers with pagination and filters
router.get("/admin", authenticate, requireAdmin, getAllVouchers);

// Get voucher statistics (MUST be before :id route)
router.get("/admin/stats", authenticate, requireAdmin, getVoucherStats);

// Find user by phone number (MUST be before :id route)
router.get(
  "/admin/user-by-phone/:phone",
  authenticate,
  requireAdmin,
  findUserByPhone
);

// Create a new voucher
router.post("/admin", authenticate, requireAdmin, createVoucher);

// Create vouchers for all users (bulk) (MUST be before :id route for POST)
router.post("/admin/bulk", authenticate, requireAdmin, createBulkVouchers);

// Deactivate all vouchers (MUST be before :id route)
router.put("/admin/deactivate-all", authenticate, requireAdmin, deactivateAllVouchers);

// Delete all unused vouchers (MUST be before :id route)
router.delete("/admin/delete-unused", authenticate, requireAdmin, deleteAllUnusedVouchers);

// Delete all vouchers (MUST be before :id route)
router.delete("/admin/delete-all", authenticate, requireAdmin, deleteAllVouchers);

// ==========================================
// Routes with :id parameter (MUST be LAST)
// ==========================================

// Get voucher by ID
router.get("/admin/:id", authenticate, requireAdmin, getVoucherById);

// Activate a voucher
router.put("/admin/:id/activate", authenticate, requireAdmin, activateVoucher);

// Deactivate a voucher
router.put(
  "/admin/:id/deactivate",
  authenticate,
  requireAdmin,
  deactivateVoucher
);

// Delete a voucher
router.delete("/admin/:id", authenticate, requireAdmin, deleteVoucher);

export default router;
