import { pool } from "../src/config/database";

async function createBranchesTable() {
  try {
    console.log("Connecting to database...");
    await pool.connect();
    console.log("✅ Connected to database");

    console.log("Creating branches table...");

    const query = `
      -- Create branches table
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'branches')
      BEGIN
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
          
          PRINT 'Branches table created successfully';
      END
      ELSE
      BEGIN
          PRINT 'Branches table already exists';
      END
    `;

    await pool.request().query(query);
    console.log("✅ Branches table created successfully!");

    // Insert sample data
    console.log("Inserting sample data...");
    const checkData = await pool
      .request()
      .query("SELECT COUNT(*) as count FROM branches");

    if (checkData.recordset[0].count === 0) {
      await pool.request().query(`
        INSERT INTO branches (name_ar, name_en, address_ar, address_en, phone, email, is_active)
        VALUES 
            (N'الفرع الرئيسي', 'Main Branch', N'شارع الملك فهد، الرياض', 'King Fahd Road, Riyadh', '+966 11 234 5678', 'main@restaurant.com', 1),
            (N'فرع الدمام', 'Dammam Branch', N'شارع الظهران، الدمام', 'Dhahran Street, Dammam', '+966 13 234 5678', 'dammam@restaurant.com', 1),
            (N'فرع جدة', 'Jeddah Branch', N'طريق المدينة، جدة', 'Madinah Road, Jeddah', '+966 12 234 5678', 'jeddah@restaurant.com', 1)
      `);
      console.log("✅ Sample branches inserted!");
    } else {
      console.log("ℹ️  Branches already exist, skipping sample data");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating branches table:", error);
    process.exit(1);
  }
}

createBranchesTable();
