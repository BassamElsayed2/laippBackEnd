import { createClient } from '@supabase/supabase-js';
import { connectDB, sql } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface MigrationStats {
  table: string;
  success: number;
  failed: number;
  total: number;
}

const stats: MigrationStats[] = [];

/**
 * Migrate categories
 */
async function migrateCategories() {
  console.log('📦 Migrating categories...');
  const stat: MigrationStats = { table: 'categories', success: 0, failed: 0, total: 0 };

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*');

    if (error) throw error;

    stat.total = data?.length || 0;
    const pool = await connectDB();

    for (const category of data || []) {
      try {
        await pool
          .request()
          .input('id', sql.Int, category.id)
          .input('name_ar', sql.NVarChar, category.name_ar)
          .input('name_en', sql.NVarChar, category.name_en)
          .input('image_url', sql.NVarChar(sql.MAX), category.image_url || null)
          .query(`
            IF NOT EXISTS (SELECT 1 FROM categories WHERE id = @id)
            BEGIN
              SET IDENTITY_INSERT categories ON;
              INSERT INTO categories (id, name_ar, name_en, image_url)
              VALUES (@id, @name_ar, @name_en, @image_url);
              SET IDENTITY_INSERT categories OFF;
            END
          `);

        stat.success++;
      } catch (error) {
        console.error(`Failed to migrate category ${category.id}:`, error);
        stat.failed++;
      }
    }

    stats.push(stat);
    console.log(`✅ Categories: ${stat.success}/${stat.total} migrated`);
  } catch (error) {
    console.error('❌ Error migrating categories:', error);
    stats.push(stat);
  }
}

/**
 * Migrate products
 */
async function migrateProducts() {
  console.log('📦 Migrating products...');
  const stat: MigrationStats = { table: 'products', success: 0, failed: 0, total: 0 };

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*');

    if (error) throw error;

    stat.total = data?.length || 0;
    const pool = await connectDB();

    for (const product of data || []) {
      try {
        // Convert images array to JSON string
        const imagesJson = Array.isArray(product.images) 
          ? JSON.stringify(product.images) 
          : product.images;

        // Generate a new GUID or use existing if valid
        let productId;
        try {
          // Try to parse if it's already a valid GUID
          productId = product.id;
          await pool.request()
            .input('testId', sql.UniqueIdentifier, productId)
            .query('SELECT @testId');
        } catch {
          // If not valid GUID, generate new one
          productId = undefined; // Let SQL Server generate new GUID
        }

        const request = pool.request()
          .input('title', sql.NVarChar, product.title)
          .input('name_ar', sql.NVarChar, product.name_ar || null)
          .input('name_en', sql.NVarChar, product.name_en || null)
          .input('description_ar', sql.NVarChar(sql.MAX), product.description_ar || null)
          .input('description_en', sql.NVarChar(sql.MAX), product.description_en || null)
          .input('price', sql.Decimal(10, 2), product.price)
          .input('offer_price', sql.Decimal(10, 2), product.offer_price || null)
          .input('images', sql.NVarChar(sql.MAX), imagesJson || null)
          .input('category_id', sql.Int, product.category_id || null)
          .input('stock_quantity', sql.Int, product.stock_quantity || 0)
          .input('is_best_seller', sql.Bit, product.is_best_seller || false)
          .input('limited_time_offer', sql.Bit, product.limited_time_offer || false)
          .input('created_at', sql.DateTime2, product.created_at || new Date());

        let query;
        if (productId) {
          request.input('id', sql.UniqueIdentifier, productId);
          query = `
            IF NOT EXISTS (SELECT 1 FROM products WHERE id = @id)
            BEGIN
              INSERT INTO products (
                id, title, name_ar, name_en, description_ar, description_en,
                price, offer_price, images, category_id, stock_quantity,
                is_best_seller, limited_time_offer, created_at
              )
              VALUES (
                @id, @title, @name_ar, @name_en, @description_ar, @description_en,
                @price, @offer_price, @images, @category_id, @stock_quantity,
                @is_best_seller, @limited_time_offer, @created_at
              )
            END
          `;
        } else {
          query = `
            INSERT INTO products (
              title, name_ar, name_en, description_ar, description_en,
              price, offer_price, images, category_id, stock_quantity,
              is_best_seller, limited_time_offer, created_at
            )
            VALUES (
              @title, @name_ar, @name_en, @description_ar, @description_en,
              @price, @offer_price, @images, @category_id, @stock_quantity,
              @is_best_seller, @limited_time_offer, @created_at
            )
          `;
        }

        await request.query(query);

        stat.success++;
      } catch (error) {
        console.error(`Failed to migrate product ${product.id}:`, error);
        stat.failed++;
      }
    }

    stats.push(stat);
    console.log(`✅ Products: ${stat.success}/${stat.total} migrated`);
  } catch (error) {
    console.error('❌ Error migrating products:', error);
    stats.push(stat);
  }
}

