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
import { insertOrganizationProcessSchema } from "@shared/schema"; //Import schema for process

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

  // User routes - Add logging for debugging
  app.get("/api/user", (req, res) => {
    console.log("GET /api/user - Current user:", req.user);
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(req.user);
  });

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

  // Update the PATCH /api/organizations/:id/settings route to remove process handling
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
        case "batchNames":
          result = await storage.createBatch({
            name: value,
            organizationId: orgId,
          });
          break;
        case "locations":
          // Ensure value is an object with all required fields
          if (typeof value !== 'object') {
            return res.status(400).json({ message: "Location data must be an object with required fields" });
          }

          const { name, address, city, state, country } = value;
          if (!name || !address || !city || !state || !country) {
            return res.status(400).json({
              message: "Missing required location fields. Required: name, address, city, state, country"
            });
          }

          result = await storage.createLocation({
            name,
            address,
            city,
            state,
            country,
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

  // Organization settings route - Update with proper debugging
  app.get("/api/organizations/:id/settings", async (req, res) => {
    console.log("GET /api/organizations/:id/settings - Request params:", req.params);
    console.log("GET /api/organizations/:id/settings - Current user:", req.user);

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const orgId = parseInt(req.params.id);
      if (!orgId) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view your own organization's settings" });
      }

      // Fetch all required data
      const [processes, batches, locations] = await Promise.all([
        storage.listProcesses(orgId),
        storage.listBatches(orgId),
        storage.listLocations(orgId),
      ]);

      // Ensure we have arrays
      const response = {
        processes: Array.isArray(processes) ? processes : [],
        batches: Array.isArray(batches) ? batches : [],
        locations: Array.isArray(locations) ? locations : [],
      };

      // Log response for debugging
      console.log('Organization settings response:', {
        orgId,
        processCount: response.processes.length,
        batchCount: response.batches.length,
        locationCount: response.locations.length
      });

      return res.json(response);
    } catch (err: any) {
      console.error("Error fetching organization settings:", err);
      return res.status(500).json({
        message: "Failed to fetch organization settings",
        error: err.message
      });
    }
  });

  // Organization settings route to fetch all required data for batch creation
  app.get("/api/organizations/:id/settings", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view your own organization's settings" });
      }

      console.log(`Fetching settings for organization ${orgId}`);

      // Fetch all required data
      const [processes, batches, locations] = await Promise.all([
        storage.listProcesses(orgId),
        storage.listBatches(orgId),
        storage.listLocations(orgId),
      ]);

      // Ensure processes and locations are arrays
      const response = {
        processes: Array.isArray(processes) ? processes : [],
        batches: Array.isArray(batches) ? batches : [],
        locations: Array.isArray(locations) ? locations : [],
      };

      // Log response data for debugging
      console.log('Organization settings response:', {
        processCount: response.processes.length,
        batchCount: response.batches.length,
        locationCount: response.locations.length,
        processes: response.processes,
      });

      return res.json(response);
    } catch (err: any) {
      console.error("Error fetching organization settings:", err);
      return res.status(500).json({
        message: "Failed to fetch organization settings",
        error: err.message
      });
    }
  });


  // Organization Process Routes
  app.post("/api/organizations/:id/processes", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only create processes in your own organization" });
      }

      // Validate and create process data
      const processData = {
        ...req.body,
        organizationId: orgId,
      };

      const validatedData = insertOrganizationProcessSchema.parse(processData);
      const process = await storage.createProcess(validatedData);
      res.status(201).json(process);
    } catch (error: any) {
      console.error("Process creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Get organization processes
  app.get("/api/organizations/:id/processes", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view processes in your own organization" });
      }

      const processes = await storage.listProcesses(orgId);
      res.json(processes);
    } catch (error: any) {
      console.error("Error fetching processes:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update a specific process
  app.patch("/api/organizations/:orgId/processes/:processId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const processId = parseInt(req.params.processId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only update processes in your own organization" });
      }

      // Get the existing process
      const existingProcess = await storage.getProcess(processId);
      if (!existingProcess) {
        return res.status(404).json({ message: "Process not found" });
      }

      // Update the process
      const updatedProcess = await storage.updateProcess(processId, {
        ...req.body,
        organizationId: orgId
      });

      res.json(updatedProcess);
    } catch (err: any) {
      console.error("Process update error:", err);
      res.status(500).json({ message: err.message || "Failed to update process" });
    }
  });

  // Delete a specific process
  app.delete("/api/organizations/:orgId/processes/:processId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const processId = parseInt(req.params.processId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only delete processes in your own organization" });
      }

      // Get the existing process
      const existingProcess = await storage.getProcess(processId);
      if (!existingProcess) {
        return res.status(404).json({ message: "Process not found" });
      }

      // Delete the process
      await storage.deleteProcess(processId);
      res.status(200).json({ message: "Process deleted successfully" });
    } catch (err: any) {
      console.error("Process deletion error:", err);
      res.status(500).json({ message: err.message || "Failed to delete process" });
    }
  });

  // Add these routes after the existing process routes
  // Line of Business Routes
  app.post("/api/organizations/:id/line-of-businesses", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only create LOBs in your own organization" });
      }

      const lobData = {
        ...req.body,
        organizationId: orgId,
      };

      const lob = await storage.createLineOfBusiness(lobData);
      res.status(201).json(lob);
    } catch (error: any) {
      console.error("LOB creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/organizations/:id/line-of-businesses", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view LOBs in your own organization" });
      }

      const lobs = await storage.listLineOfBusinesses(orgId);
      res.json(lobs);
    } catch (error: any) {
      console.error("Error fetching LOBs:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/organizations/:orgId/line-of-businesses/:lobId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const lobId = parseInt(req.params.lobId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only update LOBs in your own organization" });
      }

      // Get the existing LOB
      const existingLob = await storage.getLineOfBusiness(lobId);
      if (!existingLob) {
        return res.status(404).json({ message: "Line of Business not found" });
      }

      // Update the LOB
      const updatedLob = await storage.updateLineOfBusiness(lobId, {
        ...req.body,
        organizationId: orgId
      });

      res.json(updatedLob);
    } catch (err: any) {
      console.error("LOB update error:", err);
      res.status(500).json({ message: err.message || "Failed to update LOB" });
    }
  });

  app.delete("/api/organizations/:orgId/line-of-businesses/:lobId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const lobId = parseInt(req.params.lobId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only delete LOBs in your own organization" });
      }

      // Get the existing LOB
      const existingLob = await storage.getLineOfBusiness(lobId);
      if (!existingLob) {
        return res.status(404).json({ message: "Line of Business not found" });
      }

      // Delete the LOB
      await storage.deleteLineOfBusiness(lobId);
      res.status(200).json({ message: "Line of Business deleted successfully" });
    } catch (err: any) {
      console.error("LOB deletion error:", err);
      res.status(500).json({ message: err.message || "Failed to delete LOB" });
    }
  });

  // User management routes
  app.get("/api/users", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });

    try {
      console.log(`Fetching users for organization ${req.user.organizationId}`);
      const users = await storage.listUsers(req.user.organizationId);
      console.log(`Found ${users.length} users, including ${users.filter(u => u.role === 'trainer').length} trainers`);
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // User routes - Replacing the original with the edited code
  app.post("/api/users", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { processes, ...userData } = req.body;

      // Hash the password before creating the user
      const hashedPassword = await hashPassword(userData.password);

      // Prepare user data
      const userToCreate = {
        ...userData,
        password: hashedPassword,
        role: userData.role.toLowerCase(),
        organizationId: req.user.organizationId,
      };

      // Create user with processes if provided
      const result = await storage.createUserWithProcesses(
        userToCreate,
        processes || [],
        req.user.organizationId
      );

      res.status(201).json(result.user);
    } catch (error: any) {
      console.error("User creation error:", error);
      // Handle unique constraint violations
      if (error.message.includes('already exists')) {
        return res.status(400).json({ message: error.message });
      }
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
      'LineOfBusiness',  // New field
      'Processes',       // New field
      'ManagerUsername',
      'DateOfJoining',
      'DateOfBirth',
      'Education'
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
      'Sales',          // Example LOB
      'Process1,Process2', // Multiple processes separated by comma
      'manager.username',
      '2023-01-01',  // YYYY-MM-DD format
      '1990-01-01',  // YYYY-MM-DD format
      'Bachelors'
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
      '8. Location must match existing values in your organization',
      '9. LineOfBusiness must match an existing Line of Business name',
      '10. Processes should be comma-separated process names that exist in the selected Line of Business'
    ].join('\n');

    const csvContent = headers + '\n' + example + instructions;

    res.setHeader('Content-Disposition', 'attachment; filename=users-template.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvContent);
  });

  // CSV upload route with LOB and Process handling
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
      const headers = lines[0].split(',').map(h => h.trim().replace(/[\r\n*]/g, ''));

      console.log('Processing CSV with headers:', headers);

      // Process data rows (skip header)
      const results = {
        success: 0,
        failures: [] as { row: number; error: string }[]
      };

      // Fetch organization settings first
      const [processes, batches, locations, lineOfBusinesses] = await Promise.all([
        storage.listProcesses(req.user.organizationId),
        storage.listBatches(req.user.organizationId),
        storage.listLocations(req.user.organizationId),
        storage.listLineOfBusinesses(req.user.organizationId),
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
            const fieldName = header.toLowerCase()
              .replace(/\s+/g, '')
              .replace('*', '');
            userData[fieldName] = values[index];
          });

          // Basic validation (same as before)
          if (!userData.username) throw new Error('Username is required');
          if (!userData.password) throw new Error('Password is required');
          if (!userData.fullname) throw new Error('Full Name is required');
          if (!userData.employeeid) throw new Error('Employee ID is required');
          if (!userData.email) throw new Error('Email is required');
          if (!userData.role) throw new Error('Role is required');
          if (!userData.phonenumber) throw new Error('Phone Number is required');

          // Check username uniqueness
          const existingUser = await storage.getUserByUsername(userData.username);
          if (existingUser) {
            throw new Error(`Username '${userData.username}' already exists`);
          }

          // Find LOB if specified
          let processIds: number[] = [];
          if (userData.lineofbusiness && userData.processes) {
            const lob = lineOfBusinesses.find(l => 
              l.name.toLowerCase() === userData.lineofbusiness.toLowerCase()
            );
            if (!lob) {
              throw new Error(`Line of Business not found: ${userData.lineofbusiness}`);
            }

            // Get processes for this LOB
            const lobProcesses = processes.filter(p => p.lineOfBusinessId === lob.id);
            const requestedProcessNames = userData.processes.split(',').map(p => p.trim());

            // Validate and collect process IDs
            for (const processName of requestedProcessNames) {
              const process =lobProcesses.find(p => 
                p.name.toLowerCase() === processName.toLowerCase()
              );
              if (!process) {
                throw new Error(`Process "${processName}" not found in Line of Business "${userData.lineofbusiness}"`);
              }
              processIds.push(process.id);
            }
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
          }

          // Find location if specified
          let locationId: number | null = null;
          if (userData.location) {
            const location = locations.find(l => 
              l.name.toLowerCase() === userData.location.toLowerCase()
            );
            if (!location) {
              throw new Error(`Location not found: ${userData.location}`);
            }
            locationId = location.id;
          }

          // Format dates properly
          const dateOfJoining = userData.dateofjoining ? new Date(userData.dateofjoining).toISOString().split('T')[0] : null;
          const dateOfBirth = userData.dateofbirth ? new Date(userData.dateofbirth).toISOString().split('T')[0] : null;

          // Hash the password
          const hashedPassword = await hashPassword(userData.password);

          // Create user with validated data
          const userToCreate = {
            username: userData.username,
            password: hashedPassword,
            fullName: userData.fullname,
            employeeId: userData.employeeid,
            role: userData.role.toLowerCase(),
            email: userData.email,
            phoneNumber: userData.phonenumber,
            dateOfJoining,
            dateOfBirth,
            education: userData.education || null,
            organizationId: req.user.organizationId,
            managerId,
            locationId,
            active: true
          };

          // Create user with processes
          const result = await storage.createUserWithProcesses(
            userToCreate,
            processIds,
            req.user.organizationId
          );

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

  // User management routes
  app.get("/api/users", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });

    try {
      console.log(`Fetching users for organization ${req.user.organizationId}`);
      const users = await storage.listUsers(req.user.organizationId);
      console.log(`Found ${users.length} users, including ${users.filter(u => u.role === 'trainer').length} trainers`);
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // User routes - Replacing the original with the edited code
  app.post("/api/users", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { processes, ...userData } = req.body;

      // Hash the password before creating the user
      const hashedPassword = await hashPassword(userData.password);

      // Prepare user data
      const userToCreate = {
        ...userData,
        password: hashedPassword,
        role: userData.role.toLowerCase(),
        organizationId: req.user.organizationId,
      };

      // Create user with processes if provided
      const result = await storage.createUserWithProcesses(
        userToCreate,
        processes || [],
        req.user.organizationId
      );

      res.status(201).json(result.user);
    } catch (error: any) {
      console.error("User creation error:", error);
      // Handle unique constraint violations
      if (error.message.includes('already exists')) {
        return res.status(400).json({ message: error.message });
      }
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
      'LineOfBusiness',  // New field
      'Processes',       // New field
      'ManagerUsername',
      'DateOfJoining',
      'DateOfBirth',
      'Education'
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
      'Sales',          // Example LOB
      'Process1,Process2', // Multiple processes separated by comma
      'manager.username',
      '2023-01-01',  // YYYY-MM-DD format
      '1990-01-01',  // YYYY-MM-DD format
      'Bachelors'
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
      '8. Location must match existing values in your organization',
      '9. LineOfBusiness must match an existing Line of Business name',
      '10. Processes should be comma-separated process names that exist in the selected Line of Business'
    ].join('\n');

    const csvContent = headers + '\n' + example + instructions;

    res.setHeader('Content-Disposition', 'attachment; filename=users-template.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvContent);
  });

  // CSV upload route with LOB and Process handling
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
      const headers = lines[0].split(',').map(h => h.trim().replace(/[\r\n*]/g, ''));

      console.log('Processing CSV with headers:', headers);

      // Process data rows (skip header)
      const results = {
        success: 0,
        failures: [] as { row: number; error: string }[]
      };

      // Fetch organization settings first
      const [processes, batches, locations, lineOfBusinesses] = await Promise.all([
        storage.listProcesses(req.user.organizationId),
        storage.listBatches(req.user.organizationId),
        storage.listLocations(req.user.organizationId),
        storage.listLineOfBusinesses(req.user.organizationId),
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
            const fieldName = header.toLowerCase()
              .replace(/\s+/g, '')
              .replace('*', '');
            userData[fieldName] = values[index];
          });

          // Basic validation (same as before)
          if (!userData.username) throw new Error('Username is required');
          if (!userData.password) throw new Error('Password is required');
          if (!userData.fullname) throw new Error('Full Name is required');
          if (!userData.employeeid) throw new Error('Employee ID is required');
          if (!userData.email) throw new Error('Email is required');
          if (!userData.role) throw new Error('Role is required');
          if (!userData.phonenumber) throw new Error('Phone Number is required');

          // Check username uniqueness
          const existingUser = await storage.getUserByUsername(userData.username);
          if (existingUser) {
            throw new Error(`Username '${userData.username}' already exists`);
          }

          // Find LOB if specified
          let processIds: number[] = [];
          if (userData.lineofbusiness && userData.processes) {
            const lob = lineOfBusinesses.find(l => 
              l.name.toLowerCase() === userData.lineofbusiness.toLowerCase()
            );
            if (!lob) {
              throw new Error(`Line of Business not found: ${userData.lineofbusiness}`);
            }

            // Get processes for this LOB
            const lobProcesses = processes.filter(p => p.lineOfBusinessId === lob.id);
            const requestedProcessNames = userData.processes.split(',').map(p => p.trim());

            // Validate and collect process IDs
            for (const processName of requestedProcessNames) {
              const process = lobProcesses.find(p => 
                p.name.toLowerCase() === processName.toLowerCase()
              );
              if (!process) {
                throw new Error(`Process "${processName}" not found in Line of Business "${userData.lineofbusiness}"`);
              }
              processIds.push(process.id);
            }
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
          }

          // Find location if specified
          let locationId: number | null = null;
          if (userData.location) {
            const location = locations.find(l => 
              l.name.toLowerCase() === userData.location.toLowerCase()
            );
            if (!location) {
              throw new Error(`Location not found: ${userData.location}`);
            }
            locationId = location.id;
          }

          // Format dates properly
          const dateOfJoining = userData.dateofjoining ? new Date(userData.dateofjoining).toISOString().split('T')[0] : null;
          const dateOfBirth = userData.dateofbirth ? new Date(userData.dateofbirth).toISOString().split('T')[0] : null;

          // Hash the password
          const hashedPassword = await hashPassword(userData.password);

          // Create user with validated data
          const userToCreate = {
            username: userData.username,
            password: hashedPassword,
            fullName: userData.fullname,
            employeeId: userData.employeeid,
            role: userData.role.toLowerCase(),
            email: userData.email,
            phoneNumber: userData.phonenumber,
            dateOfJoining,
            dateOfBirth,
            education: userData.education || null,
            organizationId: req.user.organizationId,
            managerId,
            locationId,
            active: true,
            lineOfBusinessId: processIds.length > 0 ? lineOfBusinesses.find(l => l.name.toLowerCase() === userData.lineofbusiness.toLowerCase())?.id : null,
            processIds
          };

          console.log('Creating user:', { ...userToCreate, password: '[REDACTED]' });
          await storage.createUser(userToCreate);
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

  // Add this route to get all users with location information
  app.get("/api/organizations/:orgId/users", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view users in your own organization" });
      }

      // First get all locations
      const locations = await storage.listLocations(orgId);

      // Then get users and map location information
      const users = await storage.listUsers(orgId);

      const usersWithLocation = users.map(user => {
        const location = locations.find(loc => loc.id === user.locationId);
        return {
          ...user,
          locationName: location ? location.name : null
        };
      });

      console.log('Users with location:', usersWithLocation);
      res.json(usersWithLocation);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add this route to get locations
  app.get("/api/organizations/:orgId/locations", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view locations in your own organization" });
      }

      const locations = await storage.listLocations(orgId);
      console.log('Locations:', locations);
      res.json(locations);
    } catch (error: any) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add the delete user route to the existing routes
  app.delete("/api/users/:id", async (req, res) => {
    if (!req.user) {
      console.log('Delete user request rejected: No authenticated user');
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const userId = parseInt(req.params.id);
      console.log(`Processing delete request for user ID: ${userId} by user: ${req.user.id}`);

      const userToDelete = await storage.getUser(userId);
      if (!userToDelete) {
        console.log(`Delete request failed: User ${userId} not found`);
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deleting owner
      if (userToDelete.role === 'owner') {
        console.log(`Delete request rejected: Cannot delete owner account`);
        return res.status(403).json({ message: "Cannot delete owner account" });
      }

      // Only owners and admins can delete users
      if (req.user.role !== 'owner' && req.user.role !== 'admin') {
        console.log(`Delete request rejected: Insufficient permissions for user ${req.user.id}`);
        return res.status(403).json({ message: "Insufficient permissions to delete users" });
      }

      console.log(`Proceeding with deletion of user ${userId}`);
      await storage.deleteUser(userId);

      console.log(`User ${userId} deleted successfully`);
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error: any) {
      console.error("Error in delete user route:", error);
      res.status(500).json({ message: error.message || "Failed to delete user" });
    }
  });

  // Route to get user processes
  app.get("/api/users/:id/processes", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const userId = parseInt(req.params.id);
      const processes = await storage.getUserProcesses(userId);
      res.json(processes);
    } catch (error: any) {
      console.error("Error fetching user processes:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}