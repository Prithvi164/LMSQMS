import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { Router } from "express";
import multer from "multer";
import path from "path";
import { insertUserSchema, permissionEnum } from "@shared/schema"; // Import permissionEnum from schema
import { z } from "zod";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { insertOrganizationBatchSchema } from "@shared/schema";

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

  // Update the registration route to handle owner role
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, organizationName, ...userData } = req.body;

      // Check if organization exists
      let organization = await storage.getOrganizationByName(organizationName);

      // Create user with owner role regardless of what role was sent in the request
      const userToCreate = {
        ...userData,
        username,
        password: await hashPassword(password),
        role: 'owner', // Force role to be owner for new registrations
        organizationId: organization ? organization.id : undefined
      };

      if (!organization) {
        // If organization doesn't exist, create it first
        organization = await storage.createOrganization({
          name: organizationName
        });

        // Update the organizationId after creating organization
        userToCreate.organizationId = organization.id;
      } else {
        // If organization exists, check if it already has an owner
        const hasOwner = await storage.hasOrganizationOwner(organization.id);
        if (hasOwner) {
          // If organization already has an owner, make this user a trainee
          userToCreate.role = 'trainee';
        }
      }

      // Create the user with the determined role
      const user = await storage.createUser(userToCreate);

      // If this is a new organization's owner, set up their permissions
      if (userToCreate.role === 'owner') {
        await storage.updateRolePermissions(
          organization.id,
          'owner',
          permissionEnum.enumValues // Owner gets all permissions
        );
      }

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(400).json({ message: error.message });
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

      // Get the user to be updated
      const userToUpdate = await storage.getUser(userId);
      if (!userToUpdate) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent changing owner role
      if (userToUpdate.role === 'owner' && updateData.role && updateData.role !== 'owner') {
        return res.status(403).json({ message: "Cannot change the role of an owner" });
      }

      // Prevent assigning owner role
      if (updateData.role === 'owner') {
        return res.status(403).json({ message: "Cannot assign owner role through update" });
      }

      // Check if the user is updating their own profile
      const isOwnProfile = req.user.id === userId;

      // If it's own profile update, allow location and other basic info updates
      if (isOwnProfile) {
        // Filter allowed fields for self-update
        const allowedSelfUpdateFields = [
          'fullName',
          'email',
          'phoneNumber',
          'locationId',
          'dateOfBirth',
          'education'
        ];
        const filteredUpdateData = Object.keys(updateData)
          .filter(key => allowedSelfUpdateFields.includes(key))
          .reduce((obj, key) => {
            obj[key] = updateData[key];
            return obj;
          }, {});

        const updatedUser = await storage.updateUser(userId, filteredUpdateData);
        return res.json(updatedUser);
      }

      // For owner role, allow all updates except role changes to/from owner
      if (req.user.role === 'owner') {
        const updatedUser = await storage.updateUser(userId, updateData);
        return res.json(updatedUser);
      }

      // Admin users can only be modified by owners
      if (userToUpdate.role === 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ message: "Only owners can modify admin users" });
      }

      // Allow admins to change active status for non-owner users
      if (req.user.role === 'admin' && 'active' in updateData) {
        if (userToUpdate.role === 'owner') {
          return res.status(403).json({ message: "Cannot change owner's active status" });
        }
        const updatedUser = await storage.updateUser(userId, { active: updateData.active });
        return res.json(updatedUser);
      }

      // For other roles, restrict certain fields
      const allowedFields = ['fullName', 'phoneNumber', 'locationId', 'dateOfBirth', 'education'];
      const filteredUpdateData = Object.keys(updateData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {});

      const updatedUser = await storage.updateUser(userId, filteredUpdateData);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("User update error:", error);
      res.status(400).json({ message: error.message || "Failed to update user" });
    }
  });


  // Permissions routes
  app.get("/api/permissions", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });

    try {
      const rolePermissions = await storage.listRolePermissions(req.user.organizationId);
      res.json(rolePermissions);
    } catch (error: any) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/permissions/:role", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });

    try {
      const rolePermission = await storage.getRolePermissions(req.user.organizationId, req.params.role);
      if (!rolePermission) {
        return res.status(404).json({ message: "Role permissions not found" });
      }
      res.json(rolePermission);
    } catch (error: any) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/permissions/:role", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });
    if (req.user.role !== "admin") return res.status(403).json({ message: "Only admins can modify permissions" });

    try {
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ message: "Permissions must be an array" });
      }

      const rolePermission = await storage.updateRolePermissions(
        req.user.organizationId,
        req.params.role,
        permissions
      );

      res.json(rolePermission);
    } catch (error: any) {
      console.error("Error updating permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Template download route - update to match CSV upload expectations
  app.get("/api/users/template", (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    // Create CSV content with clear column names and proper date format examples
    const headers = [
      'Username*',
      'Password*',
      'FullName*',
      'EmployeeID*',
      'Role*',
      'Email*',
      'PhoneNumber*',
      'Location',
      'ProcessName',
      'BatchName',
      'DateOfJoining',
      'DateOfBirth',
      'Education',
      'ManagerUsername'
    ].join(',');

    const example = [
      'john.doe',
      'password123',
      'John Doe',
      'EMP001',
      'trainee',
      'john@example.com',
      '1234567890',
      'New York',
      'Customer Support',
      'Batch A - 2025',
      '2023-01-01',  // YYYY-MM-DD format
      '1990-01-01',  // YYYY-MM-DD format
      'Bachelors',
      'manager.username'
    ].join(',');

    const validRoles = [
      'trainee',
      'trainer',
      'manager',
      'advisor',
      'team_lead'
    ].join(', ');

    const instructions = [
      '\n\nInstructions:',
      '1. Fields marked with * are mandatory',
      `2. Role must be one of: ${validRoles}`,
      '3. Password must be at least 6 characters',
      '4. Phone number must be 10 digits',
      '5. Email must be valid format',
      '6. Dates must be in YYYY-MM-DD format (e.g., 2023-01-01)',
      '7. ManagerUsername is optional - leave blank if no manager',
      '8. Location, ProcessName, and BatchName must match existing values in your organization'
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

      // Function to format date string to PostgreSQL format
      const formatDate = (dateStr: string) => {
        if (!dateStr) return null;
        // Check if date is already in YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

        // Try to parse other date formats
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;

        return date.toISOString().split('T')[0];
      };

      // Function to normalize role string
      const normalizeRole = (role: string) => {
        const normalized = role.toLowerCase().replace(/\s+/g, '_');
        const validRoles = ['admin', 'manager', 'trainer', 'trainee', 'advisor', 'team_lead'];
        if (!validRoles.includes(normalized)) {
          throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
        }
        return normalized;
      };

      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/[\r\n*]/g, ''));

      console.log('Processing CSV with headers:', headers);

      // Process data rows (skip header)
      const results = {
        success: 0,
        failures: [] as { row: number; error: string }[]
      };

      // Fetch organization settings first
      const [processes, batches, locations] = await Promise.all([
        storage.listProcesses(req.user.organizationId),
        storage.listBatches(req.user.organizationId),
        storage.listLocations(req.user.organizationId),
      ]);

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          console.log(`\nProcessing row ${i}:`);

          const values = line.split(',').map(v => v.trim());
          if (values.length !== headers.length) {
            throw new Error(`Invalid number of columns. Expected ${headers.length}, got ${values.length}`);
          }

          const userData: Record<string, string> = {};
          headers.forEach((header, index) => {
            // Map CSV headers to database fields
            const fieldName = header.toLowerCase()
              .replace(/\s+/g, '')
              .replace('*', '');
            userData[fieldName] = values[index];
          });

          console.log('Parsed user data:', { ...userData, password: '[REDACTED]' });

          // Basic validation
          if (!userData.username) throw new Error('Username is required');
          if (!userData.password) throw new Error('Password is required');
          if (!userData.fullname) throw new Error('Full Name is required');
          if (!userData.employeeid) throw new Error('Employee ID is required');
          if (!userData.email) throw new Error('Email is required');
          if (!userData.role) throw new Error('Role is required');
          if (!userData.phonenumber) throw new Error('Phone Number is required');

          // Check if username already exists
          const existingUser = await storage.getUserByUsername(userData.username);
          if (existingUser) {
            throw new Error(`Username '${userData.username}' already exists`);
          }

          // Find manager if specified
          let managerId: number | null = null;
          if (userData.managerusername) {
            console.log(`Looking up manager: ${userData.managerusername}`);
            const manager = await storage.getUserByUsername(userData.managerusername);
            if (!manager) {
              throw new Error(`Manager not found: ${userData.managerusername}`);
            }
            managerId = manager.id;
            console.log(`Found manager with ID: ${managerId}`);
          }

          // Find location if specified
          let locationId: number | null = null;
          if (userData.location) {
            const location = locations.find(l => l.name.toLowerCase() === userData.location.toLowerCase());
            if (!location) {
              throw new Error(`Location not found: ${userData.location}`);
            }
            locationId = location.id;
          }

          // Find process if specified
          let processId: number | null = null;
          if (userData.processname) {
            const process = processes.find(p => p.name.toLowerCase() === userData.processname.toLowerCase());
            if (!process) {
              throw new Error(`Process not found: ${userData.processname}`);
            }
            processId = process.id;
          }

          // Find batch if specified
          let batchId: number | null = null;
          if (userData.batchname) {
            const batch = batches.find(b => b.name.toLowerCase() === userData.batchname.toLowerCase());
            if (!batch) {
              throw new Error(`Batch not found: ${userData.batchname}`);
            }
            batchId = batch.id;
          }

          // Format dates properly
          const dateOfJoining = formatDate(userData.dateofjoining);
          const dateOfBirth = formatDate(userData.dateofbirth);

          console.log('Formatted dates:', { dateOfJoining, dateOfBirth });

          // Hash the password
          const hashedPassword = await hashPassword(userData.password);

          // Normalize and validate role
          const normalizedRole = normalizeRole(userData.role);
          console.log('Normalized role:', normalizedRole);

          // Create user with validated data
          const newUser = {
            username: userData.username,
            password: hashedPassword,
            fullName: userData.fullname,
            employeeId: userData.employeeid,
            role: normalizedRole,
            email: userData.email,
            phoneNumber: userData.phonenumber,
            dateOfJoining,
            dateOfBirth,
            education: userData.education || null,
            organizationId: req.user.organizationId,
            managerId,
            locationId,
            processId,
            batchId,
            active: true
          };

          console.log('Creating user:', { ...newUser, password: '[REDACTED]' });
          await storage.createUser(newUser);
          console.log('User created successfully');
          results.success++;
        } catch (error: any) {
          console.error(`Row ${i} processing error:`, error);
          results.failures.push({
            row: i,
            error: error.message || 'Unknown error occurred'
          });
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error('CSV upload error:', error);
      res.status(400).json({
        message: error.message,
        details: 'Please ensure the CSV file matches the template format'
      });
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

  // Batch Management Routes
  app.post("/api/batches", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchData = {
        ...req.body,
        organizationId: req.user.organizationId,
      };

      const validatedData = insertOrganizationBatchSchema.parse(batchData);
      const batch = await storage.createBatch(validatedData);
      res.status(201).json(batch);
    } catch (error: any) {
      console.error("Batch creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/batches", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });

    try {
      const batches = await storage.listBatches(req.user.organizationId);
      res.json(batches);
    } catch (error: any) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/batches/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batch = await storage.getBatch(parseInt(req.params.id));
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }
      if (batch.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(batch);
    } catch (error: any) {
      console.error("Error fetching batch:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/batches/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batch = await storage.getBatch(parseInt(req.params.id));
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }
      if (batch.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedBatch = await storage.updateBatch(parseInt(req.params.id), req.body);
      res.json(updatedBatch);
    } catch (error: any) {
      console.error("Error updating batch:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/batches/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batch = await storage.getBatch(parseInt(req.params.id));
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }
      if (batch.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteBatch(parseInt(req.params.id));
      res.sendStatus(204);
    } catch (error: any) {
      console.error("Error deleting batch:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}