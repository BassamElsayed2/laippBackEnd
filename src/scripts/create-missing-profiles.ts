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

async function createMissingProfiles() {
  console.log('\n==============================================');
  console.log('🔧 إنشاء Profiles للمستخدمين المفقودة');
  console.log('==============================================\n');

  try {
    // Connect to database
    const pool = await sql.connect(dbConfig);
    console.log('✅ تم الاتصال بقاعدة البيانات\n');

    // Get users without profiles
    const usersWithoutProfiles = await pool.query(`
      SELECT u.id, u.email, u.name
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE p.id IS NULL
    `);

    const usersCount = usersWithoutProfiles.recordset.length;

    if (usersCount === 0) {
      console.log('✅ كل المستخدمين لديهم Profiles بالفعل!\n');
      await pool.close();
      process.exit(0);
    }

    console.log(`📊 عدد المستخدمين بدون Profiles: ${usersCount}\n`);
    console.log('🔄 جارٍ إنشاء Profiles...\n');

    let successCount = 0;
    let errorCount = 0;

    // Create profiles for each user
    for (const user of usersWithoutProfiles.recordset) {
      try {
        const profileId = uuidv4();
        
        await pool
          .request()
          .input('id', sql.UniqueIdentifier, profileId)
          .input('user_id', sql.UniqueIdentifier, user.id)
          .input('full_name', sql.NVarChar, user.name || user.email.split('@')[0])
          .query(`
            INSERT INTO profiles (id, user_id, full_name, created_at, updated_at)
            VALUES (@id, @user_id, @full_name, GETDATE(), GETDATE())
          `);

        console.log(`  ✓ Profile created for: ${user.email}`);
        successCount++;
      } catch (error: any) {
        console.error(`  ✗ Error for ${user.email}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n==============================================');
    console.log('✅ الإعداد اكتمل!');
    console.log('==============================================\n');
    console.log(`✅ Profiles تم إنشاؤها بنجاح: ${successCount}`);
    if (errorCount > 0) {
      console.log(`❌ فشل إنشاء: ${errorCount}`);
    }
    console.log('\n💡 يمكنك الآن تسجيل الدخول وسترى بيانات المستخدم في الـ Header!\n');

    await pool.close();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ خطأ:', error.message || error);
    console.error('\n📋 تفاصيل الخطأ:');
    console.error(error);
    console.log('\n💡 تأكد من:');
    console.log('   1. SQL Server يعمل');
    console.log('   2. بيانات الاتصال صحيحة في .env');
    console.log('   3. قاعدة البيانات lapipDb موجودة\n');
    process.exit(1);
  }
}

// Run the script
createMissingProfiles();

