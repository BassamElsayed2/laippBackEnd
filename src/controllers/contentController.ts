import { Response, NextFunction } from 'express';
import { getPool, sql } from '../config/database';
import { AuthRequest, Banner } from '../types';
import { ApiError } from '../middleware/errorHandler';

/**
 * Get all banners
 */
export const getBanners = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const pool = getPool();

    const result = await pool.request().query<Banner>(`
      SELECT *
      FROM banners
      WHERE is_active = 1
      ORDER BY display_order ASC, created_at DESC
    `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create banner (Admin only)
 */
export const createBanner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { desc_ar, desc_en, image, display_order, is_active } = req.body;
    const pool = getPool();

    const result = await pool
      .request()
      .input('desc_ar', sql.NVarChar(sql.MAX), desc_ar || null)
      .input('desc_en', sql.NVarChar(sql.MAX), desc_en || null)
      .input('image', sql.NVarChar(sql.MAX), image || null)
      .input('display_order', sql.Int, display_order || 0)
      .input('is_active', sql.Bit, is_active !== undefined ? is_active : true)
      .query<Banner>(`
        INSERT INTO banners (desc_ar, desc_en, image, display_order, is_active)
        OUTPUT INSERTED.*
        VALUES (@desc_ar, @desc_en, @image, @display_order, @is_active)
      `);

    res.status(201).json({
      success: true,
      data: result.recordset[0],
      message: 'Banner created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update banner (Admin only)
 */
export const updateBanner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { desc_ar, desc_en, image, display_order, is_active } = req.body;
    const pool = getPool();

    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .input('desc_ar', sql.NVarChar(sql.MAX), desc_ar || null)
      .input('desc_en', sql.NVarChar(sql.MAX), desc_en || null)
      .input('image', sql.NVarChar(sql.MAX), image || null)
      .input('display_order', sql.Int, display_order || 0)
      .input('is_active', sql.Bit, is_active !== undefined ? is_active : true)
      .query<Banner>(`
        UPDATE banners
        SET desc_ar = @desc_ar,
            desc_en = @desc_en,
            image = @image,
            display_order = @display_order,
            is_active = @is_active
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, 'Banner not found');
    }

    res.json({
      success: true,
      data: result.recordset[0],
      message: 'Banner updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete banner (Admin only)
 */
export const deleteBanner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query('DELETE FROM banners WHERE id = @id');

    res.json({
      success: true,
      message: 'Banner deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all blogs
 */
export const getBlogs = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const status = req.query.status as string;
    const search = req.query.search as string;
    const date = req.query.date as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const pool = getPool();
    const request = pool.request();

    // Build WHERE clause
    const conditions: string[] = [];

    if (status && req.user?.role === 'admin') {
      conditions.push('status = @status');
      request.input('status', sql.NVarChar, status);
    } else if (!req.user || req.user.role !== 'admin') {
      conditions.push("status = 'published'");
    }

    if (search) {
      conditions.push('(title_ar LIKE @search OR title_en LIKE @search)');
      request.input('search', sql.NVarChar, `%${search}%`);
    }

    if (date) {
      const now = new Date();
      let startDate: Date;

      switch (date) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case 'year':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        default:
          startDate = new Date(0);
      }

      conditions.push('created_at >= @startDate');
      request.input('startDate', sql.DateTime, startDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await request.query(`
      SELECT COUNT(*) as total
      FROM blogs
      ${whereClause}
    `);

    const total = countResult.recordset[0].total;

    // Get paginated data
    request.input('offset', sql.Int, offset);
    request.input('limit', sql.Int, limit);

    const result = await request.query(`
      SELECT *
      FROM blogs
      ${whereClause}
      ORDER BY created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

    // Parse images JSON for each blog
    const blogs = result.recordset.map((blog: any) => {
      if (blog.images) {
        try {
          blog.images = JSON.parse(blog.images);
        } catch (e) {
          blog.images = [];
        }
      }
      return blog;
    });

    res.json({
      success: true,
      data: blogs,
      total: total,
      page: page,
      limit: limit,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get blog by ID
 */
export const getBlogById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query(`
        SELECT *
        FROM blogs
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, 'Blog not found');
    }

    // Parse images JSON
    const blog = result.recordset[0];
    if (blog.images) {
      try {
        blog.images = JSON.parse(blog.images);
      } catch (e) {
        blog.images = [];
      }
    }

    res.json({
      success: true,
      data: blog,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all testimonials
 */
export const getTestimonials = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = 1, limit = 10, search, date, status } = req.query;
    const pool = getPool();

    const offset = (Number(page) - 1) * Number(limit);
    let whereConditions: string[] = [];

    // Search filter
    if (search) {
      whereConditions.push(`(name_ar LIKE '%${search}%' OR name_en LIKE '%${search}%' OR message_ar LIKE '%${search}%' OR message_en LIKE '%${search}%')`);
    }

    // Date filter
    if (date) {
      const now = new Date();
      let startDate: Date;
      
      switch (date) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(0);
      }
      whereConditions.push(`created_at >= '${startDate.toISOString()}'`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.request().query(`
      SELECT COUNT(*) as total FROM testimonials ${whereClause}
    `);
    const total = countResult.recordset[0].total;

    // Get paginated data
    const result = await pool.request().query(`
      SELECT *
      FROM testimonials
      ${whereClause}
      ORDER BY created_at DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `);

    res.json({
      success: true,
      data: result.recordset,
      pagination: {
        total,
        totalPages: Math.ceil(total / Number(limit)),
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get testimonial by ID
 */
export const getTestimonialById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query(`
        SELECT *
        FROM testimonials
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found',
      });
    }

    res.json({
      success: true,
      data: result.recordset[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create testimonial (Admin only)
 */
export const createTestimonial = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name_ar, name_en, message_ar, message_en, image } = req.body;
    const pool = getPool();

    const result = await pool
      .request()
      .input('name_ar', sql.NVarChar(sql.MAX), name_ar || null)
      .input('name_en', sql.NVarChar(sql.MAX), name_en || null)
      .input('message_ar', sql.NVarChar(sql.MAX), message_ar || null)
      .input('message_en', sql.NVarChar(sql.MAX), message_en || null)
      .input('image', sql.NVarChar(sql.MAX), image || null)
      .query(`
        INSERT INTO testimonials (name_ar, name_en, message_ar, message_en, image)
        OUTPUT INSERTED.*
        VALUES (@name_ar, @name_en, @message_ar, @message_en, @image)
      `);

    res.status(201).json({
      success: true,
      data: result.recordset[0],
      message: 'Testimonial created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update testimonial (Admin only)
 */
export const updateTestimonial = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name_ar, name_en, message_ar, message_en, image } = req.body;
    const pool = getPool();

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('name_ar', sql.NVarChar(sql.MAX), name_ar)
      .input('name_en', sql.NVarChar(sql.MAX), name_en)
      .input('message_ar', sql.NVarChar(sql.MAX), message_ar)
      .input('message_en', sql.NVarChar(sql.MAX), message_en)
      .input('image', sql.NVarChar(sql.MAX), image)
      .query(`
        UPDATE testimonials
        SET 
          name_ar = COALESCE(@name_ar, name_ar),
          name_en = COALESCE(@name_en, name_en),
          message_ar = COALESCE(@message_ar, message_ar),
          message_en = COALESCE(@message_en, message_en),
          image = COALESCE(@image, image)
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found',
      });
    }

    res.json({
      success: true,
      data: result.recordset[0],
      message: 'Testimonial updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete testimonial (Admin only)
 */
export const deleteTestimonial = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query(`
        DELETE FROM testimonials
        WHERE id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found',
      });
    }

    res.json({
      success: true,
      message: 'Testimonial deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all branches
 */
export const getBranches = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const pool = getPool();

    const result = await pool.request().query(`
      SELECT *
      FROM branches
      ORDER BY id ASC
    `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create branch (Admin only)
 */
export const createBranch = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name_ar, name_en, area_ar, area_en, address_ar, address_en, phone, google_map, image, works_hours } = req.body;
    const pool = getPool();

    const result = await pool
      .request()
      .input('name_ar', sql.NVarChar(255), name_ar || null)
      .input('name_en', sql.NVarChar(255), name_en || null)
      .input('area_ar', sql.NVarChar(255), area_ar || null)
      .input('area_en', sql.NVarChar(255), area_en || null)
      .input('address_ar', sql.NVarChar(500), address_ar || null)
      .input('address_en', sql.NVarChar(500), address_en || null)
      .input('phone', sql.NVarChar(50), phone || null)
      .input('google_map', sql.NVarChar(sql.MAX), google_map || null)
      .input('image', sql.NVarChar(sql.MAX), image || null)
      .input('works_hours', sql.NVarChar(255), works_hours || null)
      .query(`
        INSERT INTO branches (name_ar, name_en, area_ar, area_en, address_ar, address_en, phone, google_map, image, works_hours)
        OUTPUT INSERTED.*
        VALUES (@name_ar, @name_en, @area_ar, @area_en, @address_ar, @address_en, @phone, @google_map, @image, @works_hours)
      `);

    res.status(201).json({
      success: true,
      data: result.recordset[0],
      message: 'Branch created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update branch (Admin only)
 */
export const updateBranch = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name_ar, name_en, area_ar, area_en, address_ar, address_en, phone, google_map, image, works_hours } = req.body;
    const pool = getPool();

    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .input('name_ar', sql.NVarChar(255), name_ar || null)
      .input('name_en', sql.NVarChar(255), name_en || null)
      .input('area_ar', sql.NVarChar(255), area_ar || null)
      .input('area_en', sql.NVarChar(255), area_en || null)
      .input('address_ar', sql.NVarChar(500), address_ar || null)
      .input('address_en', sql.NVarChar(500), address_en || null)
      .input('phone', sql.NVarChar(50), phone || null)
      .input('google_map', sql.NVarChar(sql.MAX), google_map || null)
      .input('image', sql.NVarChar(sql.MAX), image || null)
      .input('works_hours', sql.NVarChar(255), works_hours || null)
      .query(`
        UPDATE branches
        SET name_ar = @name_ar,
            name_en = @name_en,
            area_ar = @area_ar,
            area_en = @area_en,
            address_ar = @address_ar,
            address_en = @address_en,
            phone = @phone,
            google_map = @google_map,
            image = @image,
            works_hours = @works_hours
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, 'Branch not found');
    }

    res.json({
      success: true,
      data: result.recordset[0],
      message: 'Branch updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete branch (Admin only)
 */
export const deleteBranch = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query(`
        DELETE FROM branches
        WHERE id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      throw new ApiError(404, 'Branch not found');
    }

    res.json({
      success: true,
      message: 'Branch deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create blog (Admin only)
 */
export const createBlog = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { title_ar, title_en, content_ar, content_en, images, yt_code, author, status } = req.body;
    const pool = getPool();

    // Convert images array to JSON string
    const imagesJson = images ? JSON.stringify(images) : null;

    const result = await pool
      .request()
      .input('title_ar', sql.NVarChar(sql.MAX), title_ar || null)
      .input('title_en', sql.NVarChar(sql.MAX), title_en || null)
      .input('content_ar', sql.NVarChar(sql.MAX), content_ar || null)
      .input('content_en', sql.NVarChar(sql.MAX), content_en || null)
      .input('images', sql.NVarChar(sql.MAX), imagesJson)
      .input('yt_code', sql.NVarChar(255), yt_code || null)
      .input('author', sql.NVarChar(255), author || null)
      .input('status', sql.NVarChar(50), status || 'published')
      .query(`
        INSERT INTO blogs (title_ar, title_en, content_ar, content_en, images, yt_code, author, status)
        OUTPUT INSERTED.*
        VALUES (@title_ar, @title_en, @content_ar, @content_en, @images, @yt_code, @author, @status)
      `);

    // Parse images JSON back to array for response
    const blog = result.recordset[0];
    if (blog.images) {
      try {
        blog.images = JSON.parse(blog.images);
      } catch (e) {
        blog.images = [];
      }
    }

    res.status(201).json({
      success: true,
      data: blog,
      message: 'Blog created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update blog (Admin only)
 */
export const updateBlog = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { title_ar, title_en, content_ar, content_en, images, yt_code, author, status } = req.body;
    const pool = getPool();

    // Convert images array to JSON string
    const imagesJson = images ? JSON.stringify(images) : null;

    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .input('title_ar', sql.NVarChar(sql.MAX), title_ar || null)
      .input('title_en', sql.NVarChar(sql.MAX), title_en || null)
      .input('content_ar', sql.NVarChar(sql.MAX), content_ar || null)
      .input('content_en', sql.NVarChar(sql.MAX), content_en || null)
      .input('images', sql.NVarChar(sql.MAX), imagesJson)
      .input('yt_code', sql.NVarChar(255), yt_code || null)
      .input('author', sql.NVarChar(255), author || null)
      .input('status', sql.NVarChar(50), status || 'published')
      .query(`
        UPDATE blogs
        SET title_ar = @title_ar,
            title_en = @title_en,
            content_ar = @content_ar,
            content_en = @content_en,
            images = @images,
            yt_code = @yt_code,
            author = @author,
            status = @status,
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, 'Blog not found');
    }

    // Parse images JSON back to array for response
    const blog = result.recordset[0];
    if (blog.images) {
      try {
        blog.images = JSON.parse(blog.images);
      } catch (e) {
        blog.images = [];
      }
    }

    res.json({
      success: true,
      data: blog,
      message: 'Blog updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete blog (Admin only)
 */
export const deleteBlog = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query('DELETE FROM blogs WHERE id = @id');

    res.json({
      success: true,
      message: 'Blog deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all news
 */
export const getNews = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const status = req.query.status as string;
    const pool = getPool();

    let whereClause = '';
    const request = pool.request();

    if (status && req.user?.role === 'admin') {
      whereClause = 'WHERE status = @status';
      request.input('status', sql.NVarChar, status);
    } else if (!req.user || req.user.role !== 'admin') {
      whereClause = "WHERE status = 'published'";
    }

    const result = await request.query(`
      SELECT *
      FROM news
      ${whereClause}
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    next(error);
  }
};


