-- Safe migration script for profiles table
-- This preserves all existing data

USE lapipDb;
GO

-- 1. Check current structure
PRINT '📋 Current profiles structure:';
SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'profiles'
ORDER BY ORDINAL_POSITION;
GO

-- 2. Create a backup of data (if table exists)
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'profiles')
BEGIN
    -- Create temp backup table
    SELECT * INTO profiles_backup FROM profiles;
    PRINT '✅ Backup created: profiles_backup';
END
GO

-- 3. Drop the old table
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'profiles')
BEGIN
    DROP TABLE profiles;
    PRINT '🗑️  Dropped old profiles table';
END
GO

-- 4. Create new table with correct structure
CREATE TABLE profiles (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL UNIQUE,
    full_name NVARCHAR(255),
    phone NVARCHAR(50),
    avatar_url NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
PRINT '✅ Created new profiles table with full_name';
GO

-- 5. Restore data from backup (if exists)
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'profiles_backup')
BEGIN
    -- Try to restore with dynamic SQL to handle different column structures
    DECLARE @sql NVARCHAR(MAX);
    
    -- Check if old table had first_name/last_name
    IF EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('profiles_backup') 
        AND name IN ('first_name', 'last_name')
    )
    BEGIN
        -- Old structure with first_name/last_name
        SET @sql = N'
            INSERT INTO profiles (id, user_id, full_name, phone, avatar_url, created_at, updated_at)
            SELECT 
                id,
                user_id,
                CASE 
                    WHEN first_name IS NOT NULL AND last_name IS NOT NULL 
                        THEN first_name + '' '' + last_name
                    WHEN first_name IS NOT NULL 
                        THEN first_name
                    WHEN last_name IS NOT NULL 
                        THEN last_name
                    ELSE NULL
                END as full_name,
                phone,
                ' + 
                CASE 
                    WHEN EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('profiles_backup') AND name = 'avatar_url')
                    THEN 'avatar_url'
                    ELSE 'NULL'
                END + N',
                created_at,
                updated_at
            FROM profiles_backup';
    END
    ELSE
    BEGIN
        -- Already has full_name
        SET @sql = N'
            INSERT INTO profiles (id, user_id, full_name, phone, avatar_url, created_at, updated_at)
            SELECT id, user_id, full_name, phone, ' +
            CASE 
                WHEN EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('profiles_backup') AND name = 'avatar_url')
                THEN 'avatar_url'
                ELSE 'NULL'
            END + N', created_at, updated_at
            FROM profiles_backup';
    END
    
    EXEC sp_executesql @sql;
    PRINT '✅ Restored data from backup';
    
    -- Drop backup table
    DROP TABLE profiles_backup;
    PRINT '🗑️  Cleaned up backup table';
END
GO

-- 6. Create addresses table if it doesn't exist
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
    PRINT '✅ Created addresses table';
END
ELSE
BEGIN
    PRINT '⚠️  Addresses table already exists';
END
GO

-- 7. Verify final structure
PRINT '';
PRINT '🎉 Migration completed!';
PRINT '';
PRINT '📋 New profiles structure:';
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'profiles'
ORDER BY ORDINAL_POSITION;
GO

PRINT '';
PRINT '📋 Addresses structure:';
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'addresses'
ORDER BY ORDINAL_POSITION;
GO

PRINT '';
PRINT '✅ All done! You can now restart your backend server.';
GO

