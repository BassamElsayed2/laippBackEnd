import { Router } from "express";
import {
  migrateSupabaseImages,
  checkSupabaseUrls,
} from "../controllers/migration.controller";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/check", authenticate, requireAdmin, checkSupabaseUrls);
router.post("/run", authenticate, requireAdmin, migrateSupabaseImages);

export default router;
