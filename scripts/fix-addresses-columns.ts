import { pool } from "../src/config/database";
import * as fs from "fs";
import * as path from "path";

async function fixAddressesColumns() {
  try {
    console.log("Connecting to database...");
    await pool.connect();

    console.log("Fixing addresses table column names...");

    const sql = fs.readFileSync(
      path.join(__dirname, "../database/fix-addresses-columns.sql"),
      "utf8"
    );

    await pool.request().query(sql);

    console.log("✅ Column fixes completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Column fixes failed:", error);
    process.exit(1);
  }
}

fixAddressesColumns();
