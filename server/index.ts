import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

// Add a test route to verify server is handling requests
app.get("/health", (_req, res) => {
  res.json({ status: "ok", mode: app.get("env") });
});

(async () => {
  try {
    log("Starting server initialization...");
    const server = await registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });

    // Set development mode explicitly
    app.set("env", "development");
    log("Environment set to development mode");

    if (app.get("env") === "development") {
      log("Setting up Vite middleware for development");
      await setupVite(app, server);
    } else {
      log("Setting up static file serving for production");
      serveStatic(app);
    }

    // Force port 5000 for Replit
    const port = 5000;
    log(`Attempting to start server on port ${port}...`);

    server.listen(port, "0.0.0.0", () => {
      log(`Server successfully started and running in ${app.get("env")} mode`);
      log(`API and client being served at http://0.0.0.0:${port}`);
    }).on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        log(`ERROR: Port ${port} is already in use. This port is required by Replit.`);
      } else {
        log(`ERROR: Failed to start server: ${error.message}`);
      }
      process.exit(1);
    });
  } catch (error: any) {
    log(`FATAL: Failed to initialize server: ${error.message}`);
    process.exit(1);
  }
})();