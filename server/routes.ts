import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

  // Course routes
  app.get("/api/courses", async (_req, res) => {
    const courses = await storage.listCourses();
    res.json(courses);
  });

  app.get("/api/courses/:id", async (req, res) => {
    const course = await storage.getCourse(parseInt(req.params.id));
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  });

  // Learning path routes
  app.get("/api/learning-paths", async (_req, res) => {
    const paths = await storage.listLearningPaths();
    res.json(paths);
  });

  app.get("/api/learning-paths/:id", async (req, res) => {
    const path = await storage.getLearningPath(parseInt(req.params.id));
    if (!path) return res.status(404).json({ message: "Learning path not found" });
    res.json(path);
  });

  // User progress routes
  app.get("/api/progress", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const progress = await storage.listUserProgress(req.user.id.toString());
    res.json(progress);
  });

  app.post("/api/progress", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const progress = await storage.createUserProgress({
      ...req.body,
      userId: req.user.id.toString()
    });
    res.status(201).json(progress);
  });

  const httpServer = createServer(app);
  return httpServer;
}