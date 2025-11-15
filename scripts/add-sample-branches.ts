import { pool } from "../src/config/database";

async function addSampleBranches() {
  try {
    console.log("Connecting to database...");
    await pool.connect();
    console.log("✅ Connected");

    // Check current count
    const countBefore = await pool
      .request()
      .query("SELECT COUNT(*) as count FROM branches");
    console.log(`Current branches count: ${countBefore.recordset[0].count}`);

    // Insert sample data
    console.log("Inserting sample branches...");
    await pool.request().query(`
      INSERT INTO branches (name_ar, name_en, address_ar, address_en, phone, email, lat, lng)
      VALUES 
        (N'الفرع الرئيسي', 'Main Branch', N'شارع الملك فهد، الرياض', 'King Fahd Road, Riyadh', '+966 11 234 5678', 'main@restaurant.com', 24.7136, 46.6753),
        (N'فرع الدمام', 'Dammam Branch', N'شارع الظهران، الدمام', 'Dhahran Street, Dammam', '+966 13 234 5678', 'dammam@restaurant.com', 26.4207, 50.0888),
        (N'فرع جدة', 'Jeddah Branch', N'طريق المدينة، جدة', 'Madinah Road, Jeddah', '+966 12 234 5678', 'jeddah@restaurant.com', 21.5433, 39.1728)
    `);

    // Check count after
    const countAfter = await pool
      .request()
      .query("SELECT COUNT(*) as count FROM branches");
    console.log(
      `✅ Branches added! New count: ${countAfter.recordset[0].count}`
    );

    // Show branches
    const branches = await pool.request().query("SELECT * FROM branches");
    console.log("\n📋 Branches:");
    branches.recordset.forEach((b: any) => {
      console.log(`  - ${b.name_ar} (${b.name_en})`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

addSampleBranches();
