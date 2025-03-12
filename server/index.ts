import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import rateLimit from 'express-rate-limit';
import { startBatchStatusCron } from './cron/batch-status-cron';

// Add debug logging
const DEBUG = true;
function debugLog(message: string) {
  if (DEBUG) {
    console.log(`[DEBUG] ${new Date().toISOString()}: ${message}`);
  }
}

debugLog("Starting server initialization");

const app = express();
debugLog("Express app created");

// Configure trust proxy - Add this before other middleware
app.set('trust proxy', 1);
debugLog("Trust proxy configured");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
debugLog("Basic middleware setup complete");

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api', limiter);
debugLog("Rate limiting configured");

// Enhanced request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }

    if (logLine.length > 80) {
      logLine = logLine.slice(0, 79) + "…";
    }

    log(logLine);
  });

  next();
});
debugLog("Request logging middleware setup complete");

// Add a test route to verify server is handling requests
app.get("/health", (_req, res) => {
  res.json({ status: "ok", mode: app.get("env") });
});
debugLog("Health check route added");

(async () => {
  try {
    debugLog("Starting async initialization");

    // Create HTTP server explicitly
    debugLog("Registering routes...");
    const server = await registerRoutes(app);
    debugLog("Routes registered successfully");

    // Start the batch status update cron job
    debugLog("Starting batch status cron job...");
    startBatchStatusCron();
    log("Started batch status update cron job");
    debugLog("Batch status cron job started");

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });
    debugLog("Error handling middleware setup complete");

    // Set development mode explicitly
    app.set("env", "development");
    debugLog(`Environment set to: ${app.get("env")}`);

    if (app.get("env") === "development") {
      debugLog("Setting up Vite middleware for development");
      await setupVite(app, server);
      debugLog("Vite middleware setup complete");
    } else {
      debugLog("Setting up static file serving for production");
      serveStatic(app);
      debugLog("Static file serving setup complete");
    }

    // Fixed port configuration
    const PORT = 5000; // Hardcoded to 5000 as required
    debugLog(`Starting server on port ${PORT}`);

    // Bind to 0.0.0.0 to ensure accessibility
    server.listen(PORT, '0.0.0.0', () => {
      log(`Server running in ${app.get("env")} mode`);
      log(`API and client being served at http://0.0.0.0:${PORT}`);
      debugLog("Server started successfully");
    });

  } catch (error) {
    debugLog(`Fatal error during initialization: ${error}`);
    log(`Failed to start server: ${error}`);
    process.exit(1);
  }
})();