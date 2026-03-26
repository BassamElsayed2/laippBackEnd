import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { getPool } from "../config/database";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import https from "https";
import http from "http";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

function getPublicUrl(filePath: string): string {
  const apiUrl =
    process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${apiUrl}/uploads/${filePath.replace(/\\/g, "/")}`;
}

function isSupabaseUrl(url: string): boolean {
  return typeof url === "string" && url.includes("supabase.co");
}

function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          downloadFile(res.headers.location!).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: ${res.statusCode} for ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname);
    return ext || ".jpg";
  } catch {
    return ".jpg";
  }
}

async function migrateImageUrl(
  imageUrl: string,
  folder: string,
): Promise<string | null> {
  if (!isSupabaseUrl(imageUrl)) return null;

  try {
    const buffer = await downloadFile(imageUrl);
    const ext = getExtFromUrl(imageUrl);
    const fileName = `${uuidv4()}${ext}`;
    const folderPath = path.join(UPLOADS_DIR, folder);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const diskPath = path.join(folderPath, fileName);
    fs.writeFileSync(diskPath, buffer);

    return getPublicUrl(`${folder}/${fileName}`);
  } catch (error: any) {
    console.error(`Failed to migrate image: ${imageUrl}`, error.message);
    return null;
  }
}

async function migrateJsonImages(
  jsonStr: string,
  folder: string,
): Promise<{ newJson: string; count: number }> {
  let count = 0;
  try {
    const images: string[] = JSON.parse(jsonStr);
    if (!Array.isArray(images)) return { newJson: jsonStr, count: 0 };

    const newImages: string[] = [];
    for (const url of images) {
      if (isSupabaseUrl(url)) {
        const newUrl = await migrateImageUrl(url, folder);
        if (newUrl) {
          newImages.push(newUrl);
          count++;
        } else {
          newImages.push(url);
        }
      } else {
        newImages.push(url);
      }
    }
    return { newJson: JSON.stringify(newImages), count };
  } catch {
    return { newJson: jsonStr, count: 0 };
  }
}

export const migrateSupabaseImages = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const pool = getPool();
    const results: {
      table: string;
      migrated: number;
      errors: number;
    }[] = [];

    // 1. products (images JSON column)
    {
      let migrated = 0;
      let errors = 0;
      const rows = await pool
        .request()
        .query(
          "SELECT id, images FROM products WHERE images IS NOT NULL AND images LIKE '%supabase%'",
        );
      for (const row of rows.recordset) {
        try {
          const { newJson, count } = await migrateJsonImages(
            row.images,
            "products",
          );
          if (count > 0) {
            await pool
              .request()
              .input("id", row.id)
              .input("images", newJson)
              .query("UPDATE products SET images = @images WHERE id = @id");
            migrated += count;
          }
        } catch (e: any) {
          console.error(`Error migrating product ${row.id}:`, e.message);
          errors++;
        }
      }
      results.push({ table: "products", migrated, errors });
    }

    // 2. categories (image_url column)
    {
      let migrated = 0;
      let errors = 0;
      const rows = await pool
        .request()
        .query(
          "SELECT id, image_url FROM categories WHERE image_url IS NOT NULL AND image_url LIKE '%supabase%'",
        );
      for (const row of rows.recordset) {
        try {
          const newUrl = await migrateImageUrl(row.image_url, "categories");
          if (newUrl) {
            await pool
              .request()
              .input("id", row.id)
              .input("image_url", newUrl)
              .query(
                "UPDATE categories SET image_url = @image_url WHERE id = @id",
              );
            migrated++;
          }
        } catch (e: any) {
          console.error(`Error migrating category ${row.id}:`, e.message);
          errors++;
        }
      }
      results.push({ table: "categories", migrated, errors });
    }

    // 3. banners (image column)
    {
      let migrated = 0;
      let errors = 0;
      const rows = await pool
        .request()
        .query(
          "SELECT id, image FROM banners WHERE image IS NOT NULL AND image LIKE '%supabase%'",
        );
      for (const row of rows.recordset) {
        try {
          const newUrl = await migrateImageUrl(row.image, "banners");
          if (newUrl) {
            await pool
              .request()
              .input("id", row.id)
              .input("image", newUrl)
              .query("UPDATE banners SET image = @image WHERE id = @id");
            migrated++;
          }
        } catch (e: any) {
          console.error(`Error migrating banner ${row.id}:`, e.message);
          errors++;
        }
      }
      results.push({ table: "banners", migrated, errors });
    }

    // 4. blogs (images JSON column)
    {
      let migrated = 0;
      let errors = 0;
      const rows = await pool
        .request()
        .query(
          "SELECT id, images FROM blogs WHERE images IS NOT NULL AND images LIKE '%supabase%'",
        );
      for (const row of rows.recordset) {
        try {
          const { newJson, count } = await migrateJsonImages(
            row.images,
            "blog",
          );
          if (count > 0) {
            await pool
              .request()
              .input("id", row.id)
              .input("images", newJson)
              .query("UPDATE blogs SET images = @images WHERE id = @id");
            migrated += count;
          }
        } catch (e: any) {
          console.error(`Error migrating blog ${row.id}:`, e.message);
          errors++;
        }
      }
      results.push({ table: "blogs", migrated, errors });
    }

    // 5. testimonials (image column)
    {
      let migrated = 0;
      let errors = 0;
      const rows = await pool
        .request()
        .query(
          "SELECT id, image FROM testimonials WHERE image IS NOT NULL AND image LIKE '%supabase%'",
        );
      for (const row of rows.recordset) {
        try {
          const newUrl = await migrateImageUrl(row.image, "testimonials");
          if (newUrl) {
            await pool
              .request()
              .input("id", row.id)
              .input("image", newUrl)
              .query("UPDATE testimonials SET image = @image WHERE id = @id");
            migrated++;
          }
        } catch (e: any) {
          console.error(`Error migrating testimonial ${row.id}:`, e.message);
          errors++;
        }
      }
      results.push({ table: "testimonials", migrated, errors });
    }

    // 6. branches (image column)
    {
      let migrated = 0;
      let errors = 0;
      const rows = await pool
        .request()
        .query(
          "SELECT id, image FROM branches WHERE image IS NOT NULL AND image LIKE '%supabase%'",
        );
      for (const row of rows.recordset) {
        try {
          const newUrl = await migrateImageUrl(row.image, "branches");
          if (newUrl) {
            await pool
              .request()
              .input("id", row.id)
              .input("image", newUrl)
              .query("UPDATE branches SET image = @image WHERE id = @id");
            migrated++;
          }
        } catch (e: any) {
          console.error(`Error migrating branch ${row.id}:`, e.message);
          errors++;
        }
      }
      results.push({ table: "branches", migrated, errors });
    }

    // 7. news (images JSON or image column)
    {
      let migrated = 0;
      let errors = 0;
      // Try images (JSON) first
      try {
        const rows = await pool
          .request()
          .query(
            "SELECT id, images FROM news WHERE images IS NOT NULL AND images LIKE '%supabase%'",
          );
        for (const row of rows.recordset) {
          try {
            const { newJson, count } = await migrateJsonImages(
              row.images,
              "news",
            );
            if (count > 0) {
              await pool
                .request()
                .input("id", row.id)
                .input("images", newJson)
                .query("UPDATE news SET images = @images WHERE id = @id");
              migrated += count;
            }
          } catch (e: any) {
            console.error(`Error migrating news ${row.id}:`, e.message);
            errors++;
          }
        }
      } catch {
        // images column might not exist, try image column
        try {
          const rows = await pool
            .request()
            .query(
              "SELECT id, image FROM news WHERE image IS NOT NULL AND image LIKE '%supabase%'",
            );
          for (const row of rows.recordset) {
            try {
              const newUrl = await migrateImageUrl(row.image, "news");
              if (newUrl) {
                await pool
                  .request()
                  .input("id", row.id)
                  .input("image", newUrl)
                  .query("UPDATE news SET image = @image WHERE id = @id");
                migrated++;
              }
            } catch (e: any) {
              console.error(`Error migrating news ${row.id}:`, e.message);
              errors++;
            }
          }
        } catch {
          // news table might not have image columns
        }
      }
      results.push({ table: "news", migrated, errors });
    }

    // 8. combo_offers (image_url column)
    {
      let migrated = 0;
      let errors = 0;
      try {
        const rows = await pool
          .request()
          .query(
            "SELECT id, image_url FROM combo_offers WHERE image_url IS NOT NULL AND image_url LIKE '%supabase%'",
          );
        for (const row of rows.recordset) {
          try {
            const newUrl = await migrateImageUrl(
              row.image_url,
              "combo-offers",
            );
            if (newUrl) {
              await pool
                .request()
                .input("id", row.id)
                .input("image_url", newUrl)
                .query(
                  "UPDATE combo_offers SET image_url = @image_url WHERE id = @id",
                );
              migrated++;
            }
          } catch (e: any) {
            console.error(`Error migrating combo_offer ${row.id}:`, e.message);
            errors++;
          }
        }
      } catch {
        // table might not exist
      }
      results.push({ table: "combo_offers", migrated, errors });
    }

    // 9. offers (image_url column)
    {
      let migrated = 0;
      let errors = 0;
      try {
        const rows = await pool
          .request()
          .query(
            "SELECT id, image_url FROM offers WHERE image_url IS NOT NULL AND image_url LIKE '%supabase%'",
          );
        for (const row of rows.recordset) {
          try {
            const newUrl = await migrateImageUrl(row.image_url, "offers");
            if (newUrl) {
              await pool
                .request()
                .input("id", row.id)
                .input("image_url", newUrl)
                .query(
                  "UPDATE offers SET image_url = @image_url WHERE id = @id",
                );
              migrated++;
            }
          } catch (e: any) {
            console.error(`Error migrating offer ${row.id}:`, e.message);
            errors++;
          }
        }
      } catch {
        // table might not exist
      }
      results.push({ table: "offers", migrated, errors });
    }

    // 10. admin_profiles (avatar_url column)
    {
      let migrated = 0;
      let errors = 0;
      try {
        const rows = await pool
          .request()
          .query(
            "SELECT user_id, avatar_url FROM admin_profiles WHERE avatar_url IS NOT NULL AND avatar_url LIKE '%supabase%'",
          );
        for (const row of rows.recordset) {
          try {
            const newUrl = await migrateImageUrl(row.avatar_url, "avatars");
            if (newUrl) {
              await pool
                .request()
                .input("user_id", row.user_id)
                .input("avatar_url", newUrl)
                .query(
                  "UPDATE admin_profiles SET avatar_url = @avatar_url WHERE user_id = @user_id",
                );
              migrated++;
            }
          } catch (e: any) {
            console.error(
              `Error migrating admin_profile ${row.user_id}:`,
              e.message,
            );
            errors++;
          }
        }
      } catch {
        // table might not exist
      }
      results.push({ table: "admin_profiles", migrated, errors });
    }

    // 11. profiles (avatar_url column)
    {
      let migrated = 0;
      let errors = 0;
      try {
        const rows = await pool
          .request()
          .query(
            "SELECT user_id, avatar_url FROM profiles WHERE avatar_url IS NOT NULL AND avatar_url LIKE '%supabase%'",
          );
        for (const row of rows.recordset) {
          try {
            const newUrl = await migrateImageUrl(row.avatar_url, "avatars");
            if (newUrl) {
              await pool
                .request()
                .input("user_id", row.user_id)
                .input("avatar_url", newUrl)
                .query(
                  "UPDATE profiles SET avatar_url = @avatar_url WHERE user_id = @user_id",
                );
              migrated++;
            }
          } catch (e: any) {
            console.error(
              `Error migrating profile ${row.user_id}:`,
              e.message,
            );
            errors++;
          }
        }
      } catch {
        // table might not exist
      }
      results.push({ table: "profiles", migrated, errors });
    }

    // 12. site_settings (logo_url, favicon_url)
    {
      let migrated = 0;
      let errors = 0;
      try {
        const rows = await pool
          .request()
          .query(
            "SELECT id, logo_url, favicon_url FROM site_settings WHERE (logo_url LIKE '%supabase%' OR favicon_url LIKE '%supabase%')",
          );
        for (const row of rows.recordset) {
          try {
            let logoUrl = row.logo_url;
            let faviconUrl = row.favicon_url;

            if (isSupabaseUrl(logoUrl)) {
              const newUrl = await migrateImageUrl(logoUrl, "site-settings");
              if (newUrl) {
                logoUrl = newUrl;
                migrated++;
              }
            }
            if (isSupabaseUrl(faviconUrl)) {
              const newUrl = await migrateImageUrl(
                faviconUrl,
                "site-settings",
              );
              if (newUrl) {
                faviconUrl = newUrl;
                migrated++;
              }
            }

            await pool
              .request()
              .input("id", row.id)
              .input("logo_url", logoUrl)
              .input("favicon_url", faviconUrl)
              .query(
                "UPDATE site_settings SET logo_url = @logo_url, favicon_url = @favicon_url WHERE id = @id",
              );
          } catch (e: any) {
            console.error(
              `Error migrating site_settings ${row.id}:`,
              e.message,
            );
            errors++;
          }
        }
      } catch {
        // table might not exist
      }
      results.push({ table: "site_settings", migrated, errors });
    }

    // 13. galleries (image_urls JSON)
    {
      let migrated = 0;
      let errors = 0;
      try {
        const rows = await pool
          .request()
          .query(
            "SELECT id, image_urls FROM galleries WHERE image_urls IS NOT NULL AND image_urls LIKE '%supabase%'",
          );
        for (const row of rows.recordset) {
          try {
            const { newJson, count } = await migrateJsonImages(
              row.image_urls,
              "galleries",
            );
            if (count > 0) {
              await pool
                .request()
                .input("id", row.id)
                .input("image_urls", newJson)
                .query(
                  "UPDATE galleries SET image_urls = @image_urls WHERE id = @id",
                );
              migrated += count;
            }
          } catch (e: any) {
            console.error(`Error migrating gallery ${row.id}:`, e.message);
            errors++;
          }
        }
      } catch {
        // table might not exist
      }
      results.push({ table: "galleries", migrated, errors });
    }

    const totalMigrated = results.reduce((sum, r) => sum + r.migrated, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

    res.json({
      success: true,
      message: `Migration complete: ${totalMigrated} images migrated, ${totalErrors} errors`,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check how many Supabase URLs remain in the database
 */
export const checkSupabaseUrls = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const pool = getPool();
    const checks: { table: string; column: string; count: number }[] = [];

    const queries = [
      { table: "products", column: "images" },
      { table: "categories", column: "image_url" },
      { table: "banners", column: "image" },
      { table: "blogs", column: "images" },
      { table: "testimonials", column: "image" },
      { table: "branches", column: "image" },
      { table: "news", column: "images" },
      { table: "combo_offers", column: "image_url" },
      { table: "offers", column: "image_url" },
      { table: "admin_profiles", column: "avatar_url" },
      { table: "profiles", column: "avatar_url" },
      { table: "site_settings", column: "logo_url" },
      { table: "galleries", column: "image_urls" },
    ];

    for (const q of queries) {
      try {
        const result = await pool
          .request()
          .query(
            `SELECT COUNT(*) as cnt FROM ${q.table} WHERE ${q.column} IS NOT NULL AND ${q.column} LIKE '%supabase%'`,
          );
        checks.push({
          table: q.table,
          column: q.column,
          count: result.recordset[0].cnt,
        });
      } catch {
        checks.push({ table: q.table, column: q.column, count: -1 });
      }
    }

    const total = checks
      .filter((c) => c.count > 0)
      .reduce((sum, c) => sum + c.count, 0);

    res.json({
      success: true,
      message: `Found ${total} records with Supabase URLs`,
      data: checks.filter((c) => c.count !== 0),
    });
  } catch (error) {
    next(error);
  }
};
