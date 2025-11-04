import { Response, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../types';
import { ApiError } from '../middleware/errorHandler';
import supabaseStorage from '../config/supabase';

// Configure multer for memory storage
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

/**
 * Upload file to Supabase Storage
 */
export const uploadFile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'No file uploaded');
    }

    const folder = (req.body.folder as string) || 'general';
    const file = req.file;

    // Generate unique filename
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabaseStorage.storage
      .from('lapip-storage') // Your Supabase storage bucket name
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new ApiError(500, 'Failed to upload file');
    }

    // Get public URL
    const { data: urlData } = supabaseStorage.storage
      .from('lapip-storage')
      .getPublicUrl(filePath);

    res.json({
      success: true,
      data: {
        url: urlData.publicUrl,
        path: filePath,
        filename: fileName,
      },
      message: 'File uploaded successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload multiple files to Supabase Storage
 */
export const uploadMultipleFiles = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new ApiError(400, 'No files uploaded');
    }

    const folder = (req.body.folder as string) || 'general';
    const uploadedFiles = [];

    for (const file of files) {
      // Generate unique filename
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabaseStorage.storage
        .from('lapip-storage')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
        });

      if (error) {
        console.error('Supabase upload error:', error);
        continue; // Skip this file and continue with others
      }

      // Get public URL
      const { data: urlData } = supabaseStorage.storage
        .from('lapip-storage')
        .getPublicUrl(filePath);

      uploadedFiles.push({
        url: urlData.publicUrl,
        path: filePath,
        filename: fileName,
      });
    }

    res.json({
      success: true,
      data: uploadedFiles,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete file from Supabase Storage
 */
export const deleteFile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { path } = req.body;

    if (!path) {
      throw new ApiError(400, 'File path is required');
    }

    // Delete from Supabase Storage
    const { error } = await supabaseStorage.storage
      .from('lapip-storage')
      .remove([path]);

    if (error) {
      console.error('Supabase delete error:', error);
      throw new ApiError(500, 'Failed to delete file');
    }

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};


