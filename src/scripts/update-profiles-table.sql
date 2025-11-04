-- Add missing columns to profiles table for dashboard admin profiles
USE lapipDb;
GO

-- Check if columns exist and add them if they don't
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('profiles') AND name = 'job_title')
BEGIN
    ALTER TABLE profiles ADD job_title NVARCHAR(255) NULL;
    PRINT '✓ Added job_title column';
END
ELSE
BEGIN
    PRINT '  job_title column already exists';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('profiles') AND name = 'address')
BEGIN
    ALTER TABLE profiles ADD address NVARCHAR(MAX) NULL;
    PRINT '✓ Added address column';
END
ELSE
BEGIN
    PRINT '  address column already exists';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('profiles') AND name = 'about')
BEGIN
    ALTER TABLE profiles ADD about NVARCHAR(MAX) NULL;
    PRINT '✓ Added about column';
END
ELSE
BEGIN
    PRINT '  about column already exists';
END
GO

PRINT '';
PRINT '✅ Profiles table updated successfully!';
PRINT '';
GO

