import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log } from "./vite";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure CORS for development
app.use((req, res, next) => {
  // Allow Vite dev server origin in development
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Configure CSP headers
  res.header(
    'Content-Security-Policy',
    "default-src 'self' http://localhost:5173; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173; style-src 'self' 'unsafe-inline' http://localhost:5173;"
  );

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

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
  const server = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ message: err.message || 'Internal Server Error' });
  });

  if (process.env.NODE_ENV === 'production') {
    // In production, serve from dist/public
    log('Running in production mode', 'express');
    app.use(express.static(path.join(__dirname, '../dist/public')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, '../dist/public/index.html'));
    });
  } else {
    // In development, only handle /api routes
    log('Running in development mode - API server only', 'express');

    // Add helpful message for root path in development
    app.get('/', (_req, res) => {
      res.send(`
        <h1>LMS API Server</h1>
        <p>This is the API server running in development mode.</p>
        <p>To access the frontend application, please visit: 
          <a href="http://localhost:5173">http://localhost:5173</a>
        </p>
        <p>API endpoints are available under the /api path.</p>
      `);
    });
  }

  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`API Server running at http://0.0.0.0:${port}`, 'express');
  });
})();