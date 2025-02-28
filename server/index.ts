import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, log } from "./vite";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Basic CORS setup
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  log(`${req.method} ${req.path}`);

  res.on("finish", () => {
    const duration = Date.now() - start;
    log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
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

  // In development, use Vite's dev server
  if (process.env.NODE_ENV !== 'production') {
    await setupVite(app, server);
  } else {
    // In production, serve static files
    app.use(express.static(path.join(__dirname, '../dist/public')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, '../dist/public/index.html'));
    });
  }

  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`Server running at http://0.0.0.0:${port}`);
  });
})();