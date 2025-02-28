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
import { insertOrganizationProcessSchema } from "@shared/schema";
import { UploadLogger, UploadErrorType } from "./utils/uploadLogger";

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

      if (ext !== '.csv' && ext !== '.xlsx') {
        console.error('Invalid file type:', ext);
        cb(new Error('Only CSV (.csv) and Excel (.xlsx) files are allowed'));
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
          // Owner gets all permissions
          [
            "createUser",
            "updateUser",
            "deleteUser",
            "createOrganization",
            "updateOrganization",
            "deleteOrganization",
            "createBatch",
            "updateBatch",
            "deleteBatch",
            "createLocation",
            "updateLocation",
            "deleteLocation",
            "createProcess",
            "updateProcess",
            "deleteProcess",
            "assignProcessToUser",
            "unassignProcessFromUser",
            "viewAllUsers",
            "viewAllOrganizations",
            "viewAllBatches",
            "viewAllLocations",
            "viewAllProcesses"
          ]
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
      const [batches, locations] = await Promise.all([
        storage.listBatches(orgId),
        storage.listLocations(orgId),
      ]);

      // Ensure we have arrays
      const response = {
        batches: Array.isArray(batches) ? batches : [],
        locations: Array.isArray(locations) ? locations : [],
      };

      // Log response for debugging
      console.log('Organization settings response:', {
        orgId,
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


  // Update location route
  app.patch("/api/organizations/:id/settings/locations/:locationId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const locationId = parseInt(req.params.locationId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only modify locations in your own organization" });
      }

      console.log('Updating location:', locationId, 'with data:', req.body);
      const updatedLocation = await storage.updateLocation(locationId, {
        ...req.body,
        organizationId: orgId, // Ensure we keep the correct organization ID
      });

      res.json(updatedLocation);
    } catch (error: any) {
      console.error("Location update error:", error);
      res.status(400).json({ message: error.message || "Failed to update location" });
    }
  });

  // Delete location route
  app.delete("/api/organizations/:id/settings/locations/:locationId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const locationId = parseInt(req.params.locationId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only delete locations in your own organization" });
      }

      console.log('Deleting location:', locationId);
      await storage.deleteLocation(locationId);

      res.json({ message: "Location deleted successfully" });
    } catch (error: any) {
      console.error("Location deletion error:", error);
      res.status(400).json({ message: error.message || "Failed to delete location" });
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

  // Create user endpoint - updated to handle process assignments
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

      // Create user with optional processes
      const result = await storage.createUserWithProcesses(
        userToCreate,
        processes || [], // Allow empty process array
        req.user.organizationId
      );

      res.status(201).json(result.user);
    } catch (error: any) {
      console.error("User creation error:", error);
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

  // Template download route - updated to use CSV format
  app.get("/api/users/template.csv", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    // Define headers with exact case matching for upload
    const headers = [
      'Username*', 'Password*', 'FullName*', 'EmployeeID*', 'Role*',
      'Category*', 'Email*', 'PhoneNumber*', 'ProcessNames*', 'Location',
      'ManagerUsername', 'DateOfJoining', 'DateOfBirth', 'Education'
    ];

    // Example data row matching headers exactly
    const exampleData = [
      'john.doe', 'password123', 'John Doe', 'EMP001', 'trainee',
      'trainee', 'john@example.com', '1234567890', 'Process Name 1,Process Name 2', 'New York',
      'manager.username', '01-01-2023', '01-01-1990', 'Bachelors'
    ];

    // Instructions
    const instructions = [
      ['Instructions:'],
      ['1. Fields marked with * are mandatory'],
      ['2. Role must be one of: trainee, trainer, manager, advisor, team_lead'],
      ['3. Password must be at least 6 characters'],
      ['4. Phone number must be 10 digits'],
      ['5. Email must be valid format'],
      ['6. Dates must be in DD-MM-YYYY format'],
      ['7. ManagerUsername is optional - leave blank if no manager'],
      ['8. Location must match existing values in your organization'],
      ['9. ProcessNames must be comma-separated process names (e.g., "Process Name 1,Process Name 2")'],
      ['10. Category must be either "active" or "trainee"']
    ];

    // Combine all rows and convert to CSV
    const allRows = [headers, exampleData, [], ...instructions];
    const csvContent = allRows
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=user_upload_template.csv');
    res.send(csvContent);
  });

  // Update upload route to handle CSV files and process names with detailed logging
  app.post("/api/users/upload", upload.single('file'), async (req, res) => {
    const logger = new UploadLogger();

    try {
      if (!req.user) {
        logger.logError(0, 'AUTH_CHECK', new Error("Unauthorized"), 'PERMISSION');
        throw new Error("Unauthorized");
      }

      if (!req.file?.buffer) {
        logger.logError(0, 'FILE_CHECK', new Error("No file uploaded"), 'VALIDATION');
        throw new Error("No file uploaded");
      }

      // Verify file type
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext !== '.csv') {
        logger.logError(0, 'FILE_TYPE_CHECK', new Error("Only CSV files are allowed"), 'VALIDATION');
        throw new Error("Only CSV files are allowed");
      }

      // Parse CSV content
      const csvContent = req.file.buffer.toString('utf-8');
      const rows = csvContent.split('\n')
        .map(line => line.split(',')
          .map(cell => cell.trim().replace(/^"|"$/g, ''))
        )
        .filter(row => row.some(cell => cell));

      // Get headers and create a mapping to standardized field names
      const headers = rows[0].map(h => h.trim().replace(/[\r\n*]/g, ''));
      logger.logSuccess(0, 'PARSE_HEADERS', 'Successfully parsed CSV headers', { headers });

      // Define header mapping to standardized field names
      const headerMapping: { [key: string]: string } = {
        'Username': 'username',
        'Password': 'password',
        'FullName': 'fullName',
        'EmployeeID': 'employeeId',
        'Role': 'role',
        'Category': 'category',
        'Email': 'email',
        'PhoneNumber': 'phoneNumber',
        'ProcessNames': 'processNames',
        'Location': 'location',
        'ManagerUsername': 'managerUsername',
        'DateOfJoining': 'dateOfJoining',
        'DateOfBirth': 'dateOfBirth',
        'Education': 'education'
      };

      // Fetch organization settings first
      const [processes, locations] = await Promise.all([
        storage.listProcesses(req.user.organizationId),
        storage.listLocations(req.user.organizationId),
      ]);

      logger.logSuccess(0, 'FETCH_SETTINGS', 'Successfully fetched organization settings', {
        processCount: processes.length,
        locationCount: locations.length,
        processes: processes.map(p => ({ id: p.id, name: p.name })),
        locations: locations.map(l => ({ id: l.id, name: l.name }))
      });

      // Process each row (skip header)
      for (let i = 1; i < rows.length; i++) {
        try {
          const row = rows[i];
          if (!row.length || row.every(cell => !cell)) continue;

          // Map the data using the header mapping
          const userData: Record<string, any> = {};
          headers.forEach((header, index) => {
            const standardField = headerMapping[header] || header.toLowerCase();
            userData[standardField] = row[index]?.trim() || '';
          });

          logger.logSuccess(i, 'PARSE_ROW', 'Successfully parsed row data', {
            ...userData,
            password: '[REDACTED]'
          });

          // Validate required fields
          const requiredFields = ['username', 'password', 'fullName', 'employeeId', 'role', 'category', 'email', 'phoneNumber'];
          for (const field of requiredFields) {
            if (!userData[field]) {
              throw new Error(`${field} is required`);
            }
          }

          // Check username uniqueness
          const existingUser = await storage.getUserByUsername(userData.username);
          if (existingUser) {
            throw new Error(`Username '${userData.username}' already exists`);
          }

          // Find manager if specified
          let managerId: number | null = null;
          if (userData.managerUsername) {
            const manager = await storage.getUserByUsername(userData.managerUsername);
            if (!manager) {
              throw new Error(`Manager not found: ${userData.managerUsername}`);
            }
            managerId = manager.id;
            logger.logSuccess(i, 'FIND_MANAGER', 'Successfully found manager', {
              managerUsername: userData.managerUsername,
              managerId
            });
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
            logger.logSuccess(i, 'FIND_LOCATION', 'Successfully found location', {
              locationName: userData.location,
              locationId
            });
          }

          // Convert process names to IDs
          const processIds: number[] = [];
          if (userData.processNames) {
            const processNames = userData.processNames.split(',')
              .map(name => name.trim())
              .filter(name => name);

            logger.logSuccess(i, 'PARSE_PROCESSES', 'Successfully parsed process names', {
              processNames
            });

            for (const name of processNames) {
              const normalizedName = name.toLowerCase().trim();
              const process = processes.find(p =>
                p.name.toLowerCase().trim() === normalizedName
              );

              if (!process) {
                throw new Error(`Process not found: ${name}. Available processes: ${processes.map(p => p.name).join(', ')}`);
              }
              processIds.push(process.id);
            }

            logger.logSuccess(i, 'MAP_PROCESSES', 'Successfully mapped process names to IDs', {
              processNames,
              processIds
            });
          }

          // Hash the password
          const hashedPassword = await hashPassword(userData.password);

          // Create user with validated data
          const userToCreate = {
            username: userData.username,
            password: hashedPassword,
            fullName: userData.fullName,
            employeeId: userData.employeeId,
            role: userData.role.toLowerCase(),
            category: userData.category.toLowerCase(),
            email: userData.email,
            phoneNumber: userData.phoneNumber,
            dateOfJoining: userData.dateOfJoining || null,
            dateOfBirth: userData.dateOfBirth || null,
            education: userData.education || null,
            organizationId: req.user.organizationId,
            managerId,
            locationId,
            active: true
          };

          logger.logSuccess(i, 'PREPARE_USER', 'User data prepared for creation', {
            ...userToCreate,
            password: '[REDACTED]',
            processIds
          });

          const result = await storage.createUserWithProcesses(
            userToCreate,
            processIds,
            req.user.organizationId
          );

          if (!result || !result.user) {
            throw new Error('Failed to create user');
          }

          logger.logSuccess(i, 'CREATE_USER', 'Successfully created user with processes', {
            userId: result.user.id,
            username: result.user.username,
            processCount: result.processes.length,
            processes: result.processes.map(p => p.processId)
          });

        } catch (error: any) {
          let errorType: keyof typeof UploadErrorType = 'UNKNOWN';

          // Categorize errors
          if (error.message.includes('required')) {
            errorType = 'VALIDATION';
          } else if (error.message.includes('already exists')) {
            errorType = 'USER';
          } else if (error.message.includes('Process not found') || error.message.includes('Location not found')) {
            errorType = 'PROCESS';
          } else if (error.message.includes('permission')) {
            errorType = 'PERMISSION';
          } else if (error.code === '23505') { // Database unique constraint violation
            errorType = 'DATABASE';
          }

          logger.logError(i, 'ROW_PROCESSING', error, errorType, {
            rowNumber: i,
            error: error.message,
            stack: error.stack
          });
        }
      }

      const summary = logger.getBatchSummary();
      res.json(summary);

    } catch (error: any) {
      logger.logError(0, 'FILE_PROCESSING', error, 'UNKNOWN', {
        filename: req.file?.originalname,
        error: error.message,
        stack: error.stack
      });
      const summary = logger.getBatchSummary();
      res.status(400).json({
        message: error.message,
        details: 'Please ensure the file matches the template format',
        summary
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
        return res.status(404).json({ message: ""User not found" });
      }

      // Prevent deleting owner
      if (userToDelete.role === 'owner') {
        console.log(`Delete request rejected: Cannot delete owner account`);
        return res.status(403).json({ message: "Cannot delete owner account" });
      }

      // Only owners and admins can delete users
      if (req.user.role !== 'owner' && req.user.role !== 'admin') {
        console.log`Delete request rejected: Insufficient permissions for user ${req.user.id}`;
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
      console.error("Error fetching user processes:", error);      res.status(500).json({ message: error.message });
    }
  });

  // Add endpoint to get processes by line of business
  app.get("/api/organizations/:orgId/line-of-businesses/:lobId/processes", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const lobId = parseInt(req.params.lobId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view processes in your own organization" });
      }

      const processes = await storage.getProcessesByLineOfBusiness(orgId, lobId);
      res.json(processes);
    } catch (error: any) {
      console.error("Error fetching processes:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add better error handling and authentication for line of business routes
  app.post("/api/organizations/:id/line-of-businesses", async (req, res) => {
    try {
      console.log('Creating new line of business - Request:', {
        userId: req.user?.id,
        organizationId: req.params.id,
        body: req.body
      });

      if (!req.user) {
        console.log('Unauthorized attempt to create line of business');
        return res.status(401).json({ message: "Unauthorized" });
      }

      const orgId = parseInt(req.params.id);
      if (!orgId) {
        console.log('Invalid organization ID provided');
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        console.log(`User ${req.user.id} attempted to create LOB in organization ${orgId}`);
        return res.status(403).json({ message: "You can only create LOBs in your own organization" });
      }

      const lobData = {
        name: req.body.name,
        description: req.body.description,
        organizationId: orgId,
      };

      console.log('Creating LOB with data:', lobData);
      const lob = await storage.createLineOfBusiness(lobData);
      console.log('Successfully created LOB:', lob);

      return res.status(201).json(lob);
    } catch (error: any) {
      console.error("Error creating line of business:", error);
      return res.status(400).json({
        message: error.message || "Failed to create line of business",
        details: error.toString()
      });
    }
  });

  // Update the GET endpoint as well
  app.get("/api/organizations/:id/line-of-businesses", async (req, res) => {
    try {
      console.log('Fetching line of businesses - Request:', {
        userId: req.user?.id,
        organizationId: req.params.id
      });

      if (!req.user) {
        console.log('Unauthorized attempt to fetch line of businesses');
        return res.status(401).json({ message: "Unauthorized" });
      }

      const orgId = parseInt(req.params.id);
      if (!orgId) {
        console.log('Invalid organization ID provided');
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        console.log(`User ${req.user.id} attempted to access LOBs in organization ${orgId}`);
        return res.status(403).json({ message: "You can only view LOBs in your own organization" });
      }

      console.log(`Fetching LOBs for organization ${orgId}`);
      const lobs = await storage.listLineOfBusinesses(orgId);
      console.log(`Found ${lobs.length} LOBs:`, lobs);

      return res.json(lobs || []);
    } catch (error: any) {
      console.error("Error fetching LOBs:", error);
      return res.status(500).json({
        message: "Failed to fetch line of businesses",
        error: error.message,
        details: error.toString()
      });
    }
  });

  // Add this API endpoint if it doesn't exist or modify the existing one
  app.get("/api/organizations/:id/line-of-businesses", async (req, res) => {
    if (!req.user) {
      console.log('Unauthorized access attempt to line of businesses');
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const orgId = parseInt(req.params.id);
      console.log(`Fetching Line of Businesses for organization ${orgId}`);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        console.log(`User ${req.user.id} attempted to access organization ${orgId}'s LOBs`);
        return res.status(403).json({ message: "You can only view LOBs in your own organization" });
      }

      const lobs = await storage.listLineOfBusinesses(orgId);
      console.log(`Found ${lobs.length} Line of Businesses:`, lobs);

      // Ensure we're sending a valid JSON response
      return res.json(lobs || []);
    } catch (error: any) {
      console.error("Error fetching LOBs:", error);
      return res.status(500).json({
        message: "Failed to fetch line of businesses",
        error: error.message
      });
    }
  });

  // Add Organization Process Routes
  // Get organization processes
  app.get("/api/organizations/:id/processes", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      console.log(`Fetching processes for organization ${orgId}`);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view processes in your own organization" });
      }

      const processes = await storage.listProcesses(orgId);
      console.log(`Found ${processes.length} processes`);
      res.json(processes);
    } catch (error: any) {
      console.error("Error fetching processes:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create new process
  app.post("/api/organizations/:id/processes", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only create processes in your own organization" });
      }

      const processData = {
        ...req.body,
        organizationId: orgId,
      };

      console.log('Creating process with data:', processData);

      const validatedData = insertOrganizationProcessSchema.parse(processData);
      const process = await storage.createProcess(validatedData);

      console.log('Process created successfully:', process);
      res.status(201).json(process);
    } catch (error: any) {
      console.error("Process creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Update process
  app.patch("/api/organizations/:id/processes/:processId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const processId = parseInt(req.params.processId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only update processes in your own organization" });
      }

      console.log('Updating process:', processId, 'with data:', req.body);

      const process = await storage.updateProcess(processId, req.body);

      console.log('Process updated successfully:', process);
      res.json(process);
    } catch (error: any) {
      console.error("Process update error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Delete process
  app.delete("/api/organizations/:id/processes/:processId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const processId = parseInt(req.params.processId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only delete processes in your own organization" });
      }

      console.log('Deleting process:', processId);
      await storage.deleteProcess(processId);

      console.log('Process deleted successfully');
      res.status(200).json({ message: "Process deleted successfully" });
    } catch (error: any) {
      console.error("Process deletion error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Add LOB update and delete routes
  app.patch("/api/organizations/:id/line-of-businesses/:lobId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const lobId = parseInt(req.params.lobId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only modify LOBs in your own organization" });
      }

      console.log('Updating LOB:', lobId, 'with data:', req.body);
      const updatedLob = await storage.updateLineOfBusiness(lobId, {
        ...req.body,
        organizationId: orgId, // Ensure we keep the correct organization ID
      });

      res.json(updatedLob);
    } catch (error: any) {
      console.error("LOB update error:", error);
      res.status(400).json({ message: error.message || "Failed to update Line of Business" });
    }
  });

  // Delete LOB route
  app.delete("/api/organizations/:id/line-of-businesses/:lobId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const lobId = parseInt(req.params.lobId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only delete LOBs in your own organization" });
      }

      console.log('Deleting LOB:', lobId);
      await storage.deleteLineOfBusiness(lobId);

      res.json({ message: "Line of Business deleted successfully" });
    } catch (error: any) {
      console.error("LOB deletion error:", error);
      res.status(400).json({ message: error.message || "Failed to delete Line of Business" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}