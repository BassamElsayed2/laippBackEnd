import { pool } from "../src/config/database";

async function recreateBranchesTable() {
  try {
    console.log("Connecting to database...");
    await pool.connect();
    console.log("✅ Connected to database");

    // Drop existing table
    console.log("Dropping existing branches table if exists...");
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.tables WHERE name = 'branches')
      BEGIN
          DROP TABLE branches;
          PRINT 'Old branches table dropped';
      END
    `);
    console.log("✅ Old table dropped (if existed)");

    // Create new table with correct structure
    console.log("Creating branches table with correct structure...");
    await pool.request().query(`
      CREATE TABLE branches (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          name_ar NVARCHAR(100) NOT NULL,
          name_en NVARCHAR(100) NOT NULL,
          address_ar NVARCHAR(500) NOT NULL,
          address_en NVARCHAR(500) NOT NULL,
          phone NVARCHAR(20),
          email NVARCHAR(100),
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          is_active BIT DEFAULT 1,
          created_at DATETIME2 DEFAULT GETUTCDATE(),
          updated_at DATETIME2 DEFAULT GETUTCDATE()
      );

      -- Create indexes
      CREATE INDEX idx_branches_is_active ON branches(is_active);
      CREATE INDEX idx_branches_created_at ON branches(created_at DESC);
    `);
    console.log("✅ Branches table created successfully!");

    // Insert sample data
    console.log("Inserting sample data...");
    await pool.request().query(`
      INSERT INTO branches (name_ar, name_en, address_ar, address_en, phone, email, is_active)
      VALUES 
          (N'الفرع الرئيسي', 'Main Branch', N'شارع الملك فهد، الرياض', 'King Fahd Road, Riyadh', '+966 11 234 5678', 'main@restaurant.com', 1),
          (N'فرع الدمام', 'Dammam Branch', N'شارع الظهران، الدمام', 'Dhahran Street, Dammam', '+966 13 234 5678', 'dammam@restaurant.com', 1),
          (N'فرع جدة', 'Jeddah Branch', N'طريق المدينة، جدة', 'Madinah Road, Jeddah', '+966 12 234 5678', 'jeddah@restaurant.com', 1);
    `);
    console.log("✅ Sample branches inserted!");

    // Verify
    const result = await pool.request().query("SELECT * FROM branches");
    console.log(
      `\n✅ All done! Found ${result.recordset.length} branches in the table.`
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

recreateBranchesTable();
