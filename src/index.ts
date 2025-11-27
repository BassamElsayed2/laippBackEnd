import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { connectDB } from "./config/database";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

// Import routes
import authRoutes from "./routes/authRoutes";
import productsRoutes from "./routes/productsRoutes";
import categoriesRoutes from "./routes/categoriesRoutes";
import ordersRoutes from "./routes/ordersRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import contentRoutes from "./routes/contentRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import addressesRoutes from "./routes/addressesRoutes";
import adminRoutes from "./routes/adminRoutes";
import shippingRoutes from "./routes/shipping.routes";
import vouchersRoutes from "./routes/vouchers.routes";

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Security middleware - Enhanced Helmet configuration
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // For inline scripts if needed
        styleSrc: ["'self'", "'unsafe-inline'"], // For inline styles
        imgSrc: ["'self'", "data:", "https:", "http:"], // Allow images from HTTPS/HTTP
        connectSrc: ["'self'"], // Allow connections to same origin
        fontSrc: ["'self'", "data:"], // Allow fonts
        objectSrc: ["'none'"], // Disallow plugins
        mediaSrc: ["'self'"], // Allow media from same origin
        frameSrc: ["'none'"], // Disallow frames
      },
    },
    crossOriginEmbedderPolicy: false, // Allow external resources
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow CORS
  })
);

// CORS configuration
const allowedOrigins = [
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin only in development (like mobile apps or curl requests)
      if (!origin && process.env.NODE_ENV === "development") {
        return callback(null, true);
      }

      if (allowedOrigins.indexOf(origin!) !== -1) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        // Reject unauthorized origins
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Body parser middleware (MUST be before other middlewares that access req.body or req.query)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Rate limiting - Import from middleware
import { apiLimiter } from "./middleware/rateLimiter";
import { ordersLimiter } from "./middleware/rate-limit.middleware";

// Apply general rate limiter to all API routes
app.use("/api/", apiLimiter);

// CSRF Protection - Import from middleware (if exists)
try {
  const {
    csrfProtection,
    securityHeaders,
    suspiciousActivityDetector,
  } = require("./middleware/security.middleware");

  if (csrfProtection) {
    app.use(csrfProtection);
    console.log("✅ CSRF Protection enabled");
  }

  if (securityHeaders) {
    app.use(securityHeaders);
    console.log("✅ Security Headers enabled");
  }

  if (suspiciousActivityDetector) {
    app.use(suspiciousActivityDetector);
    console.log("✅ Suspicious Activity Detector enabled");
  }
} catch (error) {
  console.warn("⚠️ Security middleware not found, continuing without it");
}

// Health check route
app.get("/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/orders", ordersLimiter, ordersRoutes); // Apply orders-specific rate limiter
app.use("/api/payment", paymentRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/addresses", addressesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/vouchers", vouchersRoutes);

// Root route - Also handle EasyKash callbacks that go to root
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Lapip Store API v1.0",
    documentation: "/api/docs",
  });
});

// EasyKash sometimes sends POST callbacks to root URL instead of callback URL
// This is a workaround to handle those callbacks
app.post("/", async (req: Request, res: Response) => {
  console.log("═══════════════════════════════════════");
  console.log("⚠️  Callback received at ROOT URL (/)");
  console.log("═══════════════════════════════════════");
  console.log("This should be going to /api/payment/easykash/callback");
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("═══════════════════════════════════════");

  // Forward to the correct payment controller
  try {
    const {
      handlePaymentCallback,
    } = require("./controllers/paymentController");
    // Call the payment callback handler
    await handlePaymentCallback(req as any, res, () => {});
  } catch (error: any) {
    console.error("Error handling root callback:", error);
    // Still return 200 to prevent EasyKash from retrying
    res.status(200).json({
      success: false,
      message: error.message || "Failed to process callback at root",
    });
  }
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log("✅ Database connected successfully");

    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`📝 API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Handle unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Start the server
startServer();

export default app;
