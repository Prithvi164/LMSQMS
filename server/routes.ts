import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

  // Organization routes
  app.get("/api/organization", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const organization = await storage.getOrganization(req.user.organizationId);
    res.json(organization);
  });

  // User management routes
  app.get("/api/users", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const users = await storage.listUsers(req.user.organizationId);
    res.json(users);
  });

  app.patch("/api/users/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);

      // Check if user exists and belongs to same organization
      if (!user || user.organizationId !== req.user.organizationId) {
        return res.status(404).json({ message: "User not found" });
      }

      // Don't allow role changes for non-admin users
      if (req.user.role !== "admin" && req.body.role) {
        return res.status(403).json({ message: "Only admins can change roles" });
      }

      const updatedUser = await storage.updateUser(userId, req.body);
      res.json(updatedUser);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can delete users" });
    }

    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);

      // Check if user exists and belongs to same organization
      if (!user || user.organizationId !== req.user.organizationId) {
        return res.status(404).json({ message: "User not found" });
      }

      // Don't allow deleting the last admin
      if (user.role === "admin") {
        const admins = await storage.listUsers(req.user.organizationId);
        const adminCount = admins.filter(u => u.role === "admin").length;
        if (adminCount <= 1) {
          return res.status(400).json({ message: "Cannot delete the last admin" });
        }
      }

      await storage.deleteUser(userId);
      res.sendStatus(200);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

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