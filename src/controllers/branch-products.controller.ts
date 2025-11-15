import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { BranchProductsService } from "../services/branch-products.service";
import { asyncHandler } from "../middleware/error.middleware";

export class BranchProductsController {
  // ============================================
  // PRODUCT-BRANCH MANAGEMENT
  // ============================================

  /**
   * Get all branches for a product
   * GET /api/products/:productId/branches
   */
  static getProductBranches = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { productId } = req.params;

      const branches = await BranchProductsService.getProductBranches(
        productId
      );

      res.json({
        success: true,
        data: { branches },
      });
    }
  );

  /**
   * Update product branches
   * PUT /api/products/:productId/branches
   */
  static updateProductBranches = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { productId } = req.params;
      const { branch_ids } = req.body;

      await BranchProductsService.updateProductBranches(productId, branch_ids);

      res.json({
        success: true,
        message: "Product branches updated successfully",
      });
    }
  );

  /**
   * Add product to branches
   * POST /api/products/:productId/branches
   */
  static addProductToBranches = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { productId } = req.params;
      const { branch_ids } = req.body;

      await BranchProductsService.addProductToBranches(productId, branch_ids);

      res.json({
        success: true,
        message: "Product added to branches successfully",
      });
    }
  );

  /**
   * Remove product from branches
   * DELETE /api/products/:productId/branches
   */
  static removeProductFromBranches = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { productId } = req.params;
      const { branch_ids } = req.body;

      await BranchProductsService.removeProductFromBranches(
        productId,
        branch_ids
      );

      res.json({
        success: true,
        message: "Product removed from branches successfully",
      });
    }
  );

  // ============================================
  // CATEGORY-BRANCH MANAGEMENT
  // ============================================

  /**
   * Get all branches for a category
   * GET /api/categories/:categoryId/branches
   */
  static getCategoryBranches = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { categoryId } = req.params;

      const branches = await BranchProductsService.getCategoryBranches(
        categoryId
      );

      res.json({
        success: true,
        data: { branches },
      });
    }
  );

  /**
   * Update category branches
   * PUT /api/categories/:categoryId/branches
   */
  static updateCategoryBranches = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { categoryId } = req.params;
      const { branch_ids } = req.body;

      await BranchProductsService.updateCategoryBranches(
        categoryId,
        branch_ids
      );

      res.json({
        success: true,
        message: "Category branches updated successfully",
      });
    }
  );

  /**
   * Add category to branches
   * POST /api/categories/:categoryId/branches
   */
  static addCategoryToBranches = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { categoryId } = req.params;
      const { branch_ids } = req.body;

      await BranchProductsService.addCategoryToBranches(categoryId, branch_ids);

      res.json({
        success: true,
        message: "Category added to branches successfully",
      });
    }
  );

  /**
   * Remove category from branches
   * DELETE /api/categories/:categoryId/branches
   */
  static removeCategoryFromBranches = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { categoryId } = req.params;
      const { branch_ids } = req.body;

      await BranchProductsService.removeCategoryFromBranches(
        categoryId,
        branch_ids
      );

      res.json({
        success: true,
        message: "Category removed from branches successfully",
      });
    }
  );

  // ============================================
  // BRANCH-SPECIFIC QUERIES
  // ============================================

  /**
   * Get all products in a branch
   * GET /api/branches/:branchId/products
   */
  static getBranchProducts = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { branchId } = req.params;

      const products = await BranchProductsService.getBranchProducts(branchId);

      res.json({
        success: true,
        data: { products },
      });
    }
  );

  /**
   * Get all categories in a branch
   * GET /api/branches/:branchId/categories
   */
  static getBranchCategories = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { branchId } = req.params;

      const categories = await BranchProductsService.getBranchCategories(
        branchId
      );

      res.json({
        success: true,
        data: { categories },
      });
    }
  );
}
