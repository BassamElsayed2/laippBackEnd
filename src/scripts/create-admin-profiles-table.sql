-- Create admin_profiles table - separate from customer profiles
USE lapipDb;
GO

-- Admin Profiles table (for dashboard admins only)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'admin_profiles')
BEGIN
    CREATE TABLE admin_profiles (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL UNIQUE,
        full_name NVARCHAR(255),
        phone NVARCHAR(50),
        avatar_url NVARCHAR(MAX),
        job_title NVARCHAR(255),
        address NVARCHAR(MAX),
        about NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    PRINT '✅ Table admin_profiles created successfully!';
END
ELSE
BEGIN
    PRINT '⚠️  Table admin_profiles already exists';
END
GO

-- Create index for faster lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_admin_profiles_user_id')
BEGIN
    CREATE INDEX IX_admin_profiles_user_id ON admin_profiles(user_id);
    PRINT '✅ Index IX_admin_profiles_user_id created';
END
GO

PRINT '';
PRINT '==============================================';
PRINT '✅ Admin Profiles Table Setup Complete!';
PRINT '==============================================';
PRINT '';
PRINT '📋 Next Steps:';
PRINT '1. Run: npm run quick-setup (to create admin with profile)';
PRINT '2. Or manually create admin profiles for existing admins';
PRINT '';
GO

