import { Response, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../types';
import { ApiError } from '../middleware/errorHandler';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

function getPublicUrl(filePath: string, req?: any): string {
  if (req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    if (host) {
      return `${protocol}://${host}/uploads/${filePath.replace(/\\/g, '/')}`;
    }
  }
  const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${apiUrl}/uploads/${filePath.replace(/\\/g, '/')}`;
}

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

    const fileExt = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const folderPath = path.join(UPLOADS_DIR, folder);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const diskPath = path.join(folderPath, fileName);
    fs.writeFileSync(diskPath, file.buffer);

    const filePath = `${folder}/${fileName}`;
    const publicUrl = getPublicUrl(filePath, req);

    res.json({
      success: true,
      data: {
        url: publicUrl,
        path: filePath,
        filename: fileName,
      },
      message: 'File uploaded successfully',
    });
  } catch (error) {
    next(error);
  }
};

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
    const folderPath = path.join(UPLOADS_DIR, folder);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const uploadedFiles = [];

    for (const file of files) {
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const diskPath = path.join(folderPath, fileName);

      fs.writeFileSync(diskPath, file.buffer);

      const filePath = `${folder}/${fileName}`;
      const publicUrl = getPublicUrl(filePath, req);

      uploadedFiles.push({
        url: publicUrl,
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

export const deleteFile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { path: filePath } = req.body;

    if (!filePath) {
      throw new ApiError(400, 'File path is required');
    }

    const diskPath = path.join(UPLOADS_DIR, filePath);

    if (fs.existsSync(diskPath)) {
      fs.unlinkSync(diskPath);
    }

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
