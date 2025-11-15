/**
 * Migration Script: Migrate existing QR codes from local storage to Supabase
 *
 * Usage: node scripts/migrate-qr-to-supabase.js
 */

require("dotenv").config();
const sql = require("mssql");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs").promises;
const path = require("path");

// Database config
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_CERT === "true",
  },
};

// Supabase config
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BUCKET_NAME = "QrImages";

async function uploadBuffer(buffer, filename) {
  try {
    // Upload buffer to Supabase
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    return {
      url: urlData.publicUrl,
      path: filename,
    };
  } catch (error) {
    throw error;
  }
}

async function migrateQRCodes() {
  let pool;

  try {
    console.log("🚀 Starting QR Code migration to Supabase...\n");

    // Connect to database
    pool = await sql.connect(dbConfig);
    console.log("✅ Connected to database\n");

    // Get all QR codes from database
    const result = await pool.request().query(`
      SELECT * FROM branch_qrcodes WHERE is_active = 1
    `);

    const qrCodes = result.recordset;
    console.log(`📊 Found ${qrCodes.length} QR codes to migrate\n`);

    if (qrCodes.length === 0) {
      console.log("ℹ️  No QR codes to migrate");
      return;
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const qrCode of qrCodes) {
      try {
        console.log(`\n📝 Processing QR code for branch: ${qrCode.branch_id}`);

        // Check if URL is already a Supabase URL
        if (qrCode.qr_code_url.includes("supabase")) {
          console.log(`  ⏭️  Already using Supabase, skipping...`);
          skipCount++;
          continue;
        }

        // Construct local file path
        const localPath = path.join(
          process.cwd(),
          "uploads",
          "qrcodes",
          qrCode.qr_code_filename
        );

        // Check if file exists
        try {
          await fs.access(localPath);
        } catch {
          console.log(`  ⚠️  Local file not found: ${qrCode.qr_code_filename}`);
          errorCount++;
          continue;
        }

        // Read file
        const fileBuffer = await fs.readFile(localPath);
        console.log(`  ✅ Read local file: ${qrCode.qr_code_filename}`);

        // Upload to Supabase
        const uploadResult = await uploadBuffer(
          fileBuffer,
          qrCode.qr_code_filename
        );

        console.log(`  ✅ Uploaded to Supabase: ${uploadResult.url}`);

        // Update database
        await pool
          .request()
          .input("id", sql.UniqueIdentifier, qrCode.id)
          .input("qr_code_url", sql.NVarChar, uploadResult.url)
          .input("qr_code_filename", sql.NVarChar, uploadResult.path).query(`
            UPDATE branch_qrcodes
            SET qr_code_url = @qr_code_url,
                qr_code_filename = @qr_code_filename
            WHERE id = @id
          `);

        console.log(`  ✅ Updated database record`);

        // Optional: Delete local file
        // Uncomment the following lines if you want to delete local files after migration
        // await fs.unlink(localPath);
        // console.log(`  🗑️  Deleted local file`);

        successCount++;
      } catch (error) {
        console.error(`  ❌ Error processing QR code:`, error.message);
        errorCount++;
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 Migration Summary:");
    console.log("=".repeat(50));
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⏭️  Skipped (already migrated): ${skipCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📝 Total processed: ${qrCodes.length}`);
    console.log("=".repeat(50));

    if (successCount > 0) {
      console.log(
        "\n💡 Tip: You can now safely delete the local 'uploads/qrcodes' folder"
      );
      console.log("   if all QR codes were migrated successfully.");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    // Close database connection
    if (pool) {
      await pool.close();
      console.log("\n✅ Database connection closed");
    }
  }
}

// Run migration
migrateQRCodes()
  .then(() => {
    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  });
