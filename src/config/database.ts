import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

const config: sql.config = {
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE || "lapipDb",
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "",
  port: parseInt(process.env.DB_PORT || "1433"),
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    enableArithAbort: true,
    requestTimeout: 30000, // 30 seconds timeout for requests
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let _pool: sql.ConnectionPool | null = null;

export const connectDB = async (): Promise<sql.ConnectionPool> => {
  try {
    if (_pool && _pool.connected) {
      return _pool;
    }

    _pool = await new sql.ConnectionPool(config).connect();
    console.log("✅ Connected to SQL Server database successfully");
    return _pool;
  } catch (error) {
    console.error("❌ Error connecting to SQL Server:", error);
    throw error;
  }
};

export const getPool = (): sql.ConnectionPool => {
  if (!_pool || !_pool.connected) {
    throw new Error("Database pool is not initialized. Call connectDB first.");
  }
  return _pool;
};

export const closeDB = async (): Promise<void> => {
  try {
    if (_pool) {
      await _pool.close();
      _pool = null;
      console.log("Database connection closed");
    }
  } catch (error) {
    console.error("Error closing database connection:", error);
    throw error;
  }
};

// Export a Proxy that calls getPool() on each access to avoid null checks
export { sql };
export const pool = new Proxy({} as sql.ConnectionPool, {
  get: (_, prop) => {
    const p = getPool();
    return typeof p[prop as keyof typeof p] === "function"
      ? (p[prop as keyof typeof p] as Function).bind(p)
      : p[prop as keyof typeof p];
  },
});
