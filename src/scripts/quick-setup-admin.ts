/**
 * Quick Setup Script - Creates tables and admin user in one go
 *
 * Usage: npm run quick-setup
 */

import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import sql from "mssql";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
dotenv.config();

async function quickSetup() {
  try {
    console.log("\n==============================================");
    console.log("    🚀 إعداد سريع - Quick Setup");
    console.log("==============================================\n");

    console.log("⏳ جارٍ الاتصال بقاعدة البيانات...\n");

    // Connect to database
    const config: sql.config = {
      server: process.env.DB_SERVER!,
      database: process.env.DB_DATABASE!,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      options: {
        encrypt: process.env.DB_ENCRYPT === "true",
        trustServerCertificate: process.env.DB_TRUST_CERT === "true",
      },
    };

    const pool = await sql.connect(config);
    console.log("✅ تم الاتصال بقاعدة البيانات\n");

    // Step 1: Check if tables exist
    console.log("📋 الخطوة 1: التحقق من الجداول...\n");

    const checkTables = await pool.request().query(`
      SELECT COUNT(*) as table_count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME IN ('users', 'admin_profiles')
    `);

    const tablesExist = checkTables.recordset[0].table_count >= 2;

    if (!tablesExist) {
      console.log("⚠️  الجداول غير موجودة. جارٍ إنشاء الجداول...\n");

      try {
        // Read and execute create-tables.sql
        const createTablesPath = path.join(__dirname, "create-tables.sql");
        console.log("📄 قراءة ملف:", createTablesPath);

        if (!fs.existsSync(createTablesPath)) {
          throw new Error(
            `ملف create-tables.sql غير موجود في: ${createTablesPath}`
          );
        }

        const createTablesSQL = fs.readFileSync(createTablesPath, "utf8");
        console.log("📝 تم قراءة الملف بنجاح\n");

        // Also read create-admin-profiles-table.sql
        const createAdminProfilesPath = path.join(
          __dirname,
          "create-admin-profiles-table.sql"
        );
        let createAdminProfilesSQL = "";
        if (fs.existsSync(createAdminProfilesPath)) {
          createAdminProfilesSQL = fs.readFileSync(
            createAdminProfilesPath,
            "utf8"
          );
          console.log("📝 تم قراءة ملف admin_profiles\n");
        }

        // Split by GO statements and execute each batch
        const batches = createTablesSQL
          .split(/^\s*GO\s*$/gim)
          .filter((batch) => batch.trim().length > 0);

        console.log(`📦 عدد الأوامر: ${batches.length}\n`);

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          if (batch.trim()) {
            try {
              await pool.request().query(batch);
              console.log(`✓ تم تنفيذ الأمر ${i + 1}/${batches.length}`);
            } catch (batchError: any) {
              console.error(`❌ خطأ في الأمر ${i + 1}:`, batchError.message);
              // Continue with next batch
            }
          }
        }

        console.log("\n✅ تم إنشاء الجداول بنجاح!\n");

        // Execute admin_profiles script if exists
        if (createAdminProfilesSQL) {
          console.log("📋 إنشاء جدول admin_profiles...\n");
          const adminBatches = createAdminProfilesSQL
            .split(/^\s*GO\s*$/gim)
            .filter((batch) => batch.trim().length > 0);

          for (let i = 0; i < adminBatches.length; i++) {
            const batch = adminBatches[i];
            if (batch.trim()) {
              try {
                await pool.request().query(batch);
              } catch (batchError: any) {
                console.error(`❌ خطأ في admin_profiles:`, batchError.message);
              }
            }
          }
          console.log("✅ تم إنشاء جدول admin_profiles!\n");
        }
      } catch (tableError: any) {
        console.error("❌ خطأ في إنشاء الجداول:", tableError.message);
        throw tableError;
      }
    } else {
      console.log("✅ الجداول موجودة بالفعل\n");
    }

    // Step 2: Create Admin User
    console.log("👤 الخطوة 2: إنشاء مستخدم Admin...\n");

    const adminEmail = "admin@lapip.com";
    const adminPassword = "Admin@123456";
    const adminName = "Admin User";

    // Check if admin already exists
    const existingAdmin = await pool
      .request()
      .input("email", sql.NVarChar, adminEmail)
      .query("SELECT id, role FROM users WHERE email = @email");

    if (existingAdmin.recordset.length > 0) {
      const user = existingAdmin.recordset[0];

      if (user.role === "admin") {
        console.log("✅ مستخدم Admin موجود بالفعل!\n");
        console.log("📧 البريد الإلكتروني:", adminEmail);
        console.log("🔑 كلمة المرور:", adminPassword);
        console.log("🆔 User ID:", user.id);
      } else {
        // Update to admin
        await pool
          .request()
          .input("userId", sql.UniqueIdentifier, user.id)
          .query(
            "UPDATE users SET role = 'admin', updated_at = GETDATE() WHERE id = @userId"
          );

        console.log("✅ تم تحديث المستخدم إلى admin!\n");
        console.log("📧 البريد الإلكتروني:", adminEmail);
        console.log("🔑 كلمة المرور:", adminPassword);
      }
    } else {
      // Create new admin user
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const userId = uuidv4();
      const accountId = uuidv4();
      const profileId = uuidv4();

      // Create user
      await pool
        .request()
        .input("id", sql.UniqueIdentifier, userId)
        .input("email", sql.NVarChar, adminEmail)
        .input("name", sql.NVarChar, adminName)
        .input("role", sql.NVarChar, "admin").query(`
          INSERT INTO users (id, email, name, role, email_verified, created_at, updated_at)
          VALUES (@id, @email, @name, @role, 1, GETDATE(), GETDATE())
        `);

      // Create account
      await pool
        .request()
        .input("id", sql.UniqueIdentifier, accountId)
        .input("user_id", sql.UniqueIdentifier, userId)
        .input("account_type", sql.NVarChar, "email")
        .input("password_hash", sql.NVarChar, passwordHash).query(`
          INSERT INTO accounts (id, user_id, account_type, password_hash, created_at)
          VALUES (@id, @user_id, @account_type, @password_hash, GETDATE())
        `);

      // Create admin profile
      await pool
        .request()
        .input("id", sql.UniqueIdentifier, profileId)
        .input("user_id", sql.UniqueIdentifier, userId)
        .input("full_name", sql.NVarChar, adminName).query(`
          INSERT INTO admin_profiles (id, user_id, full_name, created_at, updated_at)
          VALUES (@id, @user_id, @full_name, GETDATE(), GETDATE())
        `);

      console.log("✅ تم إنشاء مستخدم Admin بنجاح!\n");
      console.log("📧 البريد الإلكتروني:", adminEmail);
      console.log("🔑 كلمة المرور:", adminPassword);
      console.log("👤 الاسم:", adminName);
      console.log("🆔 User ID:", userId);
    }

    console.log("\n==============================================");
    console.log("✅ الإعداد اكتمل بنجاح!");
    console.log("==============================================\n");
    console.log("🎯 الخطوات التالية:\n");
    console.log("1. شغّل Backend:");
    console.log("   cd backend");
    console.log("   npm run dev\n");
    console.log("2. شغّل Dashboard:");
    console.log("   cd dashbored");
    console.log("   npm run dev\n");
    console.log("3. افتح المتصفح:");
    console.log("   http://localhost:3001\n");
    console.log("4. سجّل دخول:");
    console.log("   📧 Email:", adminEmail);
    console.log("   🔑 Password:", adminPassword);
    console.log("\n💡 احفظ هذه البيانات في مكان آمن!\n");

    await pool.close();
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ خطأ:", error.message || error);
    console.error("\n📋 تفاصيل الخطأ:");
    console.error(error);
    console.log("\n💡 تأكد من:");
    console.log("   1. SQL Server يعمل");
    console.log("   2. بيانات الاتصال صحيحة في .env");
    console.log("   3. قاعدة البيانات lapipDb موجودة");
    console.log("   4. ملف create-tables.sql موجود في مجلد scripts\n");
    process.exit(1);
  }
}

// Run the script
quickSetup();
