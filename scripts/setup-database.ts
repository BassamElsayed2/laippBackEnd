import { pool } from "../src/config/database";
import { logger } from "../src/utils/logger";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const setupDatabase = async () => {
  try {
    logger.info("🚀 بدء إعداد Database...");

    // Connect to master database first to create food_cms
    const ConnectionPool = require("mssql").ConnectionPool;
    const masterPool = new ConnectionPool({
      server: process.env.DB_SERVER || "localhost",
      database: "master", // Connect to master to create database
      user: process.env.DB_USER || "sa",
      password: process.env.DB_PASSWORD || "",
      port: parseInt(process.env.DB_PORT || "1433"),
      options: {
        encrypt: process.env.DB_ENCRYPT === "true",
        trustServerCertificate:
          process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
      },
    });

    await masterPool.connect();
    logger.info("✅ تم الاتصال بـ SQL Server (master database)");

    // Create database if not exists
    const createDbSql = fs.readFileSync(
      path.join(__dirname, "../database/create-database.sql"),
      "utf-8"
    );

    const createDbBatches = createDbSql
      .split(/^\s*GO\s*$/gim)
      .map((batch) => batch.trim())
      .filter((batch) => batch.length > 0);

    for (const batch of createDbBatches) {
      await masterPool.request().query(batch);
    }

    await masterPool.close();
    logger.info("✅ تم إنشاء Database (إذا لم تكن موجودة)\n");

    // Now connect to food_cms database
    await pool.connect();
    logger.info("✅ تم الاتصال بـ food_cms database\n");

    // SQL files to execute in order
    const sqlFiles = [
      "schema.sql",
      "stored-procedures.sql",
      "create-temp-admin.sql",
    ];

    for (const fileName of sqlFiles) {
      const filePath = path.join(__dirname, "../database", fileName);

      if (!fs.existsSync(filePath)) {
        logger.error(`❌ الملف غير موجود: ${fileName}`);
        continue;
      }

      logger.info(`📄 تنفيذ: ${fileName}...`);

      // Read SQL file
      const sqlContent = fs.readFileSync(filePath, "utf-8");

      // Split by GO statements (SQL Server batch separator)
      const batches = sqlContent
        .split(/^\s*GO\s*$/gim)
        .map((batch) => batch.trim())
        .filter((batch) => batch.length > 0);

      logger.info(`   📝 عدد الأوامر: ${batches.length}`);

      // Execute each batch
      for (let i = 0; i < batches.length; i++) {
        try {
          await pool.request().query(batches[i]);
          // logger.info(`   ✅ تم تنفيذ الأمر ${i + 1}/${batches.length}`);
        } catch (error: any) {
          // Ignore certain errors (like "already exists")
          if (
            error.message.includes("already exists") ||
            error.message.includes("There is already")
          ) {
            logger.warn(`   ⚠️  الكائن موجود مسبقاً (تم تجاهله)`);
          } else {
            logger.error(`   ❌ خطأ في الأمر ${i + 1}:`, error.message);
            throw error;
          }
        }
      }

      logger.info(`   ✅ تم تنفيذ ${fileName} بنجاح!\n`);
    }

    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info("✅ تم إعداد Database بنجاح!");
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info("");
    logger.info("📧 معلومات تسجيل الدخول للداشبورد:");
    logger.info("   Email: admin@foodcms.com");
    logger.info("   Password: Admin@123456");
    logger.info("");
    logger.info("⚠️  غيّر كلمة المرور فوراً بعد تسجيل الدخول!");
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } catch (error) {
    logger.error("❌ فشل إعداد Database:", error);
    process.exit(1);
  } finally {
    await pool.close();
    logger.info("🔌 تم إغلاق الاتصال بـ Database");
  }
};

setupDatabase();
