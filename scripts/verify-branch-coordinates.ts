import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

const config: sql.config = {
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_NAME || "elsawraDb",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "1433"),
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    enableArithAbort: true,
  },
};

async function verifyBranchCoordinates() {
  try {
    console.log("🔍 Checking branch coordinates...\n");

    const pool = await sql.connect(config);

    // Get all active branches
    const result = await pool.request().query(`
      SELECT 
        id,
        name_ar,
        name_en,
        address_ar,
        phone,
        lat,
        lng,
        latitude,
        longitude,
        is_active
      FROM branches
      WHERE is_active = 1
      ORDER BY name_ar
    `);

    const branches = result.recordset;

    if (branches.length === 0) {
      console.log("❌ No active branches found!");
      console.log("\n💡 Add a branch first:");
      console.log(`
INSERT INTO branches (
  id, name_ar, name_en, address_ar, address_en,
  phone, lat, lng, is_active
)
VALUES (
  NEWID(),
  N'الفرع الرئيسي',
  'Main Branch',
  N'الرياض، المملكة العربية السعودية',
  'Riyadh, Saudi Arabia',
  '0501234567',
  24.7136,
  46.6753,
  1
);
      `);
      await pool.close();
      return;
    }

    console.log(`✅ Found ${branches.length} active branch(es):\n`);

    let hasIssues = false;

    branches.forEach((branch, index) => {
      const lat = branch.lat || branch.latitude;
      const lng = branch.lng || branch.longitude;

      console.log(`${index + 1}. ${branch.name_ar} (${branch.name_en})`);
      console.log(`   ID: ${branch.id}`);
      console.log(`   Address: ${branch.address_ar}`);
      console.log(`   Phone: ${branch.phone || "N/A"}`);

      if (!lat || !lng) {
        console.log(`   ❌ Missing coordinates!`);
        console.log(`   🔧 Fix with:`);
        console.log(
          `   UPDATE branches SET lat = 24.7136, lng = 46.6753 WHERE id = '${branch.id}';`
        );
        hasIssues = true;
      } else {
        console.log(`   ✅ Coordinates: (${lat}, ${lng})`);
      }
      console.log("");
    });

    if (!hasIssues) {
      console.log("🎉 All branches have valid coordinates!");
      console.log("\n✅ Ready for the interactive map!");
    } else {
      console.log("\n⚠️ Some branches are missing coordinates.");
      console.log("Please update them using the SQL commands above.");
    }

    await pool.close();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

verifyBranchCoordinates();
