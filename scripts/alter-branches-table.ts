import { pool } from "../src/config/database";

async function alterBranchesTable() {
  try {
    console.log("Connecting to database...");
    await pool.connect();
    console.log("✅ Connected to database");

    console.log("Adding missing columns to branches table...");

    // Add email column if not exists
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('branches') AND name = 'email')
        BEGIN
            ALTER TABLE branches ADD email NVARCHAR(100);
            PRINT 'Added email column';
        END
      `);
      console.log("✅ email column checked/added");
    } catch (err) {
      console.log("ℹ️  email column might already exist");
    }

    // Add latitude column if not exists
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('branches') AND name = 'latitude')
        BEGIN
            ALTER TABLE branches ADD latitude DECIMAL(10, 8);
            PRINT 'Added latitude column';
        END
      `);
      console.log("✅ latitude column checked/added");
    } catch (err) {
      console.log("ℹ️  latitude column might already exist");
    }

    // Add longitude column if not exists
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('branches') AND name = 'longitude')
        BEGIN
            ALTER TABLE branches ADD longitude DECIMAL(11, 8);
            PRINT 'Added longitude column';
        END
      `);
      console.log("✅ longitude column checked/added");
    } catch (err) {
      console.log("ℹ️  longitude column might already exist");
    }

    // Verify all columns
    const result = await pool.request().query(`
      SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('branches')
    `);
    console.log("\n📋 Current columns in branches table:");
    result.recordset.forEach((col) => console.log(`  - ${col.name}`));

    console.log("\n✅ All done!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

alterBranchesTable();
