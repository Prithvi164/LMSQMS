import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Authentication middleware
app.use((req, res, next) => {
  // For development, set a mock user with required fields
  if (process.env.NODE_ENV !== 'production') {
    req.user = {
      id: 1,
      username: 'admin',
      password: 'hashed_password',
      fullName: 'Admin User',
      employeeId: 'EMP001',
      role: 'admin',
      email: 'admin@example.com',
      organizationId: 1,
      locationId: 1,
      managerId: null,
      active: true,
      lastLogin: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      certified: true,
    };
  }
  next();
});

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

    if (app.get("env") === "development") {
      log("Setting up Vite middleware for development");
      await setupVite(app, server);
    } else {
      log("Setting up static file serving for production");
      serveStatic(app);
    }

    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`Server running in ${app.get("env")} mode`);
      log(`API and client being served on port ${port}`);
    });
  } catch (error) {
    log(`Failed to start server: ${error}`);
    process.exit(1);
  }
})();