-- Script to create an admin user
-- Run this script to create your first admin user for the dashboard

USE lapipDb;
GO

-- Variables (CHANGE THESE VALUES)
DECLARE @admin_email NVARCHAR(255) = 'admin@lapip.com';
DECLARE @admin_password NVARCHAR(255) = 'Admin@123456'; -- Change this!
DECLARE @admin_name NVARCHAR(255) = 'Admin User';
DECLARE @admin_phone NVARCHAR(50) = '01000000000';

-- Generate UUIDs
DECLARE @user_id UNIQUEIDENTIFIER = NEWID();
DECLARE @account_id UNIQUEIDENTIFIER = NEWID();
DECLARE @profile_id UNIQUEIDENTIFIER = NEWID();

-- Check if email already exists
IF EXISTS (SELECT 1 FROM users WHERE email = @admin_email)
BEGIN
    PRINT 'ERROR: Email already exists!';
    PRINT 'If you want to update an existing user to admin, use update-user-to-admin.sql instead';
END
ELSE
BEGIN
    -- Hash password using bcrypt (this is a placeholder - see note below)
    -- NOTE: You need to run this through Node.js to properly hash the password
    -- This script will insert a temporary password that needs to be hashed
    
    PRINT 'Creating admin user...';
    PRINT 'User ID: ' + CAST(@user_id AS NVARCHAR(50));
    PRINT 'Email: ' + @admin_email;
    PRINT '';
    PRINT '⚠️ IMPORTANT: This script creates user with plaintext password.';
    PRINT '   Please run the Node.js script instead: npm run create-admin';
    PRINT '';
    
    -- Create user
    INSERT INTO users (id, email, name, role, email_verified, created_at, updated_at)
    VALUES (@user_id, @admin_email, @admin_name, 'admin', 1, GETDATE(), GETDATE());
    
    PRINT '✓ User created';
    
    -- Create account (password will be set by Node.js script)
    -- Placeholder hash - THIS IS NOT SECURE, USE Node.js script!
    INSERT INTO accounts (id, user_id, account_type, password_hash, created_at)
    VALUES (@account_id, @user_id, 'email', 'PLACEHOLDER_HASH_USE_NODEJS_SCRIPT', GETDATE());
    
    PRINT '✓ Account created (needs password hash from Node.js)';
    
    -- Create profile
    INSERT INTO profiles (id, user_id, full_name, phone, created_at, updated_at)
    VALUES (@profile_id, @user_id, @admin_name, @admin_phone, GETDATE(), GETDATE());
    
    PRINT '✓ Profile created';
    PRINT '';
    PRINT '⚠️ NEXT STEP: Run the following Node.js command to set the password:';
    PRINT '   cd backend';
    PRINT '   npm run create-admin';
    PRINT '';
END

GO

