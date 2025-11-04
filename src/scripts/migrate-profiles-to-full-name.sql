-- Migration script to update profiles table structure
-- This script preserves existing data

USE lapipDb;
GO

-- Step 1: Add full_name column if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'full_name'
)
BEGIN
    ALTER TABLE profiles ADD full_name NVARCHAR(255);
    PRINT '✅ Added full_name column';
END
ELSE
BEGIN
    PRINT '⚠️  full_name column already exists';
END
GO

-- Step 2: Migrate data from first_name + last_name to full_name
UPDATE profiles
SET full_name = CASE
    WHEN first_name IS NOT NULL AND last_name IS NOT NULL 
        THEN first_name + ' ' + last_name
    WHEN first_name IS NOT NULL 
        THEN first_name
    WHEN last_name IS NOT NULL 
        THEN last_name
    ELSE NULL
END
WHERE full_name IS NULL;
PRINT '✅ Migrated data to full_name';
GO

-- Step 3: Drop old columns if they exist
IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'first_name'
)
BEGIN
    ALTER TABLE profiles DROP COLUMN first_name;
    PRINT '✅ Dropped first_name column';
END
GO

IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'last_name'
)
BEGIN
    ALTER TABLE profiles DROP COLUMN last_name;
    PRINT '✅ Dropped last_name column';
END
GO

-- Step 4: Drop address columns if they exist
IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'street_address'
)
BEGIN
    ALTER TABLE profiles DROP COLUMN street_address;
    PRINT '✅ Dropped street_address column';
END
GO

IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'city'
)
BEGIN
    ALTER TABLE profiles DROP COLUMN city;
    PRINT '✅ Dropped city column';
END
GO

IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'state'
)
BEGIN
    ALTER TABLE profiles DROP COLUMN state;
    PRINT '✅ Dropped state column';
END
GO

IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'postcode'
)
BEGIN
    ALTER TABLE profiles DROP COLUMN postcode;
    PRINT '✅ Dropped postcode column';
END
GO

-- Step 5: Show final structure
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'profiles'
ORDER BY ORDINAL_POSITION;
GO

PRINT '🎉 Migration completed successfully!';
PRINT 'Profile table structure:';
PRINT '  - id';
PRINT '  - user_id';
PRINT '  - full_name (NEW)';
PRINT '  - phone';
PRINT '  - avatar_url';
PRINT '  - created_at';
PRINT '  - updated_at';
GO

