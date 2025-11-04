import { Router } from 'express';
import {
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  upload,
} from '../controllers/uploadController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Upload routes (Admin only)
router.post('/single', authenticate, requireAdmin, upload.single('file'), uploadFile);
router.post('/multiple', authenticate, requireAdmin, upload.array('files', 10), uploadMultipleFiles);
router.delete('/', authenticate, requireAdmin, deleteFile);

export default router;


