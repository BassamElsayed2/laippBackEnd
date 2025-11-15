/**
 * Quick script to get a branch ID for testing the feedback survey
 */

const sql = require("mssql");
require("dotenv").config();

const config = {
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_NAME || "elsawraDb",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_CERT === "true",
    enableArithAbort: true,
  },
};

if (!config.user) {
  delete config.user;
  delete config.password;
  config.options.trustedConnection = true;
}

async function getBranchId() {
  let pool;

  try {
    pool = await sql.connect(config);

    const result = await pool.request().query(`
      SELECT TOP 1 id, name_ar, name_en, phone 
      FROM branches 
      WHERE is_active = 1
      ORDER BY created_at DESC;
    `);

    if (result.recordset.length > 0) {
      const branch = result.recordset[0];
      console.log("\n✅ Active Branch Found:");
      console.log("=".repeat(60));
      console.log(`Branch ID: ${branch.id}`);
      console.log(`Name (AR): ${branch.name_ar}`);
      console.log(`Name (EN): ${branch.name_en}`);
      console.log(`Phone: ${branch.phone}`);
      console.log("=".repeat(60));
      console.log("\n🔗 Feedback Survey URL:");
      console.log(`http://localhost:3001/feedback-survey/${branch.id}`);
      console.log("\n");
    } else {
      console.log("\n⚠️  No active branches found in the database.");
      console.log("Please create a branch first from the dashboard.\n");
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

getBranchId();
