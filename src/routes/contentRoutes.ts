import { Router } from 'express';
import {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  getBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  getTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  getBranches,
  getNews,
} from '../controllers/contentController';
import { authenticate, requireAdmin, optionalAuth } from '../middleware/auth';
import { validate, createBannerSchema, createBlogSchema, createTestimonialSchema } from '../middleware/validation';

const router = Router();

// Banners
router.get('/banners', getBanners);
router.post('/banners', authenticate, requireAdmin, validate(createBannerSchema), createBanner);
router.put('/banners/:id', authenticate, requireAdmin, updateBanner);
router.delete('/banners/:id', authenticate, requireAdmin, deleteBanner);

// Blogs
router.get('/blogs', optionalAuth, getBlogs);
router.get('/blogs/:id', getBlogById);
router.post('/blogs', authenticate, requireAdmin, validate(createBlogSchema), createBlog);
router.put('/blogs/:id', authenticate, requireAdmin, updateBlog);
router.delete('/blogs/:id', authenticate, requireAdmin, deleteBlog);

// Testimonials
router.get('/testimonials', getTestimonials);
router.get('/testimonials/:id', getTestimonialById);
router.post('/testimonials', authenticate, requireAdmin, validate(createTestimonialSchema), createTestimonial);
router.put('/testimonials/:id', authenticate, requireAdmin, updateTestimonial);
router.delete('/testimonials/:id', authenticate, requireAdmin, deleteTestimonial);

// Branches
router.get('/branches', getBranches);

// News
router.get('/news', optionalAuth, getNews);

export default router;


