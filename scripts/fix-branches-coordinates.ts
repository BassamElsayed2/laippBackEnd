import { pool } from "../src/config/database";
import fs from "fs";
import path from "path";
import { logger } from "../src/utils/logger";

async function fixBranchesCoordinates() {
  try {
    logger.info("Starting branches coordinates fix (lat/lng only)...");

    // Read the SQL file
    const sqlFile = path.join(
      __dirname,
      "../database/fix-branches-coordinates.sql"
    );
    const sql = fs.readFileSync(sqlFile, "utf8");

    // Split by GO statements and execute each batch
    const batches = sql
      .split(/\r?\nGO\r?\n/)
      .filter((batch) => batch.trim().length > 0);

    for (const batch of batches) {
      if (batch.trim()) {
        await pool.request().query(batch);
      }
    }

    logger.info("✅ Branches coordinates fixed - using lat/lng only");
    process.exit(0);
  } catch (error) {
    logger.error("❌ Error fixing branches coordinates:", error);
    process.exit(1);
  }
}

fixBranchesCoordinates();
