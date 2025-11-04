-- SQL Server Script to Update Blogs Table
-- Adds support for multiple images (JSON array) and YouTube code

USE lapipDb;
GO

-- Add images column (JSON array) if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'blogs') AND name = 'images')
BEGIN
    ALTER TABLE blogs ADD images NVARCHAR(MAX);
    PRINT 'Column images added to blogs table';
END
ELSE
BEGIN
    PRINT 'Column images already exists in blogs table';
END
GO

-- Add yt_code column if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'blogs') AND name = 'yt_code')
BEGIN
    ALTER TABLE blogs ADD yt_code NVARCHAR(255);
    PRINT 'Column yt_code added to blogs table';
END
ELSE
BEGIN
    PRINT 'Column yt_code already exists in blogs table';
END
GO

-- Migrate existing single image to images array (if not already migrated)
-- This will convert the old 'image' column to a JSON array in the new 'images' column
UPDATE blogs
SET images = CASE 
    WHEN image IS NOT NULL AND image != '' 
    THEN '["' + image + '"]'
    ELSE NULL
END
WHERE (images IS NULL OR images = '') AND (image IS NOT NULL AND image != '');

PRINT 'Migrated existing image data to images array';
GO

-- Optional: Drop the old image column (commented out for safety)
-- Uncomment this if you're sure you want to remove the old column
/*
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'blogs') AND name = 'image')
BEGIN
    ALTER TABLE blogs DROP COLUMN image;
    PRINT 'Old image column dropped';
END
*/

PRINT 'Blogs table update completed successfully!';
GO

