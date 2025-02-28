import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log, setupVite, serveStatic } from "./vite";
import path from "path";
import { fileURLToPath } from 'url';
import { createServer } from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  log(`${req.method} ${req.path}`, 'express');

  res.on("finish", () => {
    const duration = Date.now() - start;
    log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`, 'express');
  });

  next();
});

(async () => {
  try {
    // Setup API routes first
    await registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      res.status(500).json({ message: err.message || 'Internal Server Error' });
    });

    if (process.env.NODE_ENV === 'production') {
      // In production, serve from dist/public
      log('Running in production mode', 'express');
      serveStatic(app);
    } else {
      // In development, use Vite's dev server
      log('Running in development mode', 'express');
      await setupVite(app, server);
    }

    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`Server running at http://0.0.0.0:${port}`, 'express');
    });
  } catch (error) {
    console.error('Error during server startup:', error);
    process.exit(1);
  }
})().catch(error => {
  console.error('Unhandled error during server startup:', error);
  process.exit(1);
});