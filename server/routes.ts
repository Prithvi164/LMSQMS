import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { Router } from "express";
import { insertUserSchema, users, userBatchProcesses } from "@shared/schema";
import { z } from "zod";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { insertOrganizationProcessSchema } from "@shared/schema";
import { insertBatchTemplateSchema } from "@shared/schema";
import { batchStatusEnum } from "@shared/schema";
import { permissionEnum } from '@shared/schema';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { db } from './db';
import { join } from 'path';
import express from 'express';
import { eq } from "drizzle-orm";
import { toIST, fromIST, formatIST, toUTCStorage, formatISTDateOnly } from './utils/timezone';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are allowed'), false);
    }
  },
});

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

  // Update the PATCH /api/organizations/:id/settings route to remove batch handling
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

  // Update organization settings route
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
      const [locations] = await Promise.all([
        storage.listLocations(orgId),
      ]);

      // Ensure we have arrays
      const response = {
        locations: Array.isArray(locations) ? locations : [],
      };

      return res.json(response);
    } catch (err: any) {
      console.error("Error fetching organization settings:", err);
      return res.status(500).json({
        message: "Failed to fetch organization settings",
        error: err.message
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
      console.log(`Found ${users.length} users`);
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create user endpoint
  app.post("/api/users", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { processes, lineOfBusinessId, ...userData } = req.body;

      // Validate that lineOfBusinessId is provided when processes are specified
      if (processes?.length > 0 && !lineOfBusinessId) {
        return res.status(400).json({
          message: "Line of Business ID is required when assigning processes"
        });
      }

      // Hash the password before creating the user
      const hashedPassword = await hashPassword(userData.password);

      // Prepare user data with explicit type casting for organizationId
      const userToCreate = {
        ...userData,
        password: hashedPassword,
        role: userData.role.toLowerCase(),
        organizationId: req.user.organizationId as number,
      };

      console.log('Creating user with data:', {
        ...userToCreate,
        processCount: processes?.length || 0,
        lineOfBusinessId
      });

      // Create user with optional processes, ensuring lineOfBusinessId is a number
      const result = await storage.createUserWithProcesses(
        userToCreate,
        processes || [],
        req.user.organizationId,
        lineOfBusinessId ? Number(lineOfBusinessId) : undefined
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

  // Delete user route
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

  // Fixing TypeScript errors in the permissions endpoint
  app.patch("/api/permissions/:role", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });
    if (req.user.role !== "owner" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only owners and admins can modify permissions" });
    }

    try {
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ message: "Permissions must be an array" });
      }

      // Validate that all permissions are valid enum values
      const invalidPermissions = permissions.filter(p => !permissionEnum.enumValues.includes(p));
      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          message: "Invalid permissions provided",
          invalidPermissions
        });
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

  // Update location route
  app.patch("/api/organizations/:id/settings/locations/:locationId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const locationId = parseInt(req.params.locationId);

      // Validate IDs
      if (isNaN(orgId) || isNaN(locationId)) {
        return res.status(400).json({ message: "Invalid organization ID or location ID" });
      }

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only modify locations in your own organization" });
      }

      // Validate request body
      const { name, address, city, state, country } = req.body;
      if (!name || !address || !city || !state || !country) {
        return res.status(400).json({
          message: "Missing required fields. Required: name, address, city, state, country"
        });
      }

      // Get existing location to verify it exists and belongs to organization
      const existingLocation = await storage.getLocation(locationId);
      if (!existingLocation) {
        return res.status(404).json({ message: "Location not found" });
      }
      if (existingLocation.organizationId !== orgId) {
        return res.status(403).json({ message: "Location does not belong to your organization" });
      }

      console.log('Updating location:', locationId, 'with data:', req.body);
      const updatedLocation = await storage.updateLocation(locationId, {
        name,
        address,
        city,
        state,
        country,
        organizationId: orgId, // Ensure we keep the correct organization ID
      });

      res.json(updatedLocation);
    } catch (error: any) {
      console.error("Location update error:", error);
      // Ensure we always return JSON even for errors
      res.status(500).json({
        message: "Failed to update location",
        error: error.message
      });
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
      res.status(500).json({ message: error.message });    }
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
      res.status(200).json({ message: "Process deleted successfully"});
    }catch (error:any) {
      console.error("Process deletion error:", error);
      res.status(400).json({ message: error.message || "Failed to delete process" });
    }
  });

  // Add LOB updateand delete routes
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

  // Add new endpoint to get LOBs by location
  app.get("/api/organizations/:id/locations/:locationId/line-of-businesses", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const locationId = parseInt(req.params.locationId);

      console.log('Fetching LOBs - Request details:', {
        orgId,
        locationId,
        userId: req.user.id,
        userRole: req.user.role,
        userOrgId: req.user.organizationId
      });

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        console.log(`User ${req.user.id} attempted to access LOBs in organization ${orgId}`);
        return res.status(403).json({ message: "You can only view LOBs in your own organization" });
      }

      // Get location to verify it exists and belongs to the organization
      const location = await storage.getLocation(locationId);
      if (!location || location.organizationId !== orgId) {
        console.log(`Location not found or doesn't belong to organization:`, { locationId, orgId });
        return res.status(404).json({ message: "Location not found" });
      }

      // Get LOBs based on location from user_processes table
      const lobs = await storage.getLineOfBusinessesByLocation(orgId, locationId);
      console.log(`Found LOBs for location ${locationId}:`, {
        count: lobs.length,
        lobIds: lobs.map(lob => lob.id),
        lobNames: lobs.map(lob => lob.name)
      });

      res.json(lobs);
    } catch (error: any) {
      console.error("Error fetching LOBs by location:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add batch management routes
  app.get("/api/organizations/:id/batches", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view batches in your own organization" });
      }

      console.log(`Fetching batches for organization ${orgId}`);
      const batches = await storage.listBatches(orgId);
      console.log(`Raw batch data:`, batches);

      // For each batch, get trainee count
      const batchesWithTraineeCount = await Promise.all(
        batches.map(async (batch) => {
          const trainees = await storage.getBatchTrainees(batch.id);
          const traineeCount = trainees.length;

          // Get location name
          console.log(`Fetching location with ID: ${batch.locationId}`);
          const location = await storage.getLocation(batch.locationId);
          console.log('Location found:', location);

          return {
            ...batch,
            traineeCount,
            locationName: location?.name
          };
        })
      );

      return res.json(batchesWithTraineeCount);
    } catch (error: any) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/organizations/:id/batches", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only create batches in your own organization" });
      }

      const batchData = {
        ...req.body,
        organizationId: orgId,
      };

      console.log('Creating batch with data:', batchData);

      const batch = await storage.createBatch(batchData);
      res.status(201).json(batch);
    } catch (error: any) {
      console.error("Batch creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Get batch detail route
  app.get("/api/organizations/:orgId/batches/:batchId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view batches in your own organization" });
      }

      // Get batch details
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Get trainee count
      const trainees = await storage.getBatchTrainees(batchId);
      const traineeCount = trainees.length;

      // Get related data
      const [process, location, lineOfBusiness, trainer] = await Promise.all([
        storage.getProcess(batch.processId),
        storage.getLocation(batch.locationId),
        storage.getLineOfBusiness(batch.lineOfBusinessId),
        storage.getUser(batch.trainerId)
      ]);

      // Combine all data
      const batchDetails = {
        ...batch,
        traineeCount,
        process,
        location,
        lineOfBusiness,
        trainer
      };

      console.log('Sending batch details:', batchDetails);
      res.json(batchDetails);
    } catch (error: any) {
      console.error("Error fetching batch details:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/organizations/:id/batches/:batchId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const batchId = parseInt(req.params.batchId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only update batches in your own organization" });
      }

      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if batch belongs to the organization
      if (batch.organizationId !== orgId) {
        return res.status(403).json({ message: "Batch not found in your organization" });
      }

      console.log('Updating batch:', batchId, 'with data:', req.body);
      const updatedBatch = await storage.updateBatch(batchId, req.body);

      res.json(updatedBatch);
    } catch (error: any) {
      console.error("Batch update error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Delete batch route
  app.delete("/api/organizations/:id/batches/:batchId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const batchId = parseInt(req.params.batchId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only delete batches in your own organization" });
      }

      // Get batch details
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if batch is in planned status
      if (batch.status !== 'planned') {
        return res.status(400).json({ 
          message: "Only batches in 'planned' status can be deleted",
          code: "INVALID_BATCH_STATUS"
        });
      }

      // Check for existing trainees
      const trainees = await storage.getBatchTrainees(batchId);
      if (trainees.length > 0) {
        return res.status(400).json({ 
          success: false,
          message: "Cannot delete batch with existing trainees. Please transfer or remove all trainees first.",
          traineesCount: trainees.length,
          code: "TRAINEES_EXIST"
        });
      }

      console.log('Deleting batch:', batchId);
      await storage.deleteBatch(batchId);

      console.log('Batch deleted successfully');
      return res.json({ 
        success: true,
        message: "Batch deleted successfully",
        code: "SUCCESS"
      });
    } catch (error: any) {
      console.error("Batch deletion error:", error);
      return res.status(500).json({ 
        success: false,
        message: error.message || "Failed to delete batch",
        code: "INTERNAL_ERROR"
      });
    }
  });

  // Add these batch template routes after existing routes
  // Get batch templates
  app.get("/api/organizations/:id/batch-templates", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view templates in your own organization" });
      }

      console.log(`Fetching batch templates for organization ${orgId}`);
      const templates = await storage.listBatchTemplates(orgId);
      console.log(`Found ${templates.length} templates`);
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create batch template
  app.post("/api/organizations/:id/batch-templates", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only create templates in your own organization" });
      }

      const templateData = {
        ...req.body,
        organizationId: orgId,
      };

      console.log('Creating template with data:', templateData);

      const validatedData = insertBatchTemplateSchema.parse(templateData);
      const template = await storage.createBatchTemplate(validatedData);

      console.log('Template created successfully:', template);
      res.status(201).json(template);
    } catch (error: any) {
      console.error("Template creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Get single template
  app.get("/api/organizations/:id/batch-templates/:templateId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const templateId = parseInt(req.params.templateId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view templates in your own organization" });
      }

      const template = await storage.getBatchTemplate(templateId);
      if (!template || template.organizationId !== orgId) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json(template);
    } catch (error: any) {
      console.error("Error fetching template:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete template
  app.delete("/api/organizations/:id/batch-templates/:templateId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.id);
      const templateId = parseInt(req.params.templateId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only delete templates in your own organization" });
      }

      // Check if template exists and belongs to organization
      const template = await storage.getBatchTemplate(templateId);
      if (!template || template.organizationId !== orgId) {
        return res.status(404).json({ message: "Template not found" });
      }

      await storage.deleteBatchTemplate(templateId);
      res.json({ message: "Template deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add new endpoint to get trainer's active batches
  app.get("/api/trainers/:id/active-batches", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const trainerId = parseInt(req.params.id);
      console.log(`Fetching batches for trainer ${trainerId}`);

      // Get all non-completed batches using the enum values directly
      const activeBatches = await storage.getBatchesByTrainer(
        trainerId,
        req.user.organizationId,
        batchStatusEnum.enumValues.filter(status => status !== 'completed')
      );

      console.log(`Found ${activeBatches.length} active batches for trainer ${trainerId}`);
      res.json(activeBatches);
    } catch (error: any) {
      console.error("Error fetching trainer batches:", error);
      res.status(500).json({ message: "Failed to fetch trainer batches" });
    }
  });

  // Update the trainee creation endpoint with capacity check
  app.post("/api/organizations/:orgId/batches/:batchId/trainees", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const organizationId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);

      // Get the batch details including capacity
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Get current trainee count
      const trainees = await storage.getBatchTrainees(batchId);
      if (trainees.length >= batch.capacityLimit) {
        return res.status(400).json({
          message: `Cannot add trainee. Batch capacity limit (${batch.capacityLimit}) has been reached.`
        });
      }

      // Rest of the existing code remains the same
      const { processId, lineOfBusinessId, locationId, ...userData } = req.body;

      // Create password hash
      const hashedPassword = await hashPassword(userData.password);

      // Create user with trainee role
      const userToCreate = {
        ...userData,
        password: hashedPassword,
        role: "trainee",
        category: "trainee",
        organizationId,
        locationId,
        active: true
      };

      console.log('Creating trainee with data:', {
        ...userToCreate,
        password: '[REDACTED]'
      });

      const user = await storage.createUser(userToCreate);
      console.log('Created user:', { id: user.id, username: user.username });

      // Create batch process assignment
      const batchAssignment = await storage.assignUserToBatch({
        userId: user.id,
        batchId,
        processId,
        status: 'active',
        joinedAt: new Date(),
      });
      console.log('Created batch assignment:', batchAssignment);

      // Create user process record
      const userProcess = await storage.createUserProcess({
        userId: user.id,
        processId,
        organizationId,
        lineOfBusinessId,
        locationId,
        status: 'active',
        assignedAt: new Date(),
      });
      console.log('Created user process assignment:', userProcess);

      res.status(201).json({
        user,
        batchAssignment,
        userProcess
      });
    } catch (error: any) {
      console.error("Error creating trainee:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Add after other user routes
  app.get("/api/organizations/:orgId/batches/:batchId/trainees", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      const orgId = parseInt(req.params.orgId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view trainees in your own organization" });
      }

      // Get batch details to verify it exists and belongs to the organization
      const batch = await storage.getBatch(batchId);
      if (!batch || batch.organizationId !== orgId) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Get all trainees for this batch
      const trainees = await storage.getBatchTrainees(batchId);
      console.log(`Found ${trainees.length} trainees for batch ${batchId}`);

      // Get detailed user information for each trainee
      const traineeDetails = await Promise.all(
        trainees.map(async (trainee) => {
          const user = await storage.getUser(trainee.userId);
          return {
            ...trainee,
            user: user ? {
              username: user.username,
              fullName: user.fullName,
              email: user.email,
              employeeId: user.employeeId,
              phoneNumber: user.phoneNumber,
            } : null
          };
        })
      );

      res.json(traineeDetails);
    } catch (error: any) {
      console.error("Error fetching batch trainees:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add the trainee transfer endpoint
  app.post("/api/organizations/:orgId/batches/:batchId/trainees/:traineeId/transfer", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);
      const traineeId = parseInt(req.params.traineeId);
      const { newBatchId } = req.body;

      // Validate the new batch exists and belongs to the organization
      const newBatch = await storage.getBatch(newBatchId);
      if (!newBatch || newBatch.organizationId !== orgId) {
        return res.status(404).json({ message: "Target batch not found" });
      }

      // Check capacity in the new batch
      const currentTrainees = await storage.getBatchTrainees(newBatchId);
      if (currentTrainees.length >= newBatch.capacityLimit) {
        return res.status(400).json({
          message: `Cannot transfer trainee. Target batch has reached its capacity limit of ${newBatch.capacityLimit}`
        });
      }

      // Update the trainee's batch assignment
      await storage.updateUserBatchProcess(traineeId, batchId, newBatchId);

      res.json({ message: "Trainee transferred successfully" });
    } catch (error: any) {
      console.error("Error transferring trainee:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add trainee delete endpoint
  app.delete("/api/organizations/:orgId/batches/:batchId/trainees/:traineeId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);
      const traineeId = parseInt(req.params.traineeId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only manage trainees in your own organization" });
      }

      console.log('Removing trainee:', traineeId, 'from batch:', batchId);

      // Simply remove trainee from batch without modifying user status
      await storage.removeTraineeFromBatch(traineeId, batchId);

      console.log('Successfully removed trainee from batch');
      res.json({ message: "Trainee removed from batch successfully" });
    } catch (error: any) {
      console.error("Error removing trainee:", error);
      res.status(400).json({ message: error.message || "Failed to remove trainee" });
    }
  });

  // Update the bulk upload route to handle role field
  app.post("/api/organizations/:orgId/batches/:batchId/trainees/bulk", upload.single('file'), async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "No file uploaded" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);

      // Read the uploaded file
      const workbook = XLSX.read(req.file.buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      let failureCount = 0;
      const errors = [];

      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Process each row
      for (const row of rows) {
        try {
          // Validate the role
          const role = row.role?.toLowerCase();
          const validRoles = ['manager', 'team_lead', 'quality_analyst', 'trainer', 'advisor'];
          if (!validRoles.includes(role)) {
            throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
          }

          const traineeData = {
            username: row.username,
            fullName: row.fullName,
            email: row.email,
            employeeId: row.employeeId,
            phoneNumber: row.phoneNumber,
            dateOfJoining: row.dateOfJoining,
            dateOfBirth: row.dateOfBirth,
            education: row.education,
            password: await hashPassword(row.password),
            role: role,
            category: "trainee", // Always set category as trainee
            processId: batch.processId,
            lineOfBusinessId: batch.lineOfBusinessId,
            locationId: batch.locationId,
            trainerId: batch.trainerId,
            organizationId: orgId,
            batchId: batchId
          };

          await storage.createUser(traineeData);
          successCount++;
        } catch (error) {
          failureCount++;
          errors.push(`Row ${rows.indexOf(row) + 2}: ${error.message}`);
        }
      }

      res.json({
        message: "Bulk upload completed",
        successCount,
        failureCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Bulk upload error:", error);
      res.status(500).json({
        message: "Failed to process bulk upload",
        error: error.message
      });
    }
  });

  // Add template download endpoint
  app.get("/api/templates/trainee-upload", (req, res) => {
    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Define headers
      const headers = [
        'username',
        'fullName',
        'email',
        'employeeId',
        'phoneNumber',
        'dateOfJoining',
        'dateOfBirth',
        'education',
        'password',
        'role' // Added 'role' column to the template
      ];

      // Create example data row
      const exampleData = [
        'john.doe',
        'John Doe',
        'john.doe@example.com',
        'EMP123',
        '+1234567890',
        '2025-03-06', // Format: YYYY-MM-DD
        '1990-01-01', // Format: YYYY-MM-DD
        'Bachelor\'s Degree',
        'Password123!', // Will be hashed on upload
        'advisor' // Example role showing advisor instead of trainee
      ];

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet([headers, exampleData]);

      // Add column widths
      ws['!cols'] = headers.map(() => ({ wch: 15 }));

      // Add styling to headers
      for (let i = 0; i < headers.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: headers[i] };
        ws[cellRef].s = { font: { bold: true } };
      }

      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Trainees');

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=trainee-upload-template.xlsx');

      // Write to response
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.send(buffer);

    } catch (error: any) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  // Add the onboarding completion endpoint
  app.post("/api/users/:id/complete-onboarding", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const userId = parseInt(req.params.id);

      // Users can only complete their own onboarding
      if (req.user.id !== userId) {
        return res.status(403).json({ message: "You can only complete your own onboarding" });
      }

      console.log(`Completing onboarding for user ${userId}`);
      const updatedUser = await storage.updateUser(userId, {
        onboardingCompleted: true
      });

      console.log('Onboarding completed successfully');
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: error.message || "Failed to complete onboarding" });
    }
  });

  // Update batch start endpoint
  app.post("/api/batches/:batchId/start", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      const batch = await storage.getBatch(batchId);

      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if user belongs to the organization
      if (req.user.organizationId !== batch.organizationId) {
        return res.status(403).json({
          message: "You can only manage batches in your own organization"
        });
      }

      // Update batch status to induction and set actual start date
      const currentDate = new Date();
      const updatedBatch = await storage.updateBatch(batchId, {
        status: 'induction',
        actualInductionStartDate: toUTCStorage(currentDate.toISOString())
      });

      console.log('Successfully started batch:', {
        ...updatedBatch,
        actualInductionStartDate: formatISTDateOnly(updatedBatch.actualInductionStartDate)
      });

      res.json(updatedBatch);

    } catch (error: any) {
      console.error("Error starting batch:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add new endpoint for ending a phase
  app.post("/api/batches/:batchId/phase/:phase/end", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      const phase = req.params.phase;
      const batch = await storage.getBatch(batchId);

      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if user belongs to the organization
      if (req.user.organizationId !== batch.organizationId) {
        return res.status(403).json({
          message: "You can only manage batches in your own organization"
        });
      }

      const currentDate = new Date();
      const updateData: any = {};

      // Set the end date for current phase and start date for next phase
      switch (phase) {
        case 'induction':
          updateData.actualInductionEndDate = toUTCStorage(currentDate.toISOString());
          updateData.actualTrainingStartDate = toUTCStorage(currentDate.toISOString());
          updateData.status = 'training';
          break;
        case 'training':
          updateData.actualTrainingEndDate= toUTCStorage(currentDate.toISOString());
          updateData.actualCertificationStartDate = toUTCStorage(currentDate.toISOString());
          updateData.status = 'certification';
          break;        case 'certification':
          updateData.actualCertificationEndDate = toUTCStorage(currentDate.toISOString());
          updateData.actualOjtStartDate = toUTCStorage(currentDate.toISOString());
          updateData.status = 'ojt';
          break;
        case 'ojt':
          updateData.actualOjtEndDate = toUTCStorage(currentDate.toISOString());
          updateData.actualOjtCertificationStartDate = toUTCStorage(currentDate.toISOString());
          updateData.status = 'ojt_certification';
          break;
        case 'ojt_certification':
          updateData.actualOjtCertificationEndDate = toUTCStorage(currentDate.toISOString());
          updateData.actualHandoverToOpsDate = toUTCStorage(currentDate.toISOString());
          updateData.status = 'completed';
          break;
        default:
          return res.status(400).json({ message: "Invalid phase" });
      }

      const updatedBatch = await storage.updateBatch(batchId, updateData);
      res.json(updatedBatch);

    } catch (error: any) {
      console.error("Error ending phase:", error);
      res.status(500).json({ message: error.message });
    }
  });

  return createServer(app);
}