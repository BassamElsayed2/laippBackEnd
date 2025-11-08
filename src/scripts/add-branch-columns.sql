-- Add missing columns to branches table

-- Check if area_ar column exists, if not add it
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('branches') 
    AND name = 'area_ar'
)
BEGIN
    ALTER TABLE branches ADD area_ar NVARCHAR(255);
    PRINT 'Column area_ar added to branches table';
END

-- Check if area_en column exists, if not add it
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('branches') 
    AND name = 'area_en'
)
BEGIN
    ALTER TABLE branches ADD area_en NVARCHAR(255);
    PRINT 'Column area_en added to branches table';
END

-- Check if google_map column exists, if not add it
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('branches') 
    AND name = 'google_map'
)
BEGIN
    ALTER TABLE branches ADD google_map NVARCHAR(MAX);
    PRINT 'Column google_map added to branches table';
END

-- Check if image column exists, if not add it
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('branches') 
    AND name = 'image'
)
BEGIN
    ALTER TABLE branches ADD image NVARCHAR(MAX);
    PRINT 'Column image added to branches table';
END

-- Check if works_hours column exists, if not add it
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('branches') 
    AND name = 'works_hours'
)
BEGIN
    ALTER TABLE branches ADD works_hours NVARCHAR(255);
    PRINT 'Column works_hours added to branches table';
END

PRINT 'Branch table migration completed successfully';

