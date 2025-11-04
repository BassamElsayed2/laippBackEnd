/**
 * Simple Admin Creator - No TypeScript, No Dependencies on other files
 * 
 * Usage: node create-admin-simple.js
 */

const bcrypt = require('bcryptjs');
const sql = require('mssql');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function createAdmin() {
  let pool;
  
  try {
    console.log('\n🚀 إنشاء مستخدم Admin - Simple Version\n');
    
    // Database config
    const config = {
      server: process.env.DB_SERVER || 'localhost',
      database: process.env.DB_DATABASE || 'lapipDb',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
      },
    };

    console.log('📡 الاتصال بقاعدة البيانات...');
    console.log('   Server:', config.server);
    console.log('   Database:', config.database);
    console.log('   User:', config.user);
    console.log('');

    pool = await sql.connect(config);
    console.log('✅ تم الاتصال بنجاح\n');

    // Admin credentials
    const adminEmail = 'admin@lapip.com';
    const adminPassword = 'Admin@123456';
    const adminName = 'Admin User';

    // Check if admin exists
    console.log('🔍 التحقق من وجود المستخدم...\n');
    
    const checkResult = await pool
      .request()
      .input('email', sql.NVarChar, adminEmail)
      .query('SELECT id, role FROM users WHERE email = @email');

    if (checkResult.recordset.length > 0) {
      const user = checkResult.recordset[0];
      console.log('⚠️  المستخدم موجود بالفعل!');
      console.log('   ID:', user.id);
      console.log('   Role:', user.role);
      
      if (user.role !== 'admin') {
        console.log('\n🔄 تحديث الدور إلى admin...');
        await pool
          .request()
          .input('userId', sql.UniqueIdentifier, user.id)
          .query("UPDATE users SET role = 'admin' WHERE id = @userId");
        console.log('✅ تم التحديث بنجاح!\n');
      }
      
      console.log('\n📧 Email:', adminEmail);
      console.log('🔑 Password:', adminPassword);
      console.log('');
    } else {
      console.log('✨ إنشاء مستخدم جديد...\n');
      
      // Generate IDs
      const userId = uuidv4();
      const accountId = uuidv4();
      const profileId = uuidv4();
      
      // Hash password
      console.log('🔐 تشفير كلمة المرور...');
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      console.log('✅ تم التشفير\n');

      // Create user
      console.log('👤 إنشاء User...');
      await pool
        .request()
        .input('id', sql.UniqueIdentifier, userId)
        .input('email', sql.NVarChar, adminEmail)
        .input('name', sql.NVarChar, adminName)
        .query(`
          INSERT INTO users (id, email, name, role, email_verified, created_at, updated_at)
          VALUES (@id, @email, @name, 'admin', 1, GETDATE(), GETDATE())
        `);
      console.log('✅ تم\n');

      // Create account
      console.log('🔑 إنشاء Account...');
      await pool
        .request()
        .input('id', sql.UniqueIdentifier, accountId)
        .input('user_id', sql.UniqueIdentifier, userId)
        .input('password_hash', sql.NVarChar, passwordHash)
        .query(`
          INSERT INTO accounts (id, user_id, account_type, password_hash, created_at)
          VALUES (@id, @user_id, 'email', @password_hash, GETDATE())
        `);
      console.log('✅ تم\n');

      // Create profile
      console.log('📝 إنشاء Profile...');
      await pool
        .request()
        .input('id', sql.UniqueIdentifier, profileId)
        .input('user_id', sql.UniqueIdentifier, userId)
        .input('full_name', sql.NVarChar, adminName)
        .query(`
          INSERT INTO profiles (id, user_id, full_name, created_at, updated_at)
          VALUES (@id, @user_id, @full_name, GETDATE(), GETDATE())
        `);
      console.log('✅ تم\n');

      console.log('═══════════════════════════════════════');
      console.log('✅ تم إنشاء مستخدم Admin بنجاح!');
      console.log('═══════════════════════════════════════\n');
      console.log('📧 Email:', adminEmail);
      console.log('🔑 Password:', adminPassword);
      console.log('🆔 User ID:', userId);
      console.log('\n💡 استخدم هذه البيانات لتسجيل الدخول للداشبورد\n');
    }

    await pool.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ خطأ:', error.message);
    console.error('\n💡 تأكد من:');
    console.error('   1. SQL Server يعمل');
    console.error('   2. قاعدة البيانات lapipDb موجودة');
    console.error('   3. الجداول تم إنشاؤها (شغّل create-tables.sql أولاً)');
    console.error('   4. بيانات الاتصال صحيحة في .env\n');
    
    if (pool) {
      await pool.close();
    }
    process.exit(1);
  }
}

// Run
createAdmin();

