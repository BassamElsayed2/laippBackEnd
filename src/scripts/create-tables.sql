-- SQL Server Database Schema for lapipDb
-- Run this script to create all required tables

USE lapipDb;
GO

-- =====================================================
-- Users & Authentication Tables
-- =====================================================

-- Users table (for Better Auth)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    CREATE TABLE users (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        email NVARCHAR(255) NOT NULL UNIQUE,
        email_verified BIT DEFAULT 0,
        name NVARCHAR(255),
        role NVARCHAR(50) DEFAULT 'user', -- 'user', 'admin'
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Table users created';
END
GO

-- Sessions table (for Better Auth)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sessions')
BEGIN
    CREATE TABLE sessions (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        token NVARCHAR(500) NOT NULL UNIQUE,
        expires_at DATETIME2 NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    PRINT 'Table sessions created';
END
GO

-- Accounts table (for Better Auth - passwords & social login)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'accounts')
BEGIN
    CREATE TABLE accounts (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        account_type NVARCHAR(50) NOT NULL, -- 'email', 'oauth'
        provider NVARCHAR(50), -- 'google', 'facebook', etc.
        provider_account_id NVARCHAR(255),
        password_hash NVARCHAR(255),
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    PRINT 'Table accounts created';
END
GO

-- Profiles table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'profiles')
BEGIN
    CREATE TABLE profiles (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL UNIQUE,
        full_name NVARCHAR(255),
        phone NVARCHAR(50),
        
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    PRINT 'Table profiles created';
END
GO

-- Addresses table (multiple addresses per user)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'addresses')
BEGIN
    CREATE TABLE addresses (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        street NVARCHAR(255),
        building NVARCHAR(100),
        floor NVARCHAR(50),
        apartment NVARCHAR(50),
        area NVARCHAR(255),
        city NVARCHAR(255),
        notes NVARCHAR(MAX),
        is_default BIT DEFAULT 0,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    PRINT 'Table addresses created';
END
GO

-- =====================================================
-- Products & Categories Tables
-- =====================================================

-- Categories table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'categories')
BEGIN
    CREATE TABLE categories (
        id INT PRIMARY KEY IDENTITY(1,1),
        name_ar NVARCHAR(255) NOT NULL,
        name_en NVARCHAR(255) NOT NULL,
        image_url NVARCHAR(MAX), -- Supabase URL
        created_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Table categories created';
END
GO

-- Products table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'products')
BEGIN
    CREATE TABLE products (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        name_ar NVARCHAR(500) NOT NULL,
        name_en NVARCHAR(500) NOT NULL,
        description_ar NVARCHAR(MAX),
        description_en NVARCHAR(MAX),
        price DECIMAL(10,2) NOT NULL,
        offer_price DECIMAL(10,2),
        images NVARCHAR(MAX), -- JSON array of product-images bucket URLs
        category_id INT,
        quantity INT DEFAULT 0,
        is_best_seller BIT DEFAULT 0,
        limited_time_offer BIT DEFAULT 0,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (category_id) REFERENCES categories(id)
    );
    PRINT 'Table products created';
END
GO

-- Product Attributes table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'product_attributes')
BEGIN
    CREATE TABLE product_attributes (
        id INT PRIMARY KEY IDENTITY(1,1),
        product_id UNIQUEIDENTIFIER NOT NULL,
        attribute_name NVARCHAR(255) NOT NULL,
        attribute_value NVARCHAR(255) NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    PRINT 'Table product_attributes created';
END
GO

-- =====================================================
-- Orders & Payments Tables
-- =====================================================

-- Orders table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'orders')
BEGIN
    CREATE TABLE orders (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER, -- NULL for guest orders
        status NVARCHAR(50) DEFAULT 'pending', -- pending, paid, shipped, delivered, cancelled
        total_price DECIMAL(10,2) NOT NULL,
        -- Guest customer fields
        customer_first_name NVARCHAR(255),
        customer_last_name NVARCHAR(255),
        customer_phone NVARCHAR(50),
        customer_email NVARCHAR(255),
        customer_street_address NVARCHAR(500),
        customer_city NVARCHAR(255),
        customer_state NVARCHAR(255),
        customer_postcode NVARCHAR(50),
        order_notes NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    PRINT 'Table orders created';
END
GO

-- Order Items table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'order_items')
BEGIN
    CREATE TABLE order_items (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        order_id UNIQUEIDENTIFIER NOT NULL,
        product_id UNIQUEIDENTIFIER NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    );
    PRINT 'Table order_items created';
END
GO

-- Payments table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'payments')
BEGIN
    CREATE TABLE payments (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        order_id UNIQUEIDENTIFIER NOT NULL,
        payment_method NVARCHAR(50) NOT NULL, -- easykash, cod
        payment_provider NVARCHAR(100), -- for easykash: 'Cash Through Fawry', 'Credit & Debit Card', etc.
        amount DECIMAL(10,2) NOT NULL,
        payment_status NVARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
        transaction_id NVARCHAR(255),
        easykash_ref NVARCHAR(255),
        easykash_product_code NVARCHAR(255),
        voucher NVARCHAR(255),
        customer_reference NVARCHAR(255),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    PRINT 'Table payments created';
END
GO

-- =====================================================
-- Content Tables
-- =====================================================

-- Banners table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'banners')
BEGIN
    CREATE TABLE banners (
        id INT PRIMARY KEY IDENTITY(1,1),
        desc_ar NVARCHAR(MAX),
        desc_en NVARCHAR(MAX),
        image NVARCHAR(MAX), -- Supabase URL
        display_order INT DEFAULT 0,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Table banners created';
END
GO

-- Blogs table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'blogs')
BEGIN
    CREATE TABLE blogs (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        title_ar NVARCHAR(500),
        title_en NVARCHAR(500),
        content_ar NVARCHAR(MAX),
        content_en NVARCHAR(MAX),
        image NVARCHAR(MAX), -- Supabase URL
        author NVARCHAR(255),
        status NVARCHAR(50) DEFAULT 'draft', -- draft, published
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Table blogs created';
END
GO

-- Testimonials table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'testimonials')
BEGIN
    CREATE TABLE testimonials (
        id INT PRIMARY KEY IDENTITY(1,1),
        name_ar NVARCHAR(255),
        name_en NVARCHAR(255),
        message_ar NVARCHAR(MAX),
        message_en NVARCHAR(MAX),
        image NVARCHAR(MAX), -- Supabase URL
        created_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Table testimonials created';
END
GO

-- Branches table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'branches')
BEGIN
    CREATE TABLE branches (
        id INT PRIMARY KEY IDENTITY(1,1),
        name_ar NVARCHAR(255),
        name_en NVARCHAR(255),
        address_ar NVARCHAR(500),
        address_en NVARCHAR(500),
        phone NVARCHAR(50),
        created_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Table branches created';
END
GO

-- News table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'news')
BEGIN
    CREATE TABLE news (
        id INT PRIMARY KEY IDENTITY(1,1),
        title_ar NVARCHAR(500),
        title_en NVARCHAR(500),
        content_ar NVARCHAR(MAX),
        content_en NVARCHAR(MAX),
        image NVARCHAR(MAX),
        status NVARCHAR(50) DEFAULT 'draft',
        price_individual DECIMAL(10,2),
        price_family DECIMAL(10,2),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Table news created';
END
GO

PRINT 'All tables created successfully!';


