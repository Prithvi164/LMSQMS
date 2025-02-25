import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { Router } from "express";
import multer from "multer";
import path from "path";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

// Configure multer for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    try {
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

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

  // Test route to hash a specific user's password
  app.post("/api/admin/hash-password", async (req, res) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const { email, password } = req.body;
      const hashedPassword = await hashPassword(password);

      // Update the user's password
      await storage.updateUserPassword(email, hashedPassword);

      res.json({ message: "Password hashed successfully" });
    } catch (error: any) {
      console.error("Password hashing error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Organization routes
  app.get("/api/organization", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });
    const organization = await storage.getOrganization(req.user.organizationId);
    res.json(organization);
  });

  // Update the organization settings route
  app.patch("/api/organizations/:id/settings", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization they're trying to modify
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only modify your own organization's settings" });
      }

      const { type, value } = req.body;
      if (!type || !value) {
        return res.status(400).json({ message: "Missing type or value" });
      }

      let result;
      // Create new setting based on type
      switch (type) {
        case "processNames":
          result = await storage.createProcess({
            name: value,
            organizationId: orgId,
          });
          break;
        case "batchNames":
          result = await storage.createBatch({
            name: value,
            organizationId: orgId,
          });
          break;
        case "locations":
          result = await storage.createLocation({
            name: value,
            organizationId: orgId,
          });
          break;
        default:
          return res.status(400).json({ message: "Invalid settings type" });
      }

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Add routes to get organization settings
  app.get("/api/organizations/:id/settings", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view your own organization's settings" });
      }

      const [processes, batches, locations] = await Promise.all([
        storage.listProcesses(orgId),
        storage.listBatches(orgId),
        storage.listLocations(orgId),
      ]);

      res.json({
        processes,
        batches,
        locations,
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // User management routes
  app.get("/api/users", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });
    const users = await storage.listUsers(req.user.organizationId);
    res.json(users);
  });

  // User routes
  app.post("/api/users", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      // Hash the password before creating the user
      const hashedPassword = await hashPassword(req.body.password);

      // Validate the request body
      const userData = {
        ...req.body,
        password: hashedPassword,
        role: req.body.role.toLowerCase(), // Ensure role is lowercase
        organizationId: req.user.organizationId, // Use req.user.organizationId for security
      };

      // Create the user
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error: any) {
      console.error("User creation error:", error);
      res.status(400).json({ message: error.message || "Failed to create user" });
    }
  });

  // Update user route
  app.patch("/api/users/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const userId = parseInt(req.params.id);
      const updateData = req.body;

      // Check if trying to deactivate an admin
      if ('active' in updateData && !updateData.active) {
        const userToUpdate = await storage.getUser(userId);
        if (userToUpdate?.role === 'admin') {
          return res.status(403).json({ message: "Admin users cannot be deactivated" });
        }
      }

      // If password is being updated, hash it
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("User update error:", error);
      res.status(400).json({ message: error.message || "Failed to update user" });
    }
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
  app.post("/api/users/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!req.file?.buffer) {
        return res.status(400).json({ message: "No file uploaded" });
      }

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
        if (!line) continue;

        try {
          const values = line.split(',');
          const userData = Object.fromEntries(
            headers.map((header, index) => [header.trim(), values[index]?.trim()])
          );

          // Hash the password
          const hashedPassword = await hashPassword(userData['Password']);

          // Find manager if specified
          let managerId: number | undefined;
          if (userData['Manager Username']) {
            const manager = await storage.getUserByUsername(userData['Manager Username']);
            if (!manager) {
              throw new Error('Manager not found');
            }
            managerId = manager.id;
          }

          // Create user with validated data
          await storage.createUser({
            username: userData['Username'],
            password: hashedPassword,
            fullName: userData['Full Name'],
            employeeId: userData['Employee ID'],
            role: userData['Role'].toLowerCase(),
            email: userData['Email'],
            phoneNumber: userData['Phone Number'],
            dateOfJoining: userData['Date of Joining'],
            dateOfBirth: userData['Date of Birth'],
            education: userData['Education'],
            organizationId: req.user.organizationId,
            managerId,
          });

          results.success++;
        } catch (error: any) {
          results.failures.push({
            row: i + 1,
            error: error.message
          });
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error('CSV upload error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/reset-db", async (req, res) => {
    try {
      // Truncate tables in correct order due to foreign key constraints
      await sql`
        TRUNCATE TABLE "user_progress" CASCADE;
        TRUNCATE TABLE "learning_path_courses" CASCADE;
        TRUNCATE TABLE "learning_paths" CASCADE;
        TRUNCATE TABLE "courses" CASCADE;
        TRUNCATE TABLE "users" CASCADE;
        TRUNCATE TABLE "organizations" CASCADE;
      `;

      res.json({ message: "Database truncated successfully" });
    } catch (error) {
      console.error("Truncate error:", error);
      res.status(500).json({ message: "Failed to truncate database", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}