/**
 * Migrate banners
 */
async function migrateBanners() {
  console.log('📦 Migrating banners...');
  const stat: MigrationStats = { table: 'banners', success: 0, failed: 0, total: 0 };

  try {
    const { data, error } = await supabase
      .from('banners')
      .select('*');

    if (error) throw error;

    stat.total = data?.length || 0;
    const pool = await connectDB();

    for (const banner of data || []) {
      try {
        await pool
          .request()
          .input('id', sql.Int, banner.id)
          .input('desc_ar', sql.NVarChar(sql.MAX), banner.desc_ar || null)
          .input('desc_en', sql.NVarChar(sql.MAX), banner.desc_en || null)
          .input('image', sql.NVarChar(sql.MAX), banner.image || null)
          .input('created_at', sql.DateTime2, banner.created_at || new Date())
          .query(`
            IF NOT EXISTS (SELECT 1 FROM banners WHERE id = @id)
            BEGIN
              SET IDENTITY_INSERT banners ON;
              INSERT INTO banners (id, desc_ar, desc_en, image, display_order, is_active, created_at)
              VALUES (@id, @desc_ar, @desc_en, @image, 0, 1, @created_at);
              SET IDENTITY_INSERT banners OFF;
            END
          `);

        stat.success++;
      } catch (error) {
        console.error(`Failed to migrate banner ${banner.id}:`, error);
        stat.failed++;
      }
    }

    stats.push(stat);
    console.log(`✅ Banners: ${stat.success}/${stat.total} migrated`);
  } catch (error) {
    console.error('❌ Error migrating banners:', error);
    stats.push(stat);
  }
}

/**
 * Migrate blogs
 */
async function migrateBlogs() {
  console.log('📦 Migrating blogs...');
  const stat: MigrationStats = { table: 'blogs', success: 0, failed: 0, total: 0 };

  try {
    const { data, error } = await supabase
      .from('blogs')
      .select('*');

    if (error) throw error;

    stat.total = data?.length || 0;
    const pool = await connectDB();

    for (const blog of data || []) {
      try {
        await pool
          .request()
          .input('id', sql.UniqueIdentifier, blog.id)
          .input('title_ar', sql.NVarChar, blog.title_ar || null)
          .input('title_en', sql.NVarChar, blog.title_en || null)
          .input('content_ar', sql.NVarChar(sql.MAX), blog.content_ar || null)
          .input('content_en', sql.NVarChar(sql.MAX), blog.content_en || null)
          .input('image', sql.NVarChar(sql.MAX), blog.image || null)
          .input('author', sql.NVarChar, blog.author || null)
          .input('status', sql.NVarChar, blog.status || 'draft')
          .input('created_at', sql.DateTime2, blog.created_at || new Date())
          .query(`
            IF NOT EXISTS (SELECT 1 FROM blogs WHERE id = @id)
            BEGIN
              INSERT INTO blogs (id, title_ar, title_en, content_ar, content_en, image, author, status, created_at)
              VALUES (@id, @title_ar, @title_en, @content_ar, @content_en, @image, @author, @status, @created_at)
            END
          `);

        stat.success++;
      } catch (error) {
        console.error(`Failed to migrate blog ${blog.id}:`, error);
        stat.failed++;
      }
    }

    stats.push(stat);
    console.log(`✅ Blogs: ${stat.success}/${stat.total} migrated`);
  } catch (error) {
    console.error('❌ Error migrating blogs:', error);
    stats.push(stat);
  }
}

/**
 * Migrate testimonials
 */
