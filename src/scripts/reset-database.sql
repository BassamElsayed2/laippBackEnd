-- ⚠️  WARNING: This script will DELETE ALL DATA!
-- Use only in development

USE lapipDb;
GO

PRINT '⚠️  Starting database reset...';
GO

-- Drop tables in correct order (respecting foreign keys)
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'addresses')
    DROP TABLE addresses;
    
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'order_items')
    DROP TABLE order_items;
    
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'orders')
    DROP TABLE orders;
    
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'cart_items')
    DROP TABLE cart_items;
    
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'wishlists')
    DROP TABLE wishlists;
    
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'reviews')
    DROP TABLE reviews;
    
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'product-images')
    DROP TABLE product-images;
    
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'products')
    DROP TABLE products;
    
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'categories')
    DROP TABLE categories;
    
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'profiles')
    DROP TABLE profiles;
    
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'accounts')
    DROP TABLE accounts;
    
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'sessions')
    DROP TABLE sessions;
    
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
    DROP TABLE users;

PRINT '🗑️  All tables dropped';
GO

PRINT '✅ Database reset complete. Now run create-tables.sql';
GO

