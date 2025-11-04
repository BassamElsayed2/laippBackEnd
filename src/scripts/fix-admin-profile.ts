import sql from 'mssql';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const dbConfig: sql.config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'lapipDb',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function fixAdminProfile() {
  console.log('\n==============================================');
  console.log('🔧 إنشاء Admin Profile للمستخدمين الموجودين');
  console.log('==============================================\n');

  try {
    // Connect to database
    const pool = await sql.connect(dbConfig);
    console.log('✅ تم الاتصال بقاعدة البيانات\n');

    // Get all admin users without admin_profiles
    const adminsWithoutProfiles = await pool.query(`
      SELECT u.id, u.email, u.name
      FROM users u
      LEFT JOIN admin_profiles ap ON u.id = ap.user_id
      WHERE u.role = 'admin' AND ap.id IS NULL
    `);

    const adminsCount = adminsWithoutProfiles.recordset.length;

    if (adminsCount === 0) {
      console.log('✅ كل الأدمنز لديهم Profiles بالفعل!\n');
      await pool.close();
      process.exit(0);
    }

    console.log(`📊 عدد الأدمنز بدون Profiles: ${adminsCount}\n`);
    console.log('🔄 جارٍ إنشاء Profiles...\n');

    let successCount = 0;
    let errorCount = 0;

    // Create admin profiles for each admin
    for (const admin of adminsWithoutProfiles.recordset) {
      try {
        const profileId = uuidv4();
        
        await pool
          .request()
          .input('id', sql.UniqueIdentifier, profileId)
          .input('user_id', sql.UniqueIdentifier, admin.id)
          .input('full_name', sql.NVarChar, admin.name || admin.email.split('@')[0])
          .query(`
            INSERT INTO admin_profiles (id, user_id, full_name, created_at, updated_at)
            VALUES (@id, @user_id, @full_name, GETDATE(), GETDATE())
          `);

        console.log(`  ✓ Admin profile created for: ${admin.email}`);
        successCount++;
      } catch (error: any) {
        console.error(`  ✗ Error for ${admin.email}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n==============================================');
    console.log('✅ الإعداد اكتمل!');
    console.log('==============================================\n');
    console.log(`✅ Admin Profiles تم إنشاؤها بنجاح: ${successCount}`);
    if (errorCount > 0) {
      console.log(`❌ فشل إنشاء: ${errorCount}`);
    }
    console.log('\n💡 الآن يمكنك تسجيل الدخول للداشبورد وسترى البيانات!\n');

    await pool.close();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ خطأ:', error.message || error);
    console.error('\n📋 تفاصيل الخطأ:');
    console.error(error);
    console.log('\n💡 تأكد من:');
    console.log('   1. SQL Server يعمل');
    console.log('   2. بيانات الاتصال صحيحة في .env');
    console.log('   3. قاعدة البيانات lapipDb موجودة');
    console.log('   4. جدول admin_profiles موجود\n');
    process.exit(1);
  }
}

// Run the script
fixAdminProfile();

