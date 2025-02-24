import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { Router } from "express";
import multer from "multer";
import path from "path";
import { insertUserSchema } from "@shared/schema";

// Configure multer for handling file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    try {
      console.log('Processing file upload:', file.originalname);

      if (!file) {
        console.error('No file received');
        cb(new Error('No file uploaded'));
        return;
      }

      const ext = path.extname(file.originalname).toLowerCase();
      console.log('File extension:', ext);

      if (ext !== '.csv') {
        console.error('Invalid file type:', ext);
        cb(new Error('Only CSV files (.csv) are allowed'));
        return;
      }

      cb(null, true);
    } catch (error) {
      console.error('File upload error:', error);
      cb(error as Error);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

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

  // Template download route
  app.get("/api/users/template", (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    // Create CSV content
    const headers = [
      'Username*', 'Password*', 'Full Name*', 'Employee ID*', 'Role*', 
      'Location*', 'Email*', 'Phone Number*', 'Process Name', 'Education', 
      'Batch Name', 'Date of Joining', 'Date of Birth', 'Manager Username'
    ].join(',');

    const example = [
      'john.doe', 'password123', 'John Doe', 'EMP001', 'trainee',
      'New York', 'john@example.com', '1234567890', 'Sales', 'Bachelor',
      'Batch-2023', '2023-01-01', '1990-01-01', 'manager.username'
    ].join(',');

    const instructions = [
      '\n\nInstructions:',
      '1. Fields marked with * are mandatory',
      '2. Role must be one of: trainee, trainer, manager',
      '3. Password must be at least 6 characters',
      '4. Phone number must be 10 digits',
      '5. Email must be valid format',
      '6. Dates should be in YYYY-MM-DD format',
      '7. Manager Username is required for trainee and trainer roles'
    ].join('\n');

    const csvContent = headers + '\n' + example + instructions;

    res.setHeader('Content-Disposition', 'attachment; filename=users-template.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvContent);
  });

  // CSV upload route
  app.post("/api/users/upload", (req, res) => {
    console.log('Received upload request');

    upload.single('file')(req, res, async (err) => {
      try {
        if (err) {
          console.error('Multer error:', err);
          return res.status(400).json({ message: err.message });
        }

        if (!req.user) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        if (!req.file || !req.file.buffer) {
          console.error('No file in request');
          return res.status(400).json({ message: "No file uploaded" });
        }

        console.log('Processing file:', req.file.originalname);

        // Parse CSV content
        const csvContent = req.file.buffer.toString('utf-8');
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',');

        // Process data rows (skip header)
        const results = {
          success: 0,
          failures: [] as { row: number; error: string }[]
        };

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue; // Skip empty lines

          try {
            const values = line.split(',');
            const row = Object.fromEntries(
              headers.map((header, index) => [header.trim(), values[index]?.trim()])
            );

            // Find manager if specified
            let managerId: number | undefined;
            if (row['Manager Username']) {
              const manager = await storage.getUserByUsername(row['Manager Username']);
              if (!manager) {
                throw new Error('Manager not found');
              }
              managerId = manager.id;
            }

            // Prepare user data
            const userData = {
              username: row['Username'],
              password: row['Password'],
              fullName: row['Full Name'],
              employeeId: row['Employee ID'],
              role: row['Role']?.toLowerCase(),
              location: row['Location'],
              email: row['Email'],
              phoneNumber: row['Phone Number'],
              processName: row['Process Name'],
              education: row['Education'],
              batchName: row['Batch Name'],
              dateOfJoining: row['Date of Joining'],
              dateOfBirth: row['Date of Birth'],
              organizationId: req.user.organizationId,
              managerId
            };

            // Validate data
            insertUserSchema.parse(userData);

            // Create user
            await storage.createUser(userData);
            results.success++;
          } catch (error: any) {
            results.failures.push({
              row: i + 1, // Add 1 for 1-based row numbering
              error: error.message
            });
          }
        }

        res.json(results);
      } catch (error: any) {
        console.error('CSV upload error:', error);
        res.status(400).json({ message: error.message || 'Upload failed' });
      }
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}