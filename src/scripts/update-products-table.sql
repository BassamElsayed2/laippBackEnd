-- Update Products Table Structure
USE lapipDb;
GO

-- Drop old products table if exists (BE CAREFUL - this deletes data!)
-- IF EXISTS (SELECT * FROM sys.tables WHERE name = 'products')
-- BEGIN
--     DROP TABLE products;
--     PRINT '✓ Old products table dropped';
-- END
-- GO

-- Create new products table with updated structure
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'products')
BEGIN
    CREATE TABLE products (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        name_ar NVARCHAR(500) NOT NULL,
        name_en NVARCHAR(500) NOT NULL,
        description_ar NVARCHAR(MAX),
        description_en NVARCHAR(MAX),
        price DECIMAL(10, 2) NOT NULL,
        offer_price DECIMAL(10, 2),
        images NVARCHAR(MAX), -- JSON array of image URLs
        quantity INT NOT NULL DEFAULT 0,
        category_id INT,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT '✅ Products table created successfully!';
END
ELSE
BEGIN
    PRINT '⚠️  Products table already exists';
    
    -- Add missing columns if table exists
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('products') AND name = 'name_ar')
    BEGIN
        ALTER TABLE products ADD name_ar NVARCHAR(500);
        PRINT '✓ Added name_ar column';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('products') AND name = 'name_en')
    BEGIN
        ALTER TABLE products ADD name_en NVARCHAR(500);
        PRINT '✓ Added name_en column';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('products') AND name = 'description_ar')
    BEGIN
        ALTER TABLE products ADD description_ar NVARCHAR(MAX);
        PRINT '✓ Added description_ar column';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('products') AND name = 'description_en')
    BEGIN
        ALTER TABLE products ADD description_en NVARCHAR(MAX);
        PRINT '✓ Added description_en column';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('products') AND name = 'quantity')
    BEGIN
        ALTER TABLE products ADD quantity INT DEFAULT 0;
        PRINT '✓ Added quantity column';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('products') AND name = 'offer_price')
    BEGIN
        ALTER TABLE products ADD offer_price DECIMAL(10, 2);
        PRINT '✓ Added offer_price column';
    END
END
GO

-- Create index for better performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_products_name_ar')
BEGIN
    CREATE INDEX IX_products_name_ar ON products(name_ar);
    PRINT '✓ Index on name_ar created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_products_name_en')
BEGIN
    CREATE INDEX IX_products_name_en ON products(name_en);
    PRINT '✓ Index on name_en created';
END
GO

PRINT '';
PRINT '==============================================';
PRINT '✅ Products Table Updated Successfully!';
PRINT '==============================================';
PRINT '';
PRINT '📋 Table Structure:';
PRINT '   - name_ar (Arabic name)';
PRINT '   - name_en (English name)';
PRINT '   - description_ar';
PRINT '   - description_en';
PRINT '   - price';
PRINT '   - offer_price';
PRINT '   - images (JSON array)';
PRINT '   - quantity';
PRINT '   - category_id';
PRINT '';
PRINT '📸 Supabase Bucket: product-images';
PRINT '';
GO


