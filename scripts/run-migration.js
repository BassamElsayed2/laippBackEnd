/**
 * Migration Script: Add new columns to customer_feedback table
 * Run this script once to update the database schema
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
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// If no user/password, use Windows Authentication
if (!config.user) {
  delete config.user;
  delete config.password;
  config.options.trustedConnection = true;
}

async function runMigration() {
  let pool;

  try {
    console.log("🔄 Connecting to database...");
    pool = await sql.connect(config);
    console.log("✅ Connected to database successfully!\n");

    console.log(
      "📋 Running migration: Add columns to customer_feedback table\n"
    );

    // Step 1: Make order_id nullable
    console.log("1️⃣ Making order_id nullable...");
    try {
      await pool.request().query(`
        ALTER TABLE customer_feedback
        ALTER COLUMN order_id UNIQUEIDENTIFIER NULL;
      `);
      console.log("   ✅ order_id is now nullable\n");
    } catch (error) {
      if (error.message.includes("already nullable") || error.number === 4922) {
        console.log("   ⚠️  order_id is already nullable (skipped)\n");
      } else {
        throw error;
      }
    }

    // Step 2: Make user_id nullable
    console.log("2️⃣ Making user_id nullable...");
    try {
      await pool.request().query(`
        ALTER TABLE customer_feedback
        ALTER COLUMN user_id UNIQUEIDENTIFIER NULL;
      `);
      console.log("   ✅ user_id is now nullable\n");
    } catch (error) {
      if (error.message.includes("already nullable") || error.number === 4922) {
        console.log("   ⚠️  user_id is already nullable (skipped)\n");
      } else {
        throw error;
      }
    }

    // Step 3: Add new columns
    console.log("3️⃣ Adding new columns...");
    try {
      await pool.request().query(`
        ALTER TABLE customer_feedback
        ADD 
            branch_id UNIQUEIDENTIFIER NULL,
            customer_name NVARCHAR(255) NULL,
            phone_number NVARCHAR(20) NULL,
            email NVARCHAR(255) NULL,
            reception_rating INT NULL CHECK (reception_rating BETWEEN 1 AND 4),
            cleanliness_rating INT NULL CHECK (cleanliness_rating BETWEEN 1 AND 4),
            catering_rating INT NULL CHECK (catering_rating BETWEEN 1 AND 4),
            opinion NVARCHAR(MAX) NULL;
      `);
      console.log("   ✅ New columns added successfully!\n");
    } catch (error) {
      if (error.message.includes("already exists") || error.number === 2705) {
        console.log("   ⚠️  Columns already exist (skipped)\n");
      } else {
        throw error;
      }
    }

    // Step 4: Add foreign key constraint
    console.log("4️⃣ Adding foreign key constraint...");
    try {
      await pool.request().query(`
        ALTER TABLE customer_feedback
        ADD CONSTRAINT FK_customer_feedback_branch_id 
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
      `);
      console.log("   ✅ Foreign key constraint added!\n");
    } catch (error) {
      if (error.message.includes("already exists") || error.number === 1769) {
        console.log("   ⚠️  Foreign key constraint already exists (skipped)\n");
      } else {
        throw error;
      }
    }

    // Step 5: Add index
    console.log("5️⃣ Adding index for branch_id...");
    try {
      await pool.request().query(`
        CREATE INDEX idx_customer_feedback_branch_id ON customer_feedback(branch_id);
      `);
      console.log("   ✅ Index created successfully!\n");
    } catch (error) {
      if (error.message.includes("already exists") || error.number === 1913) {
        console.log("   ⚠️  Index already exists (skipped)\n");
      } else {
        throw error;
      }
    }

    console.log("\n🎉 Migration completed successfully!");
    console.log("\n📝 IMPORTANT NOTES:");
    console.log(
      '   - The column "rating" will be used as "overall_rating" (1-4 scale)'
    );
    console.log('   - The column "comment" will be used as additional notes');
    console.log(
      '   - The column "food_quality" will be used as "quality_rating"'
    );
    console.log(
      '   - The column "delivery_speed" will be used as "service_speed_rating"'
    );
    console.log("\n✅ You can now test the feedback survey page!");
    console.log("   URL: http://localhost:3001/feedback-survey/[BRANCH_ID]\n");
  } catch (error) {
    console.error("\n❌ Migration failed!");
    console.error("Error:", error.message);
    console.error("\nFull error:", error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log("🔌 Database connection closed.");
    }
  }
}

// Run the migration
console.log("\n" + "=".repeat(60));
console.log("🗃️  Customer Feedback Table Migration");
console.log("=".repeat(60) + "\n");

runMigration()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Unexpected error:", error);
    process.exit(1);
  });
