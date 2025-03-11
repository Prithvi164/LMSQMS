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

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
debugLog("Basic middleware setup complete");

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { message: "Too many requests, please try again later." },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
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

    // Try multiple ports if the default one is in use
    const tryPorts = [3000, 3001, 4000, 4001, 5000, 5001];
    let portIndex = 0;
    let serverStarted = false;

    while (portIndex < tryPorts.length && !serverStarted) {
      const port = process.env.PORT || tryPorts[portIndex];
      debugLog(`Attempting to start server on port ${port}`);

      try {
        await new Promise((resolve, reject) => {
          server.listen(port, "0.0.0.0")
            .once('listening', () => {
              log(`Server running in ${app.get("env")} mode`);
              log(`API and client being served on port ${port}`);
              debugLog("Server started successfully");
              serverStarted = true;
              resolve(true);
            })
            .once('error', (error: any) => {
              if (error.code === 'EADDRINUSE') {
                debugLog(`Port ${port} is already in use, trying next port`);
                portIndex++;
                resolve(false);
              } else {
                debugLog(`Server startup error: ${error.message}`);
                reject(error);
              }
            });
        });
      } catch (error: any) {
        log(`Failed to start server: ${error}`);
        debugLog(`Fatal error during server startup: ${error}`);
        process.exit(1);
      }
    }

    if (!serverStarted) {
      const error = new Error(`Could not find an available port in range ${tryPorts.join(', ')}`);
      log(error.message);
      debugLog(`Fatal error: ${error.message}`);
      process.exit(1);
    }
  } catch (error) {
    debugLog(`Fatal error during initialization: ${error}`);
    log(`Failed to start server: ${error}`);
    process.exit(1);
  }
})();