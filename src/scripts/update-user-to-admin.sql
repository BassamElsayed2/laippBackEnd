-- Script to update an existing user to admin role
-- Use this if you already have a user account and want to make it admin

USE lapipDb;
GO

-- ⚠️ CHANGE THIS EMAIL to the user you want to make admin
DECLARE @user_email NVARCHAR(255) = 'user@example.com';

-- Check if user exists
IF NOT EXISTS (SELECT 1 FROM users WHERE email = @user_email)
BEGIN
    PRINT 'ERROR: User not found with email: ' + @user_email;
    PRINT 'Please check the email address and try again.';
END
ELSE
BEGIN
    -- Get current role
    DECLARE @current_role NVARCHAR(50);
    SELECT @current_role = role FROM users WHERE email = @user_email;
    
    PRINT 'User found: ' + @user_email;
    PRINT 'Current role: ' + @current_role;
    
    IF @current_role = 'admin'
    BEGIN
        PRINT 'User is already an admin!';
    END
    ELSE
    BEGIN
        -- Update to admin
        UPDATE users 
        SET role = 'admin', updated_at = GETDATE()
        WHERE email = @user_email;
        
        PRINT 'Success! User has been updated to admin role.';
        PRINT 'The user can now login to the dashboard.';
    END
END

GO

