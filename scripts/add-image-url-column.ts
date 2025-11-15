import sql from "mssql";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const config: sql.config = {
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_NAME || "elsawraDb",
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "",
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: true,
  },
};

async function addImageUrlColumn() {
  try {
    console.log("🔄 Connecting to database...");
    const pool = await sql.connect(config);

    console.log("✅ Connected to database");
    console.log("🔄 Checking if image_url column exists...");

    // Check if column exists
    const checkResult = await pool.request().query(`
      SELECT * FROM sys.columns 
      WHERE object_id = OBJECT_ID(N'admin_profiles') 
      AND name = 'image_url'
    `);

    if (checkResult.recordset.length === 0) {
      console.log("➕ Adding image_url column...");

      await pool.request().query(`
        ALTER TABLE admin_profiles
        ADD image_url NVARCHAR(500) NULL
      `);

      console.log(
        "✅ Column image_url added to admin_profiles table successfully!"
      );
    } else {
      console.log(
        "ℹ️  Column image_url already exists in admin_profiles table"
      );
    }

    await pool.close();
    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

addImageUrlColumn();
