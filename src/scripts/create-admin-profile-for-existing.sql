-- Create admin_profile for existing admin user
USE lapipDb;
GO

-- Create profile for admin@lapip.com
DECLARE @admin_user_id UNIQUEIDENTIFIER;
DECLARE @profile_id UNIQUEIDENTIFIER = NEWID();

-- Get admin user ID
SELECT @admin_user_id = id 
FROM users 
WHERE email = 'admin@lapip.com' AND role = 'admin';

IF @admin_user_id IS NOT NULL
BEGIN
    -- Check if profile already exists
    IF NOT EXISTS (SELECT 1 FROM admin_profiles WHERE user_id = @admin_user_id)
    BEGIN
        -- Create admin profile
        INSERT INTO admin_profiles (id, user_id, full_name, created_at, updated_at)
        VALUES (@profile_id, @admin_user_id, 'Admin User', GETDATE(), GETDATE());
        
        PRINT '✅ Admin profile created successfully!';
        PRINT '   User ID: ' + CAST(@admin_user_id AS NVARCHAR(50));
        PRINT '   Profile ID: ' + CAST(@profile_id AS NVARCHAR(50));
    END
    ELSE
    BEGIN
        PRINT '⚠️  Admin profile already exists';
    END
END
ELSE
BEGIN
    PRINT '❌ Admin user not found!';
    PRINT '   Please run: npm run quick-setup';
END
GO

