-- Shipping Fees Table (by Governorate)
-- This table stores shipping fees for each Egyptian governorate

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'shipping_fees')
BEGIN
    CREATE TABLE shipping_fees (
        id INT PRIMARY KEY IDENTITY(1,1),
        governorate_name_ar NVARCHAR(255) NOT NULL UNIQUE,
        governorate_name_en NVARCHAR(255) NOT NULL UNIQUE,
        fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Table shipping_fees created';
END
GO

-- Insert default Egyptian governorates with zero fees (only if they don't exist)
-- Using MERGE to avoid duplicate key errors

MERGE shipping_fees AS target
USING (VALUES
    ('القاهرة', 'Cairo', 0, 1),
    ('الجيزة', 'Giza', 0, 1),
    ('الإسكندرية', 'Alexandria', 0, 1),
    ('الدقهلية', 'Dakahlia', 0, 1),
    ('البحيرة', 'Beheira', 0, 1),
    ('المنيا', 'Minya', 0, 1),
    ('القليوبية', 'Qalyubia', 0, 1),
    ('سوهاج', 'Sohag', 0, 1),
    ('أسيوط', 'Asyut', 0, 1),
    ('الشرقية', 'Sharqia', 0, 1),
    ('المنوفية', 'Monufia', 0, 1),
    ('كفر الشيخ', 'Kafr El Sheikh', 0, 1),
    ('الغربية', 'Gharbia', 0, 1),
    ('بني سويف', 'Beni Suef', 0, 1),
    ('قنا', 'Qena', 0, 1),
    ('أسوان', 'Aswan', 0, 1),
    ('الأقصر', 'Luxor', 0, 1),
    ('البحر الأحمر', 'Red Sea', 0, 1),
    ('الوادي الجديد', 'New Valley', 0, 1),
    ('مطروح', 'Matruh', 0, 1),
    ('شمال سيناء', 'North Sinai', 0, 1),
    ('جنوب سيناء', 'South Sinai', 0, 1),
    ('الإسماعيلية', 'Ismailia', 0, 1),
    ('بورسعيد', 'Port Said', 0, 1),
    ('السويس', 'Suez', 0, 1),
    ('دمياط', 'Damietta', 0, 1),
    ('الفيوم', 'Faiyum', 0, 1)
) AS source (governorate_name_ar, governorate_name_en, fee, is_active)
ON target.governorate_name_ar = source.governorate_name_ar
WHEN NOT MATCHED THEN
    INSERT (governorate_name_ar, governorate_name_en, fee, is_active)
    VALUES (source.governorate_name_ar, source.governorate_name_en, source.fee, source.is_active);

PRINT 'Default governorates inserted/updated';
GO

