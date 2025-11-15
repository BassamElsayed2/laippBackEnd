import { Router } from "express";
import { ComboOffersController } from "../controllers/comboOffers.controller";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.get("/", ComboOffersController.getAllComboOffers);
router.get("/:id", ComboOffersController.getComboOfferById);

// Admin routes
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  ComboOffersController.createComboOffer
);
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  ComboOffersController.updateComboOffer
);
router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  ComboOffersController.deleteComboOffer
);

export default router;
