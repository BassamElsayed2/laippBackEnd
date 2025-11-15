import sql from "mssql";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables
dotenv.config();

const config: sql.config = {
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "YourStrong@Passw0rd",
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_NAME || "food_cms",
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: true,
  },
};

async function createQRCodeTable() {
  try {
    console.log("🔌 Connecting to database...");
    const pool = await sql.connect(config);

    // Read SQL file
    const sqlFilePath = path.join(
      __dirname,
      "..",
      "database",
      "create_branch_qrcodes_table.sql"
    );
    const sqlScript = fs.readFileSync(sqlFilePath, "utf-8");

    console.log("📝 Creating branch_qrcodes table...");

    // Split SQL script by GO statement (GO is not part of T-SQL, it's a batch separator)
    const batches = sqlScript
      .split(/\bGO\b/gi)
      .map((batch) => batch.trim())
      .filter((batch) => batch.length > 0);

    // Execute each batch separately
    for (const batch of batches) {
      await pool.request().query(batch);
    }

    console.log("✅ Table branch_qrcodes created successfully!");

    await pool.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating table:", error);
    process.exit(1);
  }
}

createQRCodeTable();
