/**
 * Script to create an admin user with properly hashed password
 * 
 * Usage:
 *   npm run create-admin
 * 
 * Or:
 *   npx ts-node src/scripts/create-admin-user.ts
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import sql from 'mssql';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdminUser() {
  try {
    console.log('\n==============================================');
    console.log('    إنشاء مستخدم Admin للداشبورد');
    console.log('==============================================\n');

    // Get admin details from user
    const email = await question('البريد الإلكتروني للـ Admin: ');
    const password = await question('كلمة المرور: ');
    const name = await question('الاسم (اختياري): ') || 'Admin User';
    const phone = await question('رقم الهاتف (اختياري): ') || null;

    if (!email || !password) {
      console.error('❌ البريد الإلكتروني وكلمة المرور مطلوبان!');
      rl.close();
      process.exit(1);
    }

    if (password.length < 6) {
      console.error('❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل!');
      rl.close();
      process.exit(1);
    }

    console.log('\n⏳ جارٍ الاتصال بقاعدة البيانات...\n');

    // Connect to database
    const config: sql.config = {
      server: process.env.DB_SERVER!,
      database: process.env.DB_DATABASE!,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
      },
    };

    const pool = await sql.connect(config);

    // Check if email already exists
    const existingUser = await pool
      .request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id, role FROM users WHERE email = @email');

    if (existingUser.recordset.length > 0) {
      const user = existingUser.recordset[0];
      console.log(`⚠️  المستخدم موجود بالفعل: ${email}`);
      console.log(`   الدور الحالي: ${user.role}\n`);
      
      const update = await question('هل تريد تحديث الدور إلى admin؟ (y/n): ');
      
      if (update.toLowerCase() === 'y' || update.toLowerCase() === 'yes') {
        await pool
          .request()
          .input('userId', sql.UniqueIdentifier, user.id)
          .query("UPDATE users SET role = 'admin', updated_at = GETDATE() WHERE id = @userId");
        
        console.log('\n✅ تم تحديث المستخدم إلى admin بنجاح!\n');
      } else {
        console.log('\n❌ تم الإلغاء\n');
      }
      
      await pool.close();
      rl.close();
      process.exit(0);
    }

    console.log('⏳ جارٍ إنشاء المستخدم...\n');

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate UUIDs
    const userId = uuidv4();
    const accountId = uuidv4();
    const profileId = uuidv4();

    // Create user
    await pool
      .request()
      .input('id', sql.UniqueIdentifier, userId)
      .input('email', sql.NVarChar, email)
      .input('name', sql.NVarChar, name)
      .input('role', sql.NVarChar, 'admin')
      .query(`
        INSERT INTO users (id, email, name, role, email_verified, created_at, updated_at)
        VALUES (@id, @email, @name, @role, 1, GETDATE(), GETDATE())
      `);

    console.log('✅ تم إنشاء User');

    // Create account
    await pool
      .request()
      .input('id', sql.UniqueIdentifier, accountId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('account_type', sql.NVarChar, 'email')
      .input('password_hash', sql.NVarChar, passwordHash)
      .query(`
        INSERT INTO accounts (id, user_id, account_type, password_hash, created_at)
        VALUES (@id, @user_id, @account_type, @password_hash, GETDATE())
      `);

    console.log('✅ تم إنشاء Account');

    // Create profile
    await pool
      .request()
      .input('id', sql.UniqueIdentifier, profileId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('full_name', sql.NVarChar, name)
      .input('phone', sql.NVarChar, phone)
      .query(`
        INSERT INTO profiles (id, user_id, full_name, phone, created_at, updated_at)
        VALUES (@id, @user_id, @full_name, @phone, GETDATE(), GETDATE())
      `);

    console.log('✅ تم إنشاء Profile');

    console.log('\n==============================================');
    console.log('✅ تم إنشاء مستخدم Admin بنجاح!');
    console.log('==============================================\n');
    console.log('📧 البريد الإلكتروني:', email);
    console.log('👤 الاسم:', name);
    console.log('🔑 الدور: admin');
    console.log('🆔 User ID:', userId);
    console.log('\n💡 يمكنك الآن تسجيل الدخول للداشبورد باستخدام هذه البيانات\n');

    await pool.close();
    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ خطأ:', error);
    rl.close();
    process.exit(1);
  }
}

// Run the script
createAdminUser();

