-- إضافة تصنيفات تجريبية - Add Sample Categories
-- Run this if you don't have any categories in your database

USE lapipDb;
GO

PRINT '===============================================';
PRINT 'إضافة تصنيفات تجريبية - Adding Sample Categories';
PRINT '===============================================';
PRINT '';

-- حذف التصنيفات الموجودة (اختياري - احذر!)
-- Delete existing categories (optional - be careful!)
-- DELETE FROM categories;
-- PRINT '✓ تم حذف التصنيفات القديمة';

-- إضافة تصنيفات جديدة
-- Add new categories

-- تحقق من عدم وجود التصنيفات بالفعل
IF NOT EXISTS (SELECT 1 FROM categories WHERE name_en = 'Electronics')
BEGIN
    INSERT INTO categories (name_ar, name_en) 
    VALUES (N'إلكترونيات', 'Electronics');
    PRINT '✅ تم إضافة: إلكترونيات - Electronics';
END

IF NOT EXISTS (SELECT 1 FROM categories WHERE name_en = 'Fashion')
BEGIN
    INSERT INTO categories (name_ar, name_en) 
    VALUES (N'أزياء', 'Fashion');
    PRINT '✅ تم إضافة: أزياء - Fashion';
END

IF NOT EXISTS (SELECT 1 FROM categories WHERE name_en = 'Home & Kitchen')
BEGIN
    INSERT INTO categories (name_ar, name_en) 
    VALUES (N'المنزل والمطبخ', 'Home & Kitchen');
    PRINT '✅ تم إضافة: المنزل والمطبخ - Home & Kitchen';
END

IF NOT EXISTS (SELECT 1 FROM categories WHERE name_en = 'Books')
BEGIN
    INSERT INTO categories (name_ar, name_en) 
    VALUES (N'كتب', 'Books');
    PRINT '✅ تم إضافة: كتب - Books';
END

IF NOT EXISTS (SELECT 1 FROM categories WHERE name_en = 'Sports')
BEGIN
    INSERT INTO categories (name_ar, name_en) 
    VALUES (N'رياضة', 'Sports');
    PRINT '✅ تم إضافة: رياضة - Sports';
END

IF NOT EXISTS (SELECT 1 FROM categories WHERE name_en = 'Beauty & Health')
BEGIN
    INSERT INTO categories (name_ar, name_en) 
    VALUES (N'الجمال والصحة', 'Beauty & Health');
    PRINT '✅ تم إضافة: الجمال والصحة - Beauty & Health';
END

IF NOT EXISTS (SELECT 1 FROM categories WHERE name_en = 'Toys & Games')
BEGIN
    INSERT INTO categories (name_ar, name_en) 
    VALUES (N'ألعاب', 'Toys & Games');
    PRINT '✅ تم إضافة: ألعاب - Toys & Games';
END

IF NOT EXISTS (SELECT 1 FROM categories WHERE name_en = 'Food & Beverages')
BEGIN
    INSERT INTO categories (name_ar, name_en) 
    VALUES (N'أطعمة ومشروبات', 'Food & Beverages');
    PRINT '✅ تم إضافة: أطعمة ومشروبات - Food & Beverages';
END

PRINT '';
PRINT '===============================================';
PRINT 'عرض جميع التصنيفات - Display All Categories';
PRINT '===============================================';

SELECT 
    id,
    name_ar AS [الاسم بالعربي],
    name_en AS [English Name],
    created_at AS [تاريخ الإنشاء]
FROM categories
ORDER BY id ASC;

PRINT '';
PRINT '===============================================';
PRINT '✅ تم الانتهاء - Done';
PRINT 'يمكنك الآن استخدام Dashboard';
PRINT 'You can now use the Dashboard';
PRINT '===============================================';

GO

