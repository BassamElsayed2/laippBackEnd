import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
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

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(","),
  credentials: true,
  optionsSuccessStatus: 200,
};
// app.use(cors(corsOptions));
app.use(
  cors({
    origin: ["https://lapipstore.ens.eg", "https://lapipstore.ens.eg"],
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"), // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

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
app.use("/api/orders", ordersRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/addresses", addressesRoutes);
app.use("/api/admin", adminRoutes);

// Root route
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Lapip Store API v1.0",
    documentation: "/api/docs",
  });
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
