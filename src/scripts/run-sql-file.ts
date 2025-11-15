import fs from 'fs';
import path from 'path';
import { connectDB, sql } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Run SQL file against the database
 */
async function runSqlFile(filePath: string) {
  try {
    // Read SQL file
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    // Connect to database
    const pool = await connectDB();
    
    // Split by GO statements and execute each batch
    const batches = sqlContent
      .split(/^\s*GO\s*$/gim)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0);
    
    console.log(`Found ${batches.length} batch(es) to execute`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`\nExecuting batch ${i + 1}/${batches.length}...`);
      
      try {
        await pool.request().query(batch);
        console.log(`✓ Batch ${i + 1} executed successfully`);
      } catch (error: any) {
        console.error(`✗ Error in batch ${i + 1}:`, error.message);
        // Continue with next batch even if one fails
      }
    }
    
    console.log('\n✅ SQL file execution completed!');
  } catch (error: any) {
    console.error('❌ Error running SQL file:', error.message);
    process.exit(1);
  }
}

// Get file path from command line argument or use default
const filePath = process.argv[2] || path.join(__dirname, 'create-shipping-fees-table.sql');

if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

console.log(`📄 Running SQL file: ${filePath}\n`);

runSqlFile(filePath)
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

