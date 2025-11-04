import { Router, Request, Response } from 'express';
import { getPool } from '../config/database';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check database connection
    const pool = getPool();
    await pool.request().query('SELECT 1');

    res.json({
      success: true,
      message: 'Backend is running and database is connected',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Backend is running but database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Database connection test
 */
router.get('/health/db', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        DB_NAME() as database_name,
        @@SERVERNAME as server_name,
        @@VERSION as version
    `);

    res.json({
      success: true,
      message: 'Database connected successfully',
      data: result.recordset[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

