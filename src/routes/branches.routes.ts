import express from "express";
import { branchesController } from "../controllers/branches.controller";
import { BranchProductsController } from "../controllers/branch-products.controller";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware";
import { validateParams } from "../middleware/validation.middleware";
import { z } from "zod";

const router = express.Router();

// Public routes (no authentication required)
router.get("/", branchesController.getAllBranches);
router.get("/:id", branchesController.getBranchById);

// Protected routes (admin only)
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  branchesController.createBranch
);

router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  branchesController.updateBranch
);

router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  branchesController.deleteBranch
);

// ============================================
// BRANCH-PRODUCTS AND BRANCH-CATEGORIES
// ============================================

// Get all products in a branch
router.get(
  "/:branchId/products",
  authMiddleware,
  adminMiddleware,
  validateParams(z.object({ branchId: z.string().uuid() })),
  BranchProductsController.getBranchProducts
);

// Get all categories in a branch
router.get(
  "/:branchId/categories",
  authMiddleware,
  adminMiddleware,
  validateParams(z.object({ branchId: z.string().uuid() })),
  BranchProductsController.getBranchCategories
);

export default router;
