-- Create login_attempts table for tracking failed login attempts
-- This table is used for account lockout functionality

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'login_attempts')
BEGIN
    CREATE TABLE login_attempts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        identifier NVARCHAR(255) NOT NULL UNIQUE, -- Email or phone number (lowercase)
        failed_attempts INT NOT NULL DEFAULT 0,
        last_failed_attempt DATETIME2 NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );

    -- Create index on identifier for faster lookups
    CREATE INDEX idx_login_attempts_identifier ON login_attempts(identifier);
    
    PRINT 'Table login_attempts created successfully';
END
ELSE
BEGIN
    PRINT 'Table login_attempts already exists';
END
GO

-- Optional: Create stored procedures for better performance
-- Note: These procedures are optional. The application will work with direct queries if procedures don't exist.

-- Procedure 1: Check Account Lockout
IF NOT EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CheckAccountLockout')
BEGIN
    EXEC('
    CREATE PROCEDURE sp_CheckAccountLockout
        @identifier NVARCHAR(255),
        @is_locked BIT OUTPUT,
        @locked_until DATETIME2 OUTPUT,
        @attempts_left INT OUTPUT
    AS
    BEGIN
        DECLARE @failed_attempts INT = 0;
        DECLARE @last_failed DATETIME2;
        DECLARE @max_attempts INT = 5;
        DECLARE @lockout_minutes INT = 15;
        
        -- Get current failed attempts
        SELECT 
            @failed_attempts = ISNULL(failed_attempts, 0),
            @last_failed = last_failed_attempt
        FROM login_attempts
        WHERE identifier = @identifier;
        
        -- Calculate if account is locked
        IF @failed_attempts >= @max_attempts 
            AND DATEADD(MINUTE, @lockout_minutes, @last_failed) > GETDATE()
        BEGIN
            SET @is_locked = 1;
            SET @locked_until = DATEADD(MINUTE, @lockout_minutes, @last_failed);
            SET @attempts_left = 0;
        END
        ELSE
        BEGIN
            SET @is_locked = 0;
            SET @locked_until = NULL;
            SET @attempts_left = @max_attempts - @failed_attempts;
            
            -- Reset attempts if lockout period has passed
            IF @failed_attempts >= @max_attempts 
                AND DATEADD(MINUTE, @lockout_minutes, @last_failed) <= GETDATE()
            BEGIN
                DELETE FROM login_attempts WHERE identifier = @identifier;
                SET @attempts_left = @max_attempts;
            END
        END
    END
    ');
    PRINT 'Stored procedure sp_CheckAccountLockout created successfully';
END
GO

-- Procedure 2: Record Failed Attempt
IF NOT EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_RecordFailedAttempt')
BEGIN
    EXEC('
    CREATE PROCEDURE sp_RecordFailedAttempt
        @identifier NVARCHAR(255),
        @max_attempts INT = 5,
        @lockout_duration_minutes INT = 15,
        @is_locked BIT OUTPUT,
        @attempts_left INT OUTPUT,
        @locked_until DATETIME2 OUTPUT
    AS
    BEGIN
        -- Insert or update failed attempt
        MERGE login_attempts AS target
        USING (SELECT @identifier AS identifier) AS source
        ON target.identifier = source.identifier
        WHEN MATCHED THEN
            UPDATE SET 
                failed_attempts = failed_attempts + 1,
                last_failed_attempt = GETDATE(),
                updated_at = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT (identifier, failed_attempts, last_failed_attempt)
            VALUES (@identifier, 1, GETDATE());
        
        -- Check if account is now locked
        DECLARE @current_attempts INT;
        DECLARE @last_failed DATETIME2;
        
        SELECT 
            @current_attempts = failed_attempts,
            @last_failed = last_failed_attempt
        FROM login_attempts
        WHERE identifier = @identifier;
        
        IF @current_attempts >= @max_attempts
        BEGIN
            SET @is_locked = 1;
            SET @attempts_left = 0;
            SET @locked_until = DATEADD(MINUTE, @lockout_duration_minutes, @last_failed);
        END
        ELSE
        BEGIN
            SET @is_locked = 0;
            SET @attempts_left = @max_attempts - @current_attempts;
            SET @locked_until = NULL;
        END
    END
    ');
    PRINT 'Stored procedure sp_RecordFailedAttempt created successfully';
END
GO

-- Procedure 3: Clear Failed Attempts
IF NOT EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_ClearFailedAttempts')
BEGIN
    EXEC('
    CREATE PROCEDURE sp_ClearFailedAttempts
        @identifier NVARCHAR(255)
    AS
    BEGIN
        DELETE FROM login_attempts WHERE identifier = @identifier;
    END
    ');
    PRINT 'Stored procedure sp_ClearFailedAttempts created successfully';
END
GO

PRINT 'Account lockout system setup completed!';
PRINT 'The system will:';
PRINT '- Lock accounts after 5 failed login attempts';
PRINT '- Keep accounts locked for 15 minutes';
PRINT '- Automatically reset failed attempts after successful login';

