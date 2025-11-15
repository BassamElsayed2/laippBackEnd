/**
 * Check what data is actually saved in the latest feedback
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

async function checkFeedbackData() {
  let pool;

  try {
    pool = await sql.connect(config);

    const result = await pool.request().query(`
      SELECT TOP 1 
        id,
        branch_id,
        customer_name,
        phone_number,
        email,
        rating as overall_rating,
        reception_rating,
        delivery_speed as service_speed_rating,
        food_quality as quality_rating,
        cleanliness_rating,
        catering_rating,
        opinion,
        comment,
        created_at
      FROM customer_feedback
      ORDER BY created_at DESC
    `);

    if (result.recordset.length > 0) {
      const feedback = result.recordset[0];
      console.log("\n" + "=".repeat(70));
      console.log("📊 Latest Feedback Entry:");
      console.log("=".repeat(70));
      console.log("\n🆔 ID:", feedback.id);
      console.log("👤 Customer:", feedback.customer_name);
      console.log("📞 Phone:", feedback.phone_number);
      console.log("📧 Email:", feedback.email || "N/A");
      console.log("\n⭐ Ratings:");
      console.log(
        "  1. Overall Rating (rating):",
        feedback.overall_rating || "NULL"
      );
      console.log(
        "  2. Reception Rating:",
        feedback.reception_rating || "NULL"
      );
      console.log(
        "  3. Service Speed (delivery_speed):",
        feedback.service_speed_rating || "NULL"
      );
      console.log(
        "  4. Quality Rating (food_quality):",
        feedback.quality_rating || "NULL"
      );
      console.log(
        "  5. Cleanliness Rating:",
        feedback.cleanliness_rating || "NULL"
      );
      console.log("  6. Catering Rating:", feedback.catering_rating || "NULL");
      console.log("\n💬 Opinion:", feedback.opinion || "N/A");
      console.log("💬 Comment:", feedback.comment || "N/A");
      console.log(
        "\n📅 Created:",
        new Date(feedback.created_at).toLocaleString("ar-EG")
      );
      console.log("\n" + "=".repeat(70));

      // Check which ratings are NULL
      const nullRatings = [];
      if (!feedback.overall_rating) nullRatings.push("Overall Rating");
      if (!feedback.reception_rating) nullRatings.push("Reception");
      if (!feedback.service_speed_rating) nullRatings.push("Service Speed");
      if (!feedback.quality_rating) nullRatings.push("Quality");
      if (!feedback.cleanliness_rating) nullRatings.push("Cleanliness");
      if (!feedback.catering_rating) nullRatings.push("Catering");

      if (nullRatings.length > 0) {
        console.log("\n⚠️  NULL Ratings Found:");
        nullRatings.forEach((rating, index) => {
          console.log(`   ${index + 1}. ${rating}`);
        });
        console.log("\n");
      } else {
        console.log("\n✅ All ratings have values!\n");
      }
    } else {
      console.log("\n⚠️  No feedback found in database.\n");
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("\nFull error:", error);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

checkFeedbackData();
