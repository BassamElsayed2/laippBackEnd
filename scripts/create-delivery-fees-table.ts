import sql from "mssql";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

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

async function createDeliveryFeesTable() {
  let pool: sql.ConnectionPool | undefined;

  try {
    console.log("🔌 Connecting to SQL Server...");
    pool = await sql.connect(config);
    console.log("✅ Connected successfully!");

    // Read SQL file
    const sqlFilePath = path.join(
      __dirname,
      "../database/create-delivery-fees-table.sql"
    );
    console.log(`📄 Reading SQL file: ${sqlFilePath}`);

    const sqlContent = fs.readFileSync(sqlFilePath, "utf-8");

    // Split by GO statements
    const statements = sqlContent
      .split(/\nGO\s*\n/gi)
      .filter((stmt) => stmt.trim().length > 0);

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          console.log(
            `⚙️  Executing statement ${i + 1}/${statements.length}...`
          );
          await pool.request().query(statement);
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (error: any) {
          // Check if error is about object already exists
          if (error.message?.includes("already an object")) {
            console.log(
              `⚠️  Statement ${i + 1}: Object already exists, skipping...`
            );
          } else {
            throw error;
          }
        }
      }
    }

    console.log("\n🎉 Delivery fees table setup completed successfully!");
    console.log("\n📊 Verifying data...");

    // Verify the table was created and has data
    const result = await pool
      .request()
      .query("SELECT * FROM delivery_fees_config ORDER BY min_distance_km");

    console.log(
      `\n✅ Found ${result.recordset.length} delivery fee configurations:`
    );
    result.recordset.forEach((config: any) => {
      console.log(
        `   ${config.min_distance_km}-${config.max_distance_km} km: ${config.fee} EGP`
      );
    });
  } catch (error) {
    console.error("\n❌ Error setting up delivery fees table:", error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log("\n🔌 Database connection closed");
    }
  }
}

// Run the script
createDeliveryFeesTable();
