// Script لإنشاء مستخدم Admin عبر Backend API
import bcrypt from "bcryptjs";
import { pool } from "../src/config/database";
import dotenv from "dotenv";

dotenv.config();

interface AdminData {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role?: "super_admin" | "admin" | "manager";
}

async function createAdminUser(data: AdminData) {
  try {
    console.log("\n🔄 جاري إنشاء مستخدم Admin...\n");

    // 1. التحقق من أن المستخدم غير موجود
    const existingUser = await pool
      .request()
      .input("email", data.email)
      .query("SELECT id FROM users WHERE email = @email");

    if (existingUser.recordset.length > 0) {
      console.log("⚠️  المستخدم موجود بالفعل!");
      console.log("📧 Email:", data.email);
      return;
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);
    const userId = require("crypto").randomUUID();

    // 3. بدء Transaction
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      // إنشاء User
      await transaction
        .request()
        .input("id", userId)
        .input("email", data.email)
        .input("passwordHash", passwordHash).query(`
          INSERT INTO users (id, email, password_hash, email_verified, created_at, updated_at)
          VALUES (@id, @email, @passwordHash, 1, GETDATE(), GETDATE())
        `);

      // إنشاء Profile
      await transaction
        .request()
        .input("userId", userId)
        .input("fullName", data.full_name)
        .input("phone", data.phone).query(`
          INSERT INTO profiles (id, user_id, full_name, phone, phone_verified, created_at, updated_at)
          VALUES (NEWID(), @userId, @fullName, @phone, 1, GETDATE(), GETDATE())
        `);

      // إنشاء Admin Profile
      await transaction
        .request()
        .input("userId", userId)
        .input("role", data.role || "admin")
        .input("permissions", JSON.stringify(["all"])).query(`
          INSERT INTO admin_profiles (id, user_id, role, permissions, created_at, updated_at)
          VALUES (NEWID(), @userId, @role, @permissions, GETDATE(), GETDATE())
        `);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("❌ خطأ في إنشاء المستخدم:", error);
    throw error;
  } finally {
    await pool.close();
  }
}

// بيانات Admin المؤقت
const tempAdmin: AdminData = {
  email: "admin@foodcms.com",
  password: "Admin@123456",
  full_name: "مدير النظام",
  phone: "+201234567890",
  role: "super_admin",
};

// تشغيل Script
createAdminUser(tempAdmin)
  .then(() => {
    console.log("✅ Script تم بنجاح!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ فشل Script:", error);
    process.exit(1);
  });
