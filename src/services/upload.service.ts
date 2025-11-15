import sharp from "sharp";
import fs from "fs";
import path from "path";
import { ApiError } from "../middleware/error.middleware";

export class UploadService {
  // Process and optimize image
  static async processImage(
    filePath: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: "jpeg" | "png" | "webp";
    } = {}
  ): Promise<string> {
    try {
      const { width = 1200, height, quality = 80, format = "webp" } = options;

      const outputPath = filePath.replace(path.extname(filePath), `.${format}`);

      await sharp(filePath)
        .resize(width, height, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFormat(format, { quality })
        .toFile(outputPath);

      // Delete original if different from output
      if (filePath !== outputPath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return outputPath;
    } catch (error) {
      throw new ApiError(500, "Failed to process image");
    }
  }

  // Create thumbnail
  static async createThumbnail(
    filePath: string,
    width: number = 300,
    height: number = 300
  ): Promise<string> {
    try {
      const thumbnailPath = filePath.replace(
        path.extname(filePath),
        `_thumb${path.extname(filePath)}`
      );

      await sharp(filePath)
        .resize(width, height, {
          fit: "cover",
        })
        .toFormat("webp", { quality: 70 })
        .toFile(thumbnailPath);

      return thumbnailPath;
    } catch (error) {
      throw new ApiError(500, "Failed to create thumbnail");
    }
  }

  // Delete file
  static deleteFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error("Failed to delete file:", error);
    }
  }

  // Get file URL
  static getFileUrl(filePath: string): string {
    const uploadsDir = process.env.UPLOAD_DIR || "./uploads";
    const apiUrl = process.env.API_URL;

    // Convert backslashes to forward slashes
    let relativePath = filePath.replace(/\\/g, "/");

    // Remove all possible uploads directory prefixes
    relativePath = relativePath
      .replace("./uploads/", "")
      .replace("./uploads", "")
      .replace("uploads/", "")
      .replace("uploads", "");

    // Remove leading slashes
    relativePath = relativePath.replace(/^\/+/, "");

    // Return URL with single /uploads/ prefix
    return `${apiUrl}/uploads/${relativePath}`;
  }
}
