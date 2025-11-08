# Migration Instructions for Branches Table

## Overview
This migration adds additional columns to the `branches` table to support the full functionality required by the frontend.

## New Columns Added
- `area_ar` (NVARCHAR(255)) - Area name in Arabic
- `area_en` (NVARCHAR(255)) - Area name in English
- `google_map` (NVARCHAR(MAX)) - Google Maps link or embed code
- `image` (NVARCHAR(MAX)) - Branch image URL
- `works_hours` (NVARCHAR(255)) - Working hours information

## How to Apply Migration

### Option 1: Using SQL Server Management Studio (SSMS)
1. Open SQL Server Management Studio
2. Connect to your database server
3. Open the file: `backend/src/scripts/add-branch-columns.sql`
4. Make sure you're connected to the correct database
5. Execute the script (F5)
6. Verify the output messages confirm successful addition of columns

### Option 2: Using Azure Data Studio
1. Open Azure Data Studio
2. Connect to your database
3. Open the file: `backend/src/scripts/add-branch-columns.sql`
4. Execute the script
5. Check the Messages pane for success confirmation

### Option 3: Using sqlcmd (Command Line)
```bash
sqlcmd -S your_server_name -d your_database_name -U your_username -P your_password -i backend/src/scripts/add-branch-columns.sql
```

## Verification
After running the migration, you can verify the columns were added by running:

```sql
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    CHARACTER_MAXIMUM_LENGTH
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_NAME = 'branches'
ORDER BY 
    ORDINAL_POSITION;
```

You should see all the new columns in the result set.

## Rollback (if needed)
If you need to remove these columns:

```sql
ALTER TABLE branches DROP COLUMN area_ar;
ALTER TABLE branches DROP COLUMN area_en;
ALTER TABLE branches DROP COLUMN google_map;
ALTER TABLE branches DROP COLUMN image;
ALTER TABLE branches DROP COLUMN works_hours;
```

**WARNING**: Rollback will delete all data stored in these columns!

## Next Steps
After applying the migration:
1. Restart your backend server
2. Test creating a new branch from the dashboard
3. Verify all fields are being saved correctly

## Troubleshooting
- **Error: "Column already exists"** - This is safe to ignore; the script checks for existing columns
- **Error: "Invalid object name 'branches'"** - Run the main create-tables.sql script first
- **Permission denied** - Make sure your database user has ALTER TABLE permissions

