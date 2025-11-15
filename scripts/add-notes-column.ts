import { pool } from "../src/config/database";
import * as fs from "fs";
import * as path from "path";

async function addNotesColumn() {
  try {
    console.log("Connecting to database...");
    await pool.connect();

    console.log("Adding notes column to addresses table...");

    const sql = fs.readFileSync(
      path.join(__dirname, "../database/add-notes-to-addresses.sql"),
      "utf8"
    );

    await pool.request().query(sql);

    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

addNotesColumn();
