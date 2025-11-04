-- تحقق من وجود التصنيفات في قاعدة البيانات
-- Check if categories exist in database

USE lapipDb;
GO

PRINT '===============================================';
PRINT 'التحقق من جدول التصنيفات - Checking Categories Table';
PRINT '===============================================';
PRINT '';

-- عد التصنيفات
DECLARE @CategoryCount INT;
SELECT @CategoryCount = COUNT(*) FROM categories;

PRINT 'عدد التصنيفات - Total Categories: ' + CAST(@CategoryCount AS VARCHAR);
PRINT '';

-- عرض جميع التصنيفات
IF @CategoryCount > 0
BEGIN
    PRINT '===============================================';
    PRINT 'قائمة التصنيفات - Categories List:';
    PRINT '===============================================';
    
    SELECT 
        id AS [ID],
        name_ar AS [الاسم بالعربي],
        name_en AS [English Name],
        CASE 
            WHEN image_url IS NULL THEN 'لا توجد صورة - No Image'
            ELSE 'يوجد صورة - Has Image'
        END AS [الصورة - Image],
        FORMAT(created_at, 'yyyy-MM-dd HH:mm:ss') AS [تاريخ الإنشاء - Created At]
    FROM categories
    ORDER BY id ASC;
END
ELSE
BEGIN
    PRINT '⚠️  لا توجد تصنيفات في قاعدة البيانات!';
    PRINT '⚠️  No categories found in database!';
    PRINT '';
    PRINT 'يرجى إضافة تصنيفات باستخدام:';
    PRINT 'Please add categories using:';
    PRINT '1. Admin Dashboard';
    PRINT '2. SQL INSERT statements';
    PRINT '';
    PRINT 'مثال - Example:';
    PRINT 'INSERT INTO categories (name_ar, name_en) VALUES (N''إلكترونيات'', ''Electronics'');';
END

GO

PRINT '';
PRINT '===============================================';
PRINT '✅ تم الانتهاء - Done';
PRINT '===============================================';

