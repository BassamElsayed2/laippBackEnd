import { pool } from "../src/config/database";

async function createBranchProductsAndCategories() {
  try {
    console.log("🚀 Starting migration...");
    console.log("Connecting to database...");
    await pool.connect();
    console.log("✅ Connected to database\n");

    // ============================================
    // 1️⃣ CREATE branch_products TABLE
    // ============================================
    console.log("1️⃣ Creating branch_products table...");

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'branch_products')
      BEGIN
          CREATE TABLE branch_products (
              id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
              branch_id UNIQUEIDENTIFIER NOT NULL,
              product_id UNIQUEIDENTIFIER NOT NULL,
              is_available BIT DEFAULT 1,
              created_at DATETIME2 DEFAULT GETUTCDATE(),
              updated_at DATETIME2 DEFAULT GETUTCDATE(),
              
              FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
              FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
              CONSTRAINT UQ_branch_product UNIQUE(branch_id, product_id)
          );
          
          CREATE INDEX idx_branch_products_branch ON branch_products(branch_id);
          CREATE INDEX idx_branch_products_product ON branch_products(product_id);
          CREATE INDEX idx_branch_products_available ON branch_products(is_available);
          
          PRINT '✅ branch_products table created successfully';
      END
      ELSE
      BEGIN
          PRINT '⚠️  branch_products table already exists';
      END
    `);

    console.log("✅ branch_products table created/verified\n");

    // ============================================
    // 2️⃣ CREATE branch_categories TABLE
    // ============================================
    console.log("2️⃣ Creating branch_categories table...");

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'branch_categories')
      BEGIN
          CREATE TABLE branch_categories (
              id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
              branch_id UNIQUEIDENTIFIER NOT NULL,
              category_id UNIQUEIDENTIFIER NOT NULL,
              is_available BIT DEFAULT 1,
              display_order INT DEFAULT 0,
              created_at DATETIME2 DEFAULT GETUTCDATE(),
              updated_at DATETIME2 DEFAULT GETUTCDATE(),
              
              FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
              FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
              CONSTRAINT UQ_branch_category UNIQUE(branch_id, category_id)
          );
          
          CREATE INDEX idx_branch_categories_branch ON branch_categories(branch_id);
          CREATE INDEX idx_branch_categories_category ON branch_categories(category_id);
          CREATE INDEX idx_branch_categories_available ON branch_categories(is_available);
          CREATE INDEX idx_branch_categories_order ON branch_categories(display_order);
          
          PRINT '✅ branch_categories table created successfully';
      END
      ELSE
      BEGIN
          PRINT '⚠️  branch_categories table already exists';
      END
    `);

    console.log("✅ branch_categories table created/verified\n");

    // ============================================
    // 3️⃣ MIGRATE EXISTING CATEGORIES
    // ============================================
    console.log("3️⃣ Migrating existing categories to all branches...");

    const categoriesResult = await pool.request().query(`
      -- إضافة كل التصنيفات القديمة لكل الفروع
      INSERT INTO branch_categories (branch_id, category_id, is_available, display_order)
      SELECT 
          b.id as branch_id,
          c.id as category_id,
          1 as is_available,
          0 as display_order
      FROM branches b
      CROSS JOIN categories c
      WHERE b.is_active = 1
        AND NOT EXISTS (
          -- تجنب التكرار لو السكريبت اتنفذ قبل كده
          SELECT 1 FROM branch_categories bc 
          WHERE bc.branch_id = b.id AND bc.category_id = c.id
        );
    `);

    const categoriesInserted = categoriesResult.rowsAffected[0];
    console.log(
      `✅ Migrated ${categoriesInserted} category-branch combinations\n`
    );

    // ============================================
    // 4️⃣ MIGRATE EXISTING PRODUCTS
    // ============================================
    console.log("4️⃣ Migrating existing products to all branches...");

    const productsResult = await pool.request().query(`
      -- إضافة كل المنتجات القديمة لكل الفروع
      INSERT INTO branch_products (branch_id, product_id, is_available)
      SELECT 
          b.id as branch_id,
          p.id as product_id,
          1 as is_available
      FROM branches b
      CROSS JOIN products p
      WHERE b.is_active = 1
        AND NOT EXISTS (
          -- تجنب التكرار لو السكريبت اتنفذ قبل كده
          SELECT 1 FROM branch_products bp 
          WHERE bp.branch_id = b.id AND bp.product_id = p.id
        );
    `);

    const productsInserted = productsResult.rowsAffected[0];
    console.log(
      `✅ Migrated ${productsInserted} product-branch combinations\n`
    );

    // ============================================
    // 5️⃣ SHOW SUMMARY
    // ============================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Migration completed successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("📊 Summary:");

    const summary = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM categories) as total_categories,
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM branches WHERE is_active = 1) as total_branches,
        (SELECT COUNT(*) FROM branch_categories) as total_category_combinations,
        (SELECT COUNT(*) FROM branch_products) as total_product_combinations
    `);

    const stats = summary.recordset[0];
    console.log(`   📁 Categories: ${stats.total_categories}`);
    console.log(`   📦 Products: ${stats.total_products}`);
    console.log(`   🏢 Active Branches: ${stats.total_branches}`);
    console.log(
      `   🔗 Category-Branch Combinations: ${stats.total_category_combinations}`
    );
    console.log(
      `   🔗 Product-Branch Combinations: ${stats.total_product_combinations}\n`
    );

    console.log(
      "💡 Note: All existing categories and products are now available in all branches."
    );
    console.log("   You can manage availability from the dashboard later.\n");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.close();
    console.log("🔌 Database connection closed");
  }
}

createBranchProductsAndCategories();
