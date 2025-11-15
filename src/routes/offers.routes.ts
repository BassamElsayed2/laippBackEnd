import { Router } from "express";
import { OffersController } from "../controllers/offers.controller";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.get("/", OffersController.getAllOffers);
router.get("/:id", OffersController.getOfferById);

// Admin routes
router.post("/", authMiddleware, adminMiddleware, OffersController.createOffer);
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  OffersController.updateOffer
);
router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  OffersController.deleteOffer
);

export default router;