async function migrateTestimonials() {
  console.log('📦 Migrating testimonials...');
  const stat: MigrationStats = { table: 'testimonials', success: 0, failed: 0, total: 0 };

  try {
    const { data, error } = await supabase
      .from('testemonial') // Note the spelling from original
      .select('*');

    if (error) throw error;

    stat.total = data?.length || 0;
    const pool = await connectDB();

    for (const testimonial of data || []) {
      try {
        await pool
          .request()
          .input('id', sql.Int, testimonial.id)
          .input('name_ar', sql.NVarChar, testimonial.name_ar || null)
          .input('name_en', sql.NVarChar, testimonial.name_en || null)
          .input('message_ar', sql.NVarChar(sql.MAX), testimonial.message_ar || null)
          .input('message_en', sql.NVarChar(sql.MAX), testimonial.message_en || null)
          .input('image', sql.NVarChar(sql.MAX), testimonial.image || null)
          .input('created_at', sql.DateTime2, testimonial.created_at || new Date())
          .query(`
            IF NOT EXISTS (SELECT 1 FROM testimonials WHERE id = @id)
            BEGIN
              SET IDENTITY_INSERT testimonials ON;
              INSERT INTO testimonials (id, name_ar, name_en, message_ar, message_en, image, created_at)
              VALUES (@id, @name_ar, @name_en, @message_ar, @message_en, @image, @created_at);
              SET IDENTITY_INSERT testimonials OFF;
            END
          `);

        stat.success++;
      } catch (error) {
        console.error(`Failed to migrate testimonial ${testimonial.id}:`, error);
        stat.failed++;
      }
    }

    stats.push(stat);
    console.log(`✅ Testimonials: ${stat.success}/${stat.total} migrated`);
  } catch (error) {
    console.error('❌ Error migrating testimonials:', error);
    stats.push(stat);
  }
}

/**
 * Migrate branches
 */
async function migrateBranches() {
  console.log('📦 Migrating branches...');
  const stat: MigrationStats = { table: 'branches', success: 0, failed: 0, total: 0 };

  try {
    const { data, error } = await supabase
      .from('branches')
      .select('*');

    if (error) throw error;

    stat.total = data?.length || 0;
    const pool = await connectDB();

    for (const branch of data || []) {
      try {
        await pool
          .request()
          .input('id', sql.Int, branch.id)
          .input('name_ar', sql.NVarChar, branch.name_ar || null)
          .input('name_en', sql.NVarChar, branch.name_en || null)
          .input('address_ar', sql.NVarChar, branch.address_ar || null)
          .input('address_en', sql.NVarChar, branch.address_en || null)
          .input('phone', sql.NVarChar, branch.phone || null)
          .input('created_at', sql.DateTime2, branch.created_at || new Date())
          .query(`
            IF NOT EXISTS (SELECT 1 FROM branches WHERE id = @id)
            BEGIN
              SET IDENTITY_INSERT branches ON;
              INSERT INTO branches (id, name_ar, name_en, address_ar, address_en, phone, created_at)
              VALUES (@id, @name_ar, @name_en, @address_ar, @address_en, @phone, @created_at);
              SET IDENTITY_INSERT branches OFF;
            END
          `);

        stat.success++;
      } catch (error) {
        console.error(`Failed to migrate branch ${branch.id}:`, error);
        stat.failed++;
      }
    }

    stats.push(stat);
    console.log(`✅ Branches: ${stat.success}/${stat.total} migrated`);
  } catch (error) {
    console.error('❌ Error migrating branches:', error);
    stats.push(stat);
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 Starting data migration from Supabase to SQL Server...\n');

  try {
    // Migrate in order (respecting foreign key constraints)
    await migrateCategories();
    await migrateProducts();
    await migrateBanners();
    await migrateBlogs();
    await migrateTestimonials();
    await migrateBranches();

    console.log('\n📊 Migration Summary:');
    console.log('═══════════════════════════════════════════');
    
    stats.forEach(stat => {
      const successRate = stat.total > 0 
        ? ((stat.success / stat.total) * 100).toFixed(2) 
        : '0.00';
      
      console.log(`${stat.table.padEnd(15)} | Success: ${stat.success.toString().padStart(4)} | Failed: ${stat.failed.toString().padStart(4)} | Total: ${stat.total.toString().padStart(4)} | Rate: ${successRate}%`);
    });

    console.log('═══════════════════════════════════════════');
    
    const totalSuccess = stats.reduce((sum, stat) => sum + stat.success, 0);
    const totalFailed = stats.reduce((sum, stat) => sum + stat.failed, 0);
    const totalRecords = stats.reduce((sum, stat) => sum + stat.total, 0);
    
    console.log(`\nTotal Records: ${totalRecords}`);
    console.log(`Successfully Migrated: ${totalSuccess}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`\n✅ Migration completed!`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
runMigration();

