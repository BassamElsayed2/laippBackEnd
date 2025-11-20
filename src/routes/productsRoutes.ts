import { Router } from "express";
import {
  getProducts,
  getProductById,
  getBestSellers,
  getLimitedOffers,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productsController";
import { authenticate, requireAdmin } from "../middleware/auth";
import { validate, createProductSchema } from "../middleware/validation";

const router = Router();

// Public routes
router.get("/", getProducts);
router.get("/best-sellers", getBestSellers);
router.get("/limited-offers", getLimitedOffers);
router.get("/:id", getProductById);

// Admin routes
router.post(
  "/",
  authenticate,
  requireAdmin,
  validate(createProductSchema),
  createProduct
);
router.put("/:id", authenticate, requireAdmin, updateProduct);
router.delete("/:id", authenticate, requireAdmin, deleteProduct);

export default router;
