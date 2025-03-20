import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { Router } from "express";
import { insertUserSchema, users, userBatchProcesses, organizationProcesses, userProcesses, quizzes, insertMockCallScenarioSchema, insertMockCallAttemptSchema, mockCallScenarios, mockCallAttempts, batches } from "@shared/schema";
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
import { eq, and, sql, inArray } from "drizzle-orm";
import { toIST, formatIST, toUTCStorage, formatISTDateOnly } from './utils/timezone';
import { attendance } from "@shared/schema";
import type { User } from "@shared/schema";

// Type definitions for user updates
type AllowedSelfUpdateFields = Pick<User, "fullName" | "email" | "phoneNumber" | "locationId" | "dateOfBirth" | "education">;
type AllowedUpdateFields = {
  fullName?: string;
  phoneNumber?: string;
  locationId?: number;
  dateOfBirth?: string;
  education?: string;
};

// Extend DatabaseStorage with required methods
declare module "./storage" {
  interface DatabaseStorage {
    getLocationByName(name: string): Promise<{id: number} | null>;
    getProcessByName(name: string): Promise<{id: number} | null>;
    assignProcessToUser(userId: number, processId: number): Promise<void>;
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

function excelSerialDateToJSDate(serial: number): string {
  // Excel's date system starts from December 30, 1899
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  
  const year = date_info.getFullYear();
  const month = String(date_info.getMonth() + 1).padStart(2, '0');
  const day = String(date_info.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
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
      // Pass null as first argument since the second argument false indicates reject
      cb(null, false);
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

      // Create user with the role from form
      const userToCreate = {
        ...userData,
        username,
        password: await hashPassword(password), 
        role: userData.role, // Use the role selected in the form
        category: "trainee", // Only set category as trainee
        organizationId: organization ? organization.id : undefined,
        active: true
      };

      if (!organization) {
        // If organization doesn't exist, create it first
        organization = await storage.createOrganization({
          name: organizationName
        });

        // Update the organizationId after creating organization
        userToCreate.organizationId = organization.id;
      }

      console.log('Creating user with data:', {
        ...userToCreate,
        password: '[REDACTED]'
      });

      // Create the user with the selected role
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

  // Add new endpoint for duplicating templates
  app.post("/api/evaluation-templates/:templateId/duplicate", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      const { name } = req.body;

      if (!templateId || !name) {
        return res.status(400).json({ message: "Template ID and new name are required" });
      }

      // Get the original template with all its details
      const originalTemplate = await storage.getEvaluationTemplateWithDetails(templateId);
      if (!originalTemplate) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Check if user has access to this template
      if (originalTemplate.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Create new template with the new name
      const newTemplate = await storage.createEvaluationTemplate({
        name,
        description: originalTemplate.description,
        processId: originalTemplate.processId,
        status: 'draft', // Always start as draft
        organizationId: req.user.organizationId,
        createdBy: req.user.id,
      });

      // Copy pillars and their parameters
      if (originalTemplate.pillars) {
        for (const pillar of originalTemplate.pillars) {
          // Create new pillar
          const newPillar = await storage.createEvaluationPillar({
            templateId: newTemplate.id,
            name: pillar.name,
            description: pillar.description,
            weightage: pillar.weightage,
            orderIndex: pillar.orderIndex,
          });

          // Copy parameters if they exist
          if (pillar.parameters) {
            for (const param of pillar.parameters) {
              await storage.createEvaluationParameter({
                pillarId: newPillar.id,
                name: param.name,
                description: param.description,
                guidelines: param.guidelines,
                ratingType: param.ratingType,
                weightage: param.weightage,
                isFatal: param.isFatal,
                requiresComment: param.requiresComment,
                noReasons: param.noReasons || [], // Ensure noReasons are copied
                orderIndex: param.orderIndex,
              });
            }
          }
        }
      }

      // Get the complete new template with all its details
      const completedTemplate = await storage.getEvaluationTemplateWithDetails(newTemplate.id);
      res.status(201).json(completedTemplate);

    } catch (error: any) {
      console.error("Error duplicating template:", error);
      res.status(500).json({ message: error.message || "Failed to duplicate template" });
    }
  });

  // Organization routes
  app.get("/api/organization", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.user.organizationId) return res.status(400).json({ message: "No organization ID found" });
    const organization = await storage.getOrganization(req.user.organizationId);
    res.json(organization);
  });

  // Add evaluation template routes
  app.post("/api/evaluation-templates", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateData = {
        ...req.body,
        organizationId: req.user.organizationId,
        createdBy: req.user.id,
      };

      // Validate required fields
      if (!templateData.name || !templateData.processId) {
        return res.status(400).json({
          message: "Name and process ID are required"
        });
      }

      console.log('Creating evaluation template:', templateData);
      const template = await storage.createEvaluationTemplate(templateData);
      
      res.status(201).json(template);
    } catch (error: any) {
      console.error("Error creating evaluation template:", error);
      res.status(400).json({ message: error.message || "Failed to create template" });
    }
  });

  app.get("/api/organizations/:organizationId/evaluation-templates", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const organizationId = parseInt(req.params.organizationId);
      if (organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const templates = await storage.listEvaluationTemplates(organizationId);
      res.json(templates);
    } catch (error: any) {
      console.error("Error listing evaluation templates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add new endpoint to get trainees for evaluation
  app.get("/api/trainees-for-evaluation", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      // Get trainees from the user's organization
      const trainees = await db.query.users.findMany({
        where: and(
          eq(users.organizationId, req.user.organizationId),
          eq(users.role, 'trainee'),
          eq(users.active, true)
        ),
        columns: {
          id: true,
          fullName: true,
          employeeId: true,
          email: true
        }
      });

      res.json(trainees);
    } catch (error: any) {
      console.error("Error fetching trainees:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get organization's batches
  app.get("/api/organizations/:organizationId/batches", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const organizationId = parseInt(req.params.organizationId);
      
      if (organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const batches = await storage.listBatches(organizationId);

      res.json(batches);
    } catch (error: any) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get trainees for a specific batch
  app.get("/api/organizations/:organizationId/batches/:batchId/trainees", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const organizationId = parseInt(req.params.organizationId);
      const batchId = parseInt(req.params.batchId);
      
      if (organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Get batch enrollments and join with users table to get trainee details
      const trainees = await db.query.userBatchProcesses.findMany({
        where: and(
          eq(userBatchProcesses.batchId, batchId),
          eq(userBatchProcesses.status, 'active')
        ),
        with: {
          user: {
            columns: {
              id: true,
              fullName: true,
              employeeId: true,
              email: true
            }
          }
        }
      });

      // Format the response to match the expected structure  
      const formattedTrainees = trainees.map(enrollment => ({
        id: enrollment.userId,
        fullName: enrollment.user.fullName,
        employeeId: enrollment.user.employeeId,
        email: enrollment.user.email
      }));

      res.json(formattedTrainees);
    } catch (error: any) {
      console.error("Error fetching batch trainees:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add finalize endpoint
  app.post("/api/evaluation-templates/:templateId/finalize", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      if (!templateId) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const template = await storage.getEvaluationTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Update template status to active
      const updatedTemplate = await storage.updateEvaluationTemplate(templateId, {
        status: 'active'
      });

      res.json(updatedTemplate);
    } catch (error: any) {
      console.error("Error finalizing template:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add update template endpoint
  app.patch("/api/evaluation-templates/:templateId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      if (!templateId) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const template = await storage.getEvaluationTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Only allow status changes
      const { status } = req.body;
      if (!status || !['draft', 'active', 'archived'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const updatedTemplate = await storage.updateEvaluationTemplate(templateId, { status });
      res.json(updatedTemplate);
    } catch (error: any) {
      console.error("Error updating evaluation template:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add evaluations endpoint
  app.post("/api/evaluations", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const evaluation = req.body;
      
      // Validate required fields
      if (!evaluation.templateId || !evaluation.traineeId || !evaluation.batchId || !evaluation.scores) {
        return res.status(400).json({
          message: "Missing required fields: templateId, traineeId, batchId, and scores are required"
        });
      }

      // Parse and validate the final score
      const finalScore = Number(parseFloat(evaluation.finalScore.toString()).toFixed(2));
      if (isNaN(finalScore) || finalScore < 0 || finalScore > 100) {
        return res.status(400).json({
          message: "Final score must be a number between 0 and 100"
        });
      }

      // Create evaluation record
      const result = await storage.createEvaluation({
        templateId: evaluation.templateId,
        traineeId: evaluation.traineeId,
        batchId: evaluation.batchId,
        evaluatorId: req.user.id,
        organizationId: req.user.organizationId,
        finalScore,
        status: 'completed',
        scores: evaluation.scores.map((score: any) => ({
          parameterId: score.parameterId,
          score: score.score,
          comment: score.comment,
          noReason: score.noReason
        }))
      });

      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error creating evaluation:", error);
      res.status(500).json({ 
        message: error.message || "Failed to create evaluation" 
      });
    }
  });

  // Add route to get template with all its components 
  app.get("/api/evaluation-templates/:templateId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      if (!templateId) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const template = await storage.getEvaluationTemplateWithDetails(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      res.json(template);
    } catch (error: any) {
      console.error("Error fetching evaluation template:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add delete template endpoint
  app.delete("/api/evaluation-templates/:templateId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      if (!templateId) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      const template = await storage.getEvaluationTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteEvaluationTemplate(templateId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting evaluation template:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add routes for pillars and parameters
  app.post("/api/evaluation-templates/:templateId/pillars", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.templateId);
      if (!templateId) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      // Get the template to verify ownership
      const template = await storage.getEvaluationTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const pillarData = {
        ...req.body,
        templateId,
      };

      console.log('Creating evaluation pillar:', pillarData);
      const pillar = await storage.createEvaluationPillar(pillarData);
      
      res.status(201).json(pillar);
    } catch (error: any) {
      console.error("Error creating evaluation pillar:", error);
      res.status(400).json({ message: error.message || "Failed to create pillar" });
    }
  });

  app.post("/api/evaluation-pillars/:pillarId/parameters", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const pillarId = parseInt(req.params.pillarId);
      if (!pillarId) {
        return res.status(400).json({ message: "Invalid pillar ID" });
      }

      // Get the pillar to verify ownership through template
      const pillar = await storage.getEvaluationPillar(pillarId);
      if (!pillar) {
        return res.status(404).json({ message: "Pillar not found" });
      }

      const template = await storage.getEvaluationTemplate(pillar.templateId);
      if (!template || template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const parameterData = {
        ...req.body,
        pillarId,
        // Ensure noReasons is properly passed as an array
        noReasons: Array.isArray(req.body.noReasons) ? req.body.noReasons : [],
      };

      console.log('Creating evaluation parameter:', parameterData);
      const parameter = await storage.createEvaluationParameter(parameterData);
      
      res.status(201).json(parameter);
    } catch (error: any) {
      console.error("Error creating evaluation parameter:", error);
      res.status(400).json({ message: error.message || "Failed to create parameter" });
    }
  });

  // Add edit pillar endpoint
  app.patch("/api/evaluation-pillars/:pillarId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const pillarId = parseInt(req.params.pillarId);
      if (!pillarId) {
        return res.status(400).json({ message: "Invalid pillar ID" });
      }

      // Get the pillar to verify ownership through template
      const pillar = await storage.getEvaluationPillar(pillarId);
      if (!pillar) {
        return res.status(404).json({ message: "Pillar not found" });
      }

      const template = await storage.getEvaluationTemplate(pillar.templateId);
      if (!template || template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updatedPillar = await storage.updateEvaluationPillar(pillarId, req.body);
      res.json(updatedPillar);
    } catch (error: any) {
      console.error("Error updating evaluation pillar:", error);
      res.status(400).json({ message: error.message || "Failed to update pillar" });
    }
  });

  // Add delete pillar endpoint
  app.delete("/api/evaluation-pillars/:pillarId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const pillarId = parseInt(req.params.pillarId);
      if (!pillarId) {
        return res.status(400).json({ message: "Invalid pillar ID" });
      }

      // Get the pillar to verify ownership through template
      const pillar = await storage.getEvaluationPillar(pillarId);
      if (!pillar) {
        return res.status(404).json({ message: "Pillar not found" });
      }

      const template = await storage.getEvaluationTemplate(pillar.templateId);
      if (!template || template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteEvaluationPillar(pillarId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting evaluation pillar:", error);
      res.status(400).json({ message: error.message || "Failed to delete pillar" });
    }
  });

  // Add edit parameter endpoint
  app.patch("/api/evaluation-parameters/:parameterId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const parameterId = parseInt(req.params.parameterId);
      if (!parameterId) {
        return res.status(400).json({ message: "Invalid parameter ID" });
      }

      // Get the parameter and verify ownership through pillar and template
      const parameter = await storage.getEvaluationParameter(parameterId);
      if (!parameter) {
        return res.status(404).json({ message: "Parameter not found" });
      }

      const pillar = await storage.getEvaluationPillar(parameter.pillarId);
      if (!pillar) {
        return res.status(404).json({ message: "Pillar not found" });
      }

      const template = await storage.getEvaluationTemplate(pillar.templateId);
      if (!template || template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Ensure noReasons is handled properly in updates
      const updateData = {
        ...req.body,
        noReasons: Array.isArray(req.body.noReasons) ? req.body.noReasons : parameter.noReasons || [],
      };

      console.log('Updating evaluation parameter:', updateData);
      const updatedParameter = await storage.updateEvaluationParameter(parameterId, updateData);
      res.json(updatedParameter);
    } catch (error: any) {
      console.error("Error updating evaluation parameter:", error);
      res.status(400).json({ message: error.message || "Failed to update parameter" });
    }
  });

  // Add delete parameter endpoint
  app.delete("/api/evaluation-parameters/:parameterId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const parameterId = parseInt(req.params.parameterId);
      if (!parameterId) {
        return res.status(400).json({ message: "Invalid parameter ID" });
      }

      // Get the parameter and verify ownership through pillar and template
      const parameter = await storage.getEvaluationParameter(parameterId);
      if (!parameter) {
        return res.status(404).json({ message: "Parameter not found" });
      }

      const pillar = await storage.getEvaluationPillar(parameter.pillarId);
      if (!pillar) {
        return res.status(404).json({ message: "Pillar not found" });
      }

      const template = await storage.getEvaluationTemplate(pillar.templateId);
      if (!template || template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteEvaluationParameter(parameterId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting evaluation parameter:", error);
      res.status(400).json({ message: error.message || "Failed to delete parameter" });
    }
  });

  // Add route to get organization processes 
  app.get("/api/processes", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const name = req.query.name as string | undefined;
      console.log(`Fetching processes for organization: ${req.user.organizationId}${name ? " with name filter: " + name : ""}`);
      
      const processes = await storage.listProcesses(req.user.organizationId, name);
      console.log(`Retrieved ${processes.length} processes`);
      res.json(processes);
    } catch (error: any) {
      console.error("Error fetching processes:", error);
      res.status(500).json({ message: error.message });
    }
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

  // Add GET endpoint for user processes
  app.get("/api/users/processes", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      // Get all user processes for the organization
      const processes = await db.query.userProcesses.findMany({
        where: sql`user_id IN (
          SELECT id FROM users 
          WHERE organization_id = ${req.user.organizationId}
        )`,
        with: {
          process: {
            columns: {
              name: true
            }
          }
        }
      });

      // Format the response to group processes by user ID
      const userProcessMap = processes.reduce((acc: Record<number, any[]>, curr) => {
        if (!acc[curr.userId]) {
          acc[curr.userId] = [];
        }
        acc[curr.userId].push({
          processId: curr.processId,
          processName: curr.process.name
        });
        return acc;
      }, {});

      res.json(userProcessMap);
    } catch (error: any) {
      console.error("Error fetching user processes:", error);
      res.status(500).json({ message: error.message });
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

  // Bulk user creation endpoint
  app.post("/api/users/bulk", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const users = req.body.users;
      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ message: "Invalid users data" });
      }

      // Start a transaction
      await db.transaction(async (tx) => {
        for (const userData of users) {
          // Validate required fields
          if (!userData.username || !userData.email || !userData.password) {
            throw new Error(`Missing required fields for user: ${userData.username || 'unknown'}`);
          }

          // Check if username or email already exists
          const existingUser = await storage.getUserByUsername(userData.username);
          if (existingUser) {
            throw new Error(`Username ${userData.username} already exists`);
          }

          const existingEmail = await storage.getUserByEmail(userData.email);
          if (existingEmail) {
            throw new Error(`Email ${userData.email} already exists`);
          }

          // Find reporting manager by username if provided
          let managerId = null;
          if (userData.reportingManager) {
            const manager = await storage.getUserByUsername(userData.reportingManager);
            if (!manager) {
              throw new Error(`Reporting manager ${userData.reportingManager} not found`);
            }
            managerId = manager.id;
          }

          // Find location by name if provided
          let locationId = null;
          if (userData.location) {
            const location = await storage.getLocationByName(userData.location);
            if (!location) {
              throw new Error(`Location ${userData.location} not found`);
            }
            locationId = location.id;
          }

          // Hash the password
          const hashedPassword = await hashPassword(userData.password);

          // Create the user
          const newUser = await storage.createUser({
            username: userData.username,
            password: hashedPassword,
            fullName: userData.fullName,
            email: userData.email,
            role: userData.role,
            category: userData.role === "manager" ? "active" : "trainee",
            locationId,
            employeeId: userData.employeeId, 
            phoneNumber: userData.phoneNumber,
            dateOfJoining: userData.dateOfJoining ? new Date(userData.dateOfJoining) : null,
            dateOfBirth: userData.dateOfBirth ? new Date(userData.dateOfBirth) : null,
            education: userData.education,
            organizationId: req.user.organizationId!,
            managerId,
            active: true,
            certified: false,
            onboardingCompleted: true,
          });

          // Associate process if provided
          if (userData.process) {
            const process = await storage.getProcessByName(userData.process);
            if (!process) {
              throw new Error(`Process ${userData.process} not found`);
            }
            await storage.assignProcessToUser(newUser.id, process.id);
          }
        }
      });

      res.status(201).json({ message: "Users created successfully" });
    } catch (error: any) {
      console.error("Bulk user creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Bulk user creation endpoint
  app.post("/api/users/bulk", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const users = req.body.users;
      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ message: "Invalid users data" });
      }

      // Start a transaction
      await db.transaction(async (tx) => {
        for (const userData of users) {
          // Validate required fields
          if (!userData.username || !userData.email || !userData.password) {
            throw new Error(`Missing required fields for user: ${userData.username || 'unknown'}`);
          }

          // Check if username or email already exists
          const existingUser = await storage.getUserByUsername(userData.username);
          if (existingUser) {
            throw new Error(`Username ${userData.username} already exists`);
          }

          const existingEmail = await storage.getUserByEmail(userData.email);
          if (existingEmail) {
            throw new Error(`Email ${userData.email} already exists`);
          }

          // Find reporting manager by username if provided
          let managerId = null;
          if (userData.reportingManager) {
            const manager = await storage.getUserByUsername(userData.reportingManager);
            if (!manager) {
              throw new Error(`Reporting manager ${userData.reportingManager} not found`);
            }
            managerId = manager.id;
          }

          // Find location by name if provided
          let locationId = null;
          if (userData.location) {
            const location = await storage.getLocationByName(userData.location);
            if (!location) {
              throw new Error(`Location ${userData.location} not found`);
            }
            locationId = location.id;
          }

          // Hash the password
          const hashedPassword = await hashPassword(userData.password);

          // Create the user
          const newUser = await storage.createUser({
            username: userData.username,
            password: hashedPassword,
            fullName: userData.fullName,
            email: userData.email,
            role: userData.role,
            category: userData.role === "manager" ? "active" : "trainee",
            locationId,
            employeeId: userData.employeeId, 
            phoneNumber: userData.phoneNumber,
            dateOfJoining: userData.dateOfJoining ? new Date(userData.dateOfJoining) : null,
            dateOfBirth: userData.dateOfBirth ? new Date(userData.dateOfBirth) : null,
            education: userData.education,
            organizationId: req.user.organizationId,
            managerId,
            active: true,
            certified: false,
            onboardingCompleted: true,
          });

          // Associate process if provided
          if (userData.process) {
            const process = await storage.getProcessByName(userData.process);
            if (!process) {
              throw new Error(`Process ${userData.process} not found`);
            }
            await storage.assignProcessToUser(newUser.id, process.id);
          }
        }
      });

      res.status(201).json({ message: "Users created successfully" });
    } catch (error: any) {
      console.error("Bulk user creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Bulk user creation endpoint
  app.post("/api/users/bulk", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const users = req.body.users;
      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ message: "Invalid users data" });
      }

      // Start a transaction
      await db.transaction(async (tx) => {
        for (const userData of users) {
          // Validate required fields
          if (!userData.username || !userData.email || !userData.password) {
            throw new Error(`Missing required fields for user: ${userData.username || 'unknown'}`);
          }

          // Check if username or email already exists
          const existingUser = await storage.getUserByUsername(userData.username);
          if (existingUser) {
            throw new Error(`Username ${userData.username} already exists`);
          }

          const existingEmail = await storage.getUserByEmail(userData.email);
          if (existingEmail) {
            throw new Error(`Email ${userData.email} already exists`);
          }

          // Find reporting manager by username if provided
          let managerId = null;
          if (userData.reportingManager) {
            const manager = await storage.getUserByUsername(userData.reportingManager);
            if (!manager) {
              throw new Error(`Reporting manager ${userData.reportingManager} not found`);
            }
            managerId = manager.id;
          }

          // Find location by name if provided
          let locationId = null;
          if (userData.location) {
            const location = await storage.getLocationByName(userData.location);
            if (!location) {
              throw new Error(`Location ${userData.location} not found`);
            }
            locationId = location.id;
          }

          // Hash the password
          const hashedPassword = await hashPassword(userData.password);

          // Create the user
          const newUser = await storage.createUser({
            username: userData.username,
            password: hashedPassword,
            fullName: userData.fullName,
            email: userData.email,
            role: userData.role,
            category: userData.role === "manager" ? "active" : "trainee",
            locationId,
            employeeId: userData.employeeId, 
            phoneNumber: userData.phoneNumber,
            dateOfJoining: userData.dateOfJoining ? new Date(userData.dateOfJoining) : null,
            dateOfBirth: userData.dateOfBirth ? new Date(userData.dateOfBirth) : null,
            education: userData.education,
            organizationId: req.user.organizationId,
            managerId,
            active: true,
            certified: false,
            onboardingCompleted: true,
          });

          // Associate process if provided
          if (userData.process) {
            const process = await storage.getProcessByName(userData.process);
            if (!process) {
              throw new Error(`Process ${userData.process} not found`);
            }
            await storage.assignProcessToUser(newUser.id, process.id);
          }
        }
      });

      res.status(201).json({ message: "Users created successfully" });
    } catch (error: any) {
      console.error("Bulk user creation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Delete user endpoint  
  app.delete("/api/users/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid user ID" 
        });
      }

      console.log(`Delete user request received for userId: ${userId}`);
      const userToDelete = await storage.getUser(userId);

      if (!userToDelete) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }

      // Check if user belongs to the same organization
      if (userToDelete.organizationId !== req.user.organizationId) {
        return res.status(403).json({ 
          success: false, 
          message: "Cannot delete users from other organizations" 
        });
      }

      // Only owners and admins can delete users
      if (req.user.role !== 'owner' && req.user.role !== 'admin') {
        console.log(`Delete request rejected: Insufficient permissions for user ${req.user.id}`);
        return res.status(403).json({ 
          success: false, 
          message: "Insufficient permissions to delete users" 
        });
      }

      // Cannot delete owners
      if (userToDelete.role === 'owner') {
        return res.status(403).json({ 
          success: false, 
          message: "Cannot delete organization owner" 
        });
      }

      console.log(`Attempting to delete user ${userId} from storage`);
      await storage.deleteUser(userId);
      console.log(`Successfully deleted user ${userId}`);

      return res.status(200).json({ 
        success: true, 
        message: "User deleted successfully" 
      });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to delete user" 
      });
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
      res.status(400).json({ message: error.message || "Failed to create user" });
    }
  });

  // Delete user endpoint
  app.delete("/api/users/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid user ID" 
        });
      }

      console.log(`Delete user request received for userId: ${userId}`);
      const userToDelete = await storage.getUser(userId);

      if (!userToDelete) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }

      // Check if user belongs to the same organization
      if (userToDelete.organizationId !== req.user.organizationId) {
        return res.status(403).json({ 
          success: false, 
          message: "Cannot delete users from other organizations" 
        });
      }

      // Only owners and admins can delete users
      if (req.user.role !== 'owner' && req.user.role !== 'admin') {
        console.log(`Delete request rejected: Insufficient permissions for user ${req.user.id}`);
        return res.status(403).json({ 
          success: false, 
          message: "Insufficient permissions to delete users" 
        });
      }

      // Cannot delete owners
      if (userToDelete.role === 'owner') {
        return res.status(403).json({ 
          success: false, 
          message: "Cannot delete organization owner" 
        });
      }

      console.log(`Attempting to delete user ${userId} from storage`);
      await storage.deleteUser(userId);
      console.log(`Successfully deleted user ${userId}`);

      return res.status(200).json({ 
        success: true, 
        message: "User deleted successfully" 
      });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to delete user" 
      });
    }
  });

  // Delete user endpoint
  app.delete("/api/users/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid user ID" 
        });
      }

      console.log(`Delete user request received for userId: ${userId}`);
      const userToDelete = await storage.getUser(userId);

      if (!userToDelete) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }

      // Check if user belongs to the same organization
      if (userToDelete.organizationId !== req.user.organizationId) {
        return res.status(403).json({ 
          success: false, 
          message: "Cannot delete users from other organizations" 
        });
      }

      // Only owners and admins can delete users
      if (req.user.role !== 'owner' && req.user.role !== 'admin') {
        console.log(`Delete request rejected: Insufficient permissions for user ${req.user.id}`);
        return res.status(403).json({ 
          success: false, 
          message: "Insufficient permissions to delete users" 
        });
      }

      // Cannot delete owners
      if (userToDelete.role === 'owner') {
        return res.status(403).json({ 
          success: false, 
          message: "Cannot delete organization owner" 
        });
      }

      console.log(`Attempting to delete user ${userId} from storage`);
      await storage.deleteUser(userId);
      console.log(`Successfully deleted user ${userId}`);

      return res.status(200).json({ 
        success: true, 
        message: "User deleted successfully" 
      });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to delete user" 
      });
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
        .reduce<Partial<AllowedSelfUpdateFields>>((obj, key) => {
          obj[key as keyof AllowedSelfUpdateFields] = updateData[key];
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
      .reduce<Partial<AllowedUpdateFields>>((obj, key) => {
        obj[key as keyof AllowedUpdateFields] = updateData[key] as any;
        return obj;
      }, {});

    const updatedUser = await storage.updateUser(userId, filteredUpdateData);
    res.json(updatedUser);
  } catch (error: any) {
    console.error("User update error:", error);
    res.status(400).json({ message: error.message || "Failed to update user" });
  }
});



  // Add new route for starting a batch after existing batch routes
  app.post("/api/batches/:batchId/start", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      if (!batchId) {
        return res.status(400).json({ message: "Invalid batch ID" });
      }

      // Get the batch
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if batch can be started
      if (batch.status !== 'planned') {
        return res.status(400).json({ 
          message: "Only planned batches can be started" 
        });
      }

      // Get all users assigned to this batch and check their category
      const batchTrainees = await storage.getBatchTrainees(batchId);
      const traineeCount = batchTrainees.length;

      if (traineeCount === 0) {
        return res.status(400).json({
          message: "Cannot start batch without any trainees. Please add at least one trainee before starting the batch."
        });
      }

      // Store dates in UTC format while preserving IST midnight
      const currentDate = new Date();
      const updatedBatch = await storage.updateBatch(batchId, {
        status: 'induction',
        startDate: toUTCStorage(currentDate.toISOString())
      });

      console.log('Successfully started batch:', {
        ...updatedBatch,
        startDate: formatISTDateOnly(updatedBatch.startDate)
      });

      res.json(updatedBatch);

    } catch (error: any) {
      console.error("Error starting batch:", error);
      res.status(500).json({ message: error.message || "Failed to start batch" });
    }
  });

  // Create phase change request
  app.post("/api/batches/:batchId/phase-change-requests", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      const { requestedPhase, justification, managerId } = req.body;

      // Get the batch to verify current phase
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Create the phase change request
      const request = await storage.createPhaseChangeRequest({
        batchId,
        trainerId: req.user.id,
        managerId,
        currentPhase: batch.status,
        requestedPhase,
        justification,
        organizationId: req.user.organizationId,
      });

      res.status(201).json(request);
    } catch (error: any) {
      console.error("Error creating phase change request:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // List phase change requests for trainer
  app.get("/api/trainers/:trainerId/phase-change-requests", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const trainerId = parseInt(req.params.trainerId);
      
      // Check if the user is requesting their own requests
      if (req.user.id !== trainerId && req.user.role !== 'owner' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "You can only view your own requests" });
      }

      const requests = await storage.listTrainerPhaseChangeRequests(trainerId);
      res.json(requests);
    } catch (error: any) {
      console.error("Error listing trainer phase change requests:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // List phase change requests for manager
  app.get("/api/managers/:managerId/phase-change-requests", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const managerId = parseInt(req.params.managerId);
      
      // Check if the user is requesting their own managed requests
      if (req.user.id !== managerId && req.user.role !== 'owner' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "You can only view requests assigned to you" });
      }

      const requests = await storage.listManagerPhaseChangeRequests(managerId);
      res.json(requests);
    } catch (error: any) {
      console.error("Error listing manager phase change requests:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add question routes
  app.post("/api/questions", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      console.log('Received question data:', req.body);
      
      // Validate required fields
      const { 
        question: questionText, 
        type: questionType,
        options: questionOptions,
        correctAnswer,
        explanation,
        difficultyLevel,
        category,
        processId  // Add processId to destructuring
      } = req.body;
      
      if (!questionText || !questionType || !correctAnswer || !difficultyLevel || !category || !processId) {
        return res.status(400).json({ 
          message: "Missing required fields for question creation" 
        });
      }

      // Validate question type
      const validTypes = ["multiple_choice", "true_false", "short_answer"] as const;
      type QuestionType = typeof validTypes[number];
      
      if (!validTypes.includes(questionType as QuestionType)) {
        return res.status(400).json({
          message: `Invalid question type. Must be one of: ${validTypes.join(", ")}`
        });
      }

      // Convert processId to number and validate
      const processIdNum = Number(processId);
      if (isNaN(processIdNum)) {
        return res.status(400).json({
          message: "Invalid process ID format"
        });
      }

      // Verify the process exists and belongs to the organization
      const processes = await db
        .select()
        .from(organizationProcesses)
        .where(and(
          eq(organizationProcesses.id, processIdNum),
          eq(organizationProcesses.organizationId, req.user.organizationId)
        ))
        .limit(1);

      if (processes.length === 0) {
        return res.status(400).json({
          message: "Invalid process ID or process does not belong to your organization."
        });
      }

      // Create question data with proper type checking
      const questionData = {
        question: String(questionText),
        type: questionType as QuestionType,
        options: questionType === 'multiple_choice' ? 
          (Array.isArray(questionOptions) ? questionOptions.map(String) : []) : 
          [],
        correctAnswer: String(correctAnswer),
        explanation: explanation ? String(explanation) : undefined,
        difficultyLevel: Number(difficultyLevel),
        category: String(category),
        createdBy: req.user.id,
        organizationId: req.user.organizationId,
        processId: processIdNum
      };

      // Validate numeric fields
      if (isNaN(questionData.difficultyLevel)) {
        return res.status(400).json({
          message: "Difficulty level must be a number"
        });
      }

      // Validate options for multiple choice questions
      if (questionData.type === 'multiple_choice' && (!Array.isArray(questionData.options) || questionData.options.length < 2)) {
        return res.status(400).json({
          message: "Multiple choice questions must have at least two options"
        });
      }

      console.log('Processed question data:', questionData);
      
      // Create the question in the database
      const newQuestion = await storage.createQuestion(questionData);
      console.log('Successfully created question:', newQuestion);
      
      res.status(201).json(newQuestion);
    } catch (error: any) {
      console.error("Error creating question:", error);
      res.status(400).json({ 
        message: error.message || "Failed to create question",
        details: error.stack
      });
    }
  });

  app.get("/api/questions", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const processId = req.query.processId ? parseInt(req.query.processId as string) : null;
      console.log('Fetching questions with process filter:', processId);

      let questions;
      if (processId) {
        // If processId is provided, filter questions by process
        questions = await storage.listQuestionsByProcess(req.user.organizationId, processId);
      } else {
        // If no processId, get all questions for the organization
        questions = await storage.listQuestions(req.user.organizationId);
      }

      console.log(`Retrieved ${questions.length} questions for process ${processId || 'all'}`);
      res.json(questions);
    } catch (error: any) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add quiz routes with minimal validation
  app.get("/api/quizzes/:quizId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const quizId = parseInt(req.params.quizId);
      
      // Get quiz with questions using the correct function
      const quiz = await storage.getQuizWithQuestions(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      res.json(quiz);
    } catch (error: any) {
      console.error("Error fetching quiz details:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/quizzes/:quizId/submit", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const quizId = parseInt(req.params.quizId);
      const { answers } = req.body;

      // Get quiz with questions using the correct function
      const quiz = await storage.getQuizWithQuestions(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      // Calculate score
      let correctAnswers = 0;
      const scoredAnswers = quiz.questions.map(question => {
        const userAnswer = answers[question.id];
        const isCorrect = userAnswer === question.correctAnswer;
        if (isCorrect) correctAnswers++;
        
        return {
          questionId: question.id,
          userAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect
        };
      });

      const score = (correctAnswers / quiz.questions.length) * 100;

      // Create quiz attempt record
      const attempt = await storage.createQuizAttempt({
        quizId: quiz.id,
        userId: req.user.id,
        organizationId: req.user.organizationId,
        score,
        answers: scoredAnswers,
        completedAt: new Date()
      });

      res.json({
        id: attempt.id,
        score: attempt.score,
        completedAt: attempt.completedAt,
        answers: scoredAnswers
      });
    } catch (error: any) {
      console.error("Error submitting quiz:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add route for getting random questions
  app.get("/api/random-questions", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      console.log('Random questions request params:', req.query);
      
      // Validate count parameter
      const count = parseInt(req.query.count as string);
      if (isNaN(count) || count < 1) {
        return res.status(400).json({ 
          message: "Question count must be a positive number" 
        });
      }

      // Parse optional parameters
      const options: {
        count: number;
        categoryDistribution?: Record<string, number>;
        difficultyDistribution?: Record<string, number>;
        processId?: number;
      } = { count };

      // Parse category distribution if provided
      if (req.query.categoryDistribution) {
        try {
          options.categoryDistribution = JSON.parse(req.query.categoryDistribution as string);
          if (typeof options.categoryDistribution !== 'object') {
            throw new Error('Invalid category distribution format');
          }
        } catch (error) {
          return res.status(400).json({
            message: "Invalid category distribution format. Expected JSON object with category names and counts."
          });
        }
      }

      // Parse difficulty distribution if provided
      if (req.query.difficultyDistribution) {
        try {
          options.difficultyDistribution = JSON.parse(req.query.difficultyDistribution as string);
          if (typeof options.difficultyDistribution !== 'object') {
            throw new Error('Invalid difficulty distribution format');
          }
        } catch (error) {
          return res.status(400).json({
            message: "Invalid difficulty distribution format. Expected JSON object with difficulty levels and counts."
          });
        }
      }

      // Parse processId if provided
      if (req.query.processId) {
        const processId = parseInt(req.query.processId as string);
        if (!isNaN(processId) && processId > 0) {
          options.processId = processId;
        }
      }

      console.log('Getting random questions with options:', options);
      
      // Get random questions using the storage method
      const randomQuestions = await storage.getRandomQuestions(
        req.user.organizationId,
        options
      );

      console.log(`Retrieved ${randomQuestions.length} random questions`);
      res.json(randomQuestions);
    } catch (error: any) {
      console.error("Error getting random questions:", error);
      res.status(500).json({ 
        message: error.message || "Failed to get random questions" 
      });
    }
  });

  // Get quizzes assigned to trainee through their processes
  app.get("/api/trainee/quizzes", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Verify if user has trainee category
    if (req.user.category !== 'trainee') {
      return res.status(403).json({ 
        message: "Only users with trainee category can access this endpoint" 
      });
    }

    try {
      console.log("Fetching quizzes for user:", {
        userId: req.user.id,
        username: req.user.username,
        organizationId: req.user.organizationId
      });

      // Get user's assigned processes first
      const userProcessesResult = await db
        .select({
          processId: userProcesses.processId
        })
        .from(userProcesses)
        .where(eq(userProcesses.userId, req.user.id));

      const assignedProcessIds = userProcessesResult.map(p => p.processId);
      
      if (assignedProcessIds.length === 0) {
        console.log('User has no assigned processes');
        return res.json([]);
      }

      // Get quizzes for assigned processes
      const result = await db
        .select({
          quiz_id: quizzes.id,
          quiz_name: quizzes.name,
          timeLimit: quizzes.timeLimit,
          passingScore: quizzes.passingScore,
          processId: quizzes.processId,
          processName: organizationProcesses.name
        })
        .from(quizzes)
        .innerJoin(
          organizationProcesses, 
          eq(quizzes.processId, organizationProcesses.id)
        )
        .where(
          and(
            eq(organizationProcesses.organizationId, req.user.organizationId),
            eq(quizzes.status, 'active'),
            inArray(quizzes.processId, assignedProcessIds)
          )
        );

      console.log('Found quizzes:', result);
      res.json(result);

    } catch (error: any) {
      console.error("Error fetching trainee quizzes:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fetch trainee quizzes" 
      });
    }
  });


  // Delete quiz endpoint
  app.delete("/api/quizzes/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const quizId = parseInt(req.params.id);
      if (!quizId) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }

      // Get the quiz to verify ownership
      const quiz = await storage.getQuiz(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      // Verify organization ownership
      if (quiz.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "You can only delete quizzes from your organization" });
      }

      // Delete the quiz and related records
      await storage.deleteQuiz(quizId);

      res.json({ message: "Quiz deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting quiz:", error);
      res.status(500).json({ 
        message: error.message || "Failed to delete quiz" 
      });
    }
  });

  // Update question endpoint
  app.put("/api/questions/:id", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return res.status(400).json({ message: "Invalid question ID" });
      }

      // Get the existing question to verify ownership
      const existingQuestion = await storage.getQuestionById(questionId);
      if (!existingQuestion) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Verify organization ownership
      if (existingQuestion.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Update the question
      const updatedQuestion = await storage.updateQuestion(questionId, {
        ...req.body,
        organizationId: req.user.organizationId // Ensure organization ID cannot be changed
      });

      res.json(updatedQuestion);
    } catch (error: any) {
      console.error("Error updating question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete question endpoint
  app.delete("/api/questions/:id", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return res.status(400).json({ message: "Invalid question ID" });
      }

      // Get the existing question to verify ownership
      const existingQuestion = await storage.getQuestionById(questionId);
      if (!existingQuestion) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Verify organization ownership
      if (existingQuestion.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Delete the question
      await storage.deleteQuestion(questionId);
      res.json({ message: "Question deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add quiz template routes
  app.post("/api/quiz-templates", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      console.log('Creating quiz template with data:', req.body);

      const templateData = {
        ...req.body,
        organizationId: req.user.organizationId,
        createdBy: req.user.id
      };

      // Create the template
      const newTemplate = await storage.createQuizTemplate(templateData);
      console.log('Successfully created quiz template:', newTemplate);

      res.status(201).json(newTemplate);
    } catch (error: any) {
      console.error("Error creating quiz template:", error);
      res.status(400).json({ 
        message: error.message || "Failed to create quiz template",
        details: error.stack
      });
    }
  });

  app.get("/api/quiz-templates", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      console.log('Fetching quiz templates');
      const processId = req.query.processId ? parseInt(req.query.processId as string) : undefined;
      console.log('Process ID filter:', processId);
      
      const templates = await storage.listQuizTemplates(req.user.organizationId, processId);
      console.log(`Retrieved ${templates.length} quiz templates`);
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching quiz templates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add update endpoint for quiz templates
  // Add the new quiz attempt route handler
  app.get("/api/quiz-attempts/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const attemptId = parseInt(req.params.id);
      console.log("Fetching quiz attempt:", attemptId);

      if (isNaN(attemptId)) {
        return res.status(400).json({ message: "Invalid attempt ID" });
      }

      const attempt = await storage.getQuizAttempt(attemptId);
      console.log("Retrieved attempt:", attempt);

      if (!attempt) {
        return res.status(404).json({ message: "Quiz attempt not found" });
      }

      res.json(attempt);
    } catch (error) {
      console.error("Error fetching quiz attempt:", error);
      res.status(500).json({ message: "Failed to fetch quiz attempt" });
    }
  });

  app.put("/api/quiz-templates/:id", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      // Get the template to verify ownership
      const template = await storage.getQuizTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Quiz template not found" });
      }

      // Verify organization ownership
      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Update the template
      const updatedTemplate = await storage.updateQuizTemplate(templateId, {
        ...req.body,
        organizationId: req.user.organizationId // Ensure organization ID cannot be changed
      });

      res.json(updatedTemplate);
    } catch (error: any) {
      console.error("Error updating quiz template:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Generate quiz from template
  app.post("/api/quiz-templates/:id/generate", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.id);
      if (isNaN(templateId)) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      // Get the template
      const template = await storage.getQuizTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Verify organization access
      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get random questions based on template configuration
      const questions = await storage.getRandomQuestions(
        req.user.organizationId,
        {
          count: template.questionCount,
          categoryDistribution: template.categoryDistribution,
          difficultyDistribution: template.difficultyDistribution,
          processId: template.processId
        }
      );

      if (questions.length < template.questionCount) {
        const errorDetails = [];
        if (template.categoryDistribution) {
          errorDetails.push(`category distribution (${Object.entries(template.categoryDistribution).map(([cat, count]) => `${count} from ${cat}`).join(', ')})`);
        }
        if (template.difficultyDistribution) {
          errorDetails.push(`difficulty distribution (${Object.entries(template.difficultyDistribution).map(([diff, count]) => `${count} with difficulty ${diff}`).join(', ')})`);
        }
        
        return res.status(400).json({ 
          message: "Not enough questions available to generate quiz",
          details: `Need ${template.questionCount} questions matching: ${errorDetails.join(' and ')}`
        });
      }

      // Create a new quiz instance
      const quiz = await storage.createQuiz({
        name: template.name,
        description: template.description,
        timeLimit: template.timeLimit,
        passingScore: template.passingScore,
        questions: questions.map(q => q.id),
        templateId: template.id,
        organizationId: req.user.organizationId,
        createdBy: req.user.id,
        processId: template.processId,
        status: 'active',
        startTime: new Date(),
        endTime: new Date(Date.now() + template.timeLimit * 60 * 1000)
      });

      res.status(201).json(quiz);
    } catch (error: any) {
      console.error("Error generating quiz:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete quiz template endpoint - update to handle cascade deletion
  app.delete("/api/quiz-templates/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const templateId = parseInt(req.params.id);
      if (!templateId) {
        return res.status(400).json({ message: "Invalid template ID" });
      }

      // Get the template to verify ownership
      const template = await storage.getQuizTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Verify organization ownership
      if (template.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "You can only delete templates from your organization" });
      }

      // First delete all quizzes associated with this template
      await storage.deleteQuizzesByTemplateId(templateId);

      // Then delete the template
      await storage.deleteQuizTemplate(templateId);

      res.json({ message: "Quiz template and associated quizzes deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting quiz template:", error);
      res.status(500).json({ message: error.message || "Failed to delete quiz template" });
    }
  });

  // Get quiz for taking
  app.get("/api/quizzes/:id", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const quizId = parseInt(req.params.id);
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }

      // Get quiz details with questions
      const quiz = await storage.getQuizWithQuestions(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      // Verify organization access
      if (quiz.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Remove correct answers from questions before sending to client
      const sanitizedQuestions = quiz.questions.map(question => ({
        ...question,
        correctAnswer: undefined
      }));

      res.json({
        ...quiz,
        questions: sanitizedQuestions
      });
    } catch (error: any) {
      console.error("Error fetching quiz:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Submit quiz answers
  app.post("/api/quizzes/:id/submit", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const quizId = parseInt(req.params.id);
      if (isNaN(quizId)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }

      const { answers } = req.body;
      if (!answers || typeof answers !== 'object') {
        return res.status(400).json({ message: "Invalid answers format" });
      }

      // Get quiz with correct answers
      const quiz = await storage.getQuizWithQuestions(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      // Calculate score
      let correctAnswers = 0;
      const results = quiz.questions.map(question => {
        const userAnswer = answers[question.id];
        const isCorrect = userAnswer === question.correctAnswer;
        if (isCorrect) correctAnswers++;
        
        return {
          questionId: question.id,
          userAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect
        };
      });

      const score = (correctAnswers / quiz.questions.length) * 100;

      // Save quiz attempt
      const attempt = await storage.createQuizAttempt({
        quizId,
        userId: req.user.id,
        organizationId: req.user.organizationId,
        score,
        answers: results,
        completedAt: new Date()
      });

      res.json(attempt);
    } catch (error: any) {
      console.error("Error submitting quiz:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update phase change request status
  app.patch("/api/phase-change-requests/:requestId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const requestId = parseInt(req.params.requestId);
      const { status, managerComments } = req.body;

      // Get the request to verify the manager
      const request = await storage.getPhaseChangeRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      // Check if the user is the assigned manager
      if (request.managerId !== req.user.id && req.user.role !== 'owner' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only the assigned manager can update this request" });
      }

      // Update the request
      const updatedRequest = await storage.updatePhaseChangeRequest(requestId, {
        status,
        managerComments,
      });

      // If approved, update the batch phase
      if (status === 'approved') {
        await storage.updateBatch(request.batchId, {
          status: request.requestedPhase,
        });
      }

      res.json(updatedRequest);
    } catch (error: any) {
      console.error("Error updating phase change request:", error);
      res.status(500).json({ message: error.message });
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

  // Add batch details endpoint with comprehensive error handling and logging
  app.get("/api/organizations/:orgId/batches/:batchId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);

      console.log('Fetching batch details:', {
        orgId,
        batchId,
        userId: req.user.id,
        userRole: req.user.role
      });

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        console.log('User organization mismatch:', {
          userOrgId: req.user.organizationId,
          requestedOrgId: orgId
        });
        return res.status(403).json({ message: "You can only view batches in your own organization" });
      }

      // Get the batch with location and process details 
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        console.log('Batch not found:', { batchId });
        return res.status(404).json({ message: "Batch not found" });
      }

      // Role-based access control
      switch (req.user.role) {
        case 'trainer':
          // Trainers can only see batches assigned to them
          if (batch.trainerId !== req.user.id) {
            console.log('Trainer not assigned to batch:', {
              trainerId: req.user.id,
              batchTrainerId: batch.trainerId
            });
            return res.status(403).json({ message: "You can only view batches assigned to you" });
          }
          break;

        case 'manager':
          // Managers can see batches of trainers reporting to them
          const reportingTrainers = await storage.getReportingTrainers(req.user.id);
          const trainerIds = reportingTrainers.map(trainer => trainer.id);
          if (!trainerIds.includes(batch.trainerId)) {
            console.log('Manager not authorized for batch:', {
              managerId: req.user.id,
              batchTrainerId: batch.trainerId
            });
            return res.status(403).json({ message: "You can only view batches of trainers reporting to you" });
          }
          break;

        case 'admin':
        case 'owner':
          // Admins and owners can see all batches in their organization
          break;

        default:
          return res.status(403).json({ message: "Insufficient permissions to view batch details" });
      }

      // Get additional batch details
      const [location, process] = await Promise.all([
        storage.getLocation(batch.locationId),
        storage.getProcess(batch.processId)
      ]);

      const batchWithDetails = {
        ...batch,
        location,
        process
      };

      console.log('Successfully fetched batch details:', { 
        batchId,
        status: batch.status,
        location: location?.name,
        process: process?.name
      });

      res.json(batchWithDetails);
    } catch (error: any) {
      console.error('Error fetching batch details:', error);
      res.status(500).json({ 
        message: "Failed to fetch batch details",
        error: error.message 
      });
    }
  });

  // Add batch history endpoint
  app.get("/api/organizations/:orgId/batches/:batchId/history", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        console.log('User organization mismatch:', {
          userOrgId: req.user.organizationId,
          requestedOrgId: orgId
        });
        return res.status(403).json({ message: "You can only view batches in your own organization" });
      }

      // Get the batch to verify access
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        console.log('Batch not found:', { batchId });
        return res.status(404).json({ message: "Batch not found" });
      }

      // Role-based access control
      switch (req.user.role) {
        case 'trainer':
          if (batch.trainerId !== req.user.id) {
            console.log('Trainer not assigned to batch:', {
              trainerId: req.user.id,
              batchTrainerId: batch.trainerId
            });
            return res.status(403).json({ message: "You can only view batches assigned to you" });
          }
          break;

        case 'manager':
          const reportingTrainers = await storage.getReportingTrainers(req.user.id);
          const trainerIds = reportingTrainers.map(trainer => trainer.id);
          if (!trainerIds.includes(batch.trainerId)) {
            console.log('Manager not authorized for batch:', {
              managerId: req.user.id,
              batchTrainerId: batch.trainerId
            });
            return res.status(403).json({ message: "You can only view batches of trainers reporting to you" });
          }
          break;

        case 'admin':
        case 'owner':
          // Admins and owners can see all batches in their organization
          break;

        default:
          return res.status(403).json({ message: "Insufficient permissions to view batch details" });
      }

      // Fetch batch history
      const history = await storage.listBatchHistory(batchId);
      
      console.log('Successfully fetched batch history:', { 
        batchId,
        eventCount: history.length
      });

      res.json(history);
    } catch (error: any) {
      console.error('Error fetching batch history:', error);
      res.status(500).json({ 
        message: "Failed to fetch batch history",
        error: error.message 
      });
    }
  });

  // Add question routes after batch routes
  app.post("/api/questions", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      console.log('Received question data:', req.body);
      
      // Validate required fields
      const { 
        question: questionText, 
        type: questionType,
        options: questionOptions,
        correctAnswer,
        explanation,
        difficultyLevel,
        category 
      } = req.body;
      
      if (!questionText || !questionType || !correctAnswer || !difficultyLevel || !category) {
        return res.status(400).json({ 
          message: "Missing required fields for question creation" 
        });
      }

      // Validate question type
      const validTypes = ["multiple_choice", "true_false", "short_answer"] as const;
      if (!validTypes.includes(questionType)) {
        return res.status(400).json({
          message: `Invalid question type. Must be one of: ${validTypes.join(", ")}`
        });
      }

      // Create question data with proper type checking
      const questionData = {
        question: String(questionText),
        type: questionType,
        options: questionType === 'multiple_choice' ? (Array.isArray(questionOptions) ? questionOptions.map(String) : []) : [],
        correctAnswer: String(correctAnswer),
        explanation: explanation ? String(explanation) : undefined,
        difficultyLevel: Number(difficultyLevel),
        category: String(category),
        createdBy: req.user.id,
        organizationId: req.user.organizationId,
        processId: 1 // Default to first process
      };

      // Validate numeric fields
      if (isNaN(questionData.difficultyLevel)) {
        return res.status(400).json({
          message: "Difficulty level must be a number"
        });
      }

      // Validate options for multiple choice questions
      if (questionData.type === 'multiple_choice' && questionData.options.length === 0) {
        return res.status(400).json({
          message: "Multiple choice questions must have options"
        });
      }

      console.log('Saving question with data:', questionData);
      
      // Create the question in the database
      const createdQuestion = await storage.createQuestion(questionData);
      console.log('Successfully created question:', createdQuestion);
      
      res.status(201).json(createdQuestion);
    } catch (error: any) {
      console.error("Error creating question:", error);
      res.status(400).json({ message: error.message || "Failed to create question" });
    }
  });

  app.get("/api/questions", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      console.log('Fetching questions for organization:', req.user.organizationId);
      // Get questions for the user's organization  
      const questions = await storage.listQuestions(req.user.organizationId);
      console.log('Retrieved questions:', questions);
      res.json(questions);
    } catch (error: any) {
      console.error("Error fetching questions:", error);
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

  // Helper function to get enrolled count for a batch
  const getEnrolledCount = async (batchId: number) => {
    // Get all users assigned to this batch with category 'trainee'
    const batchTrainees = await db
      .select({
        userId: userBatchProcesses.userId,
        category: users.category,
        status: userBatchProcesses.status
      })
      .from(userBatchProcesses)
      .innerJoin(users, eq(users.id, userBatchProcesses.userId))
      .where(
        and(
          eq(userBatchProcesses.batchId, batchId),
          eq(users.category, 'trainee'),
          eq(userBatchProcesses.status, 'active')  // Only count active trainees
        )
      );

    // Return the count of enrolled trainees
    return batchTrainees.length;
  };

  // Batch listing route with enrolled count
  app.get("/api/organizations/:orgId/batches", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const status = req.query.status as string;

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view batches in your own organization" });
      }

      // Role-based filtering
      let batches;
      switch (req.user.role) {
        case 'trainer':
          console.log('Fetching batches for trainer:', req.user.id);
          // Trainers can only see batches assigned to them
          batches = await storage.listBatchesForTrainer(req.user.id);
          break;

        case 'manager':
          console.log('Fetching batches for manager:', req.user.id);
          // Get all trainers reporting to this manager
          const reportingTrainers = await storage.getReportingTrainers(req.user.id);
          const trainerIds = reportingTrainers.map(trainer => trainer.id);
          // Get batches for all reporting trainers
          batches = await storage.listBatchesForTrainers(trainerIds);
          break;

        case 'admin':
        case 'owner':
          console.log('Fetching all batches for admin/owner');
          // Admins and owners can see all batches
          batches = await storage.listBatches(orgId);
          break;

        default:
          return res.status(403).json({ message: "Insufficient permissions to view batches" });
      }

      // Filter by status if specified  
      if (status) {
        batches = batches.filter(batch => batch.status === status);
      }

      // For each batch, enrich with location, process, line of business details, and enrolled count
      const enrichedBatches = await Promise.all(batches.map(async (batch) => {
        const [location, process, line_of_business, enrolledCount] = await Promise.all([
          storage.getLocation(batch.locationId),
          storage.getProcess(batch.processId),
          storage.getLineOfBusiness(batch.lineOfBusinessId),
          getEnrolledCount(batch.id)
        ]);

        return {
          ...batch,
          location,
          process,
          line_of_business,
          enrolledCount,
          capacityRemaining: batch.capacityLimit - enrolledCount
        };
      }));

      console.log(`Found ${enrichedBatches.length} batches with enrollment counts:`, 
        enrichedBatches.map(b => ({ 
          id: b.id, 
          name: b.name, 
          enrolledCount: b.enrolledCount,
          capacityLimit: b.capacityLimit 
        }))
      );

      res.json(enrichedBatches);
    } catch (error: any) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get batch trainees with details
  app.get("/api/organizations/:orgId/batches/:batchId/trainees", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      const orgId = parseInt(req.params.orgId);
      const today = new Date().toISOString().split('T')[0];

      console.log('Fetching trainees for batch', batchId);

      // Get all trainees assigned to this batch and their attendance for today
      const batchTrainees = await db
        .select({
          userId: userBatchProcesses.userId,
          status: userBatchProcesses.status,
          user: {
            id: users.id,
            fullName: users.fullName,
            employeeId: users.employeeId,
            email: users.email,
            role: users.role,
            category: users.category
          },
          attendance: {
            status: attendance.status,
            lastUpdated: attendance.updatedAt
          }
        })
        .from(userBatchProcesses)
        .innerJoin(users, eq(users.id, userBatchProcesses.userId))
        .leftJoin(
          attendance,
          and(
            eq(attendance.traineeId, userBatchProcesses.userId),
            eq(attendance.batchId, userBatchProcesses.batchId),
            eq(attendance.date, today)
          )
        )
        .where(
          and(
            eq(userBatchProcesses.batchId, batchId),
            eq(users.category, 'trainee'),  // Filter by category='trainee'
            eq(userBatchProcesses.status, 'active')  // Only get active trainees
          )
        );

      console.log('Found trainees:', batchTrainees);

      // Map to expected format
      const traineesWithDetails = batchTrainees.map((trainee) => ({
        id: trainee.userId,
        status: trainee.attendance?.status || null,
        lastUpdated: trainee.attendance?.lastUpdated?.toISOString(),
        user: trainee.user
      }));

      console.log('Trainees with attendance details:', traineesWithDetails);
      res.json(traineesWithDetails);
    } catch (error: any) {
      console.error("Error fetching trainees:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add detailed logging to bulk upload route
  app.post("/api/organizations/:orgId/batches/:batchId/trainees/bulk", upload.single('file'), async (req, res) => {
    console.log('Starting bulk upload process');
    
    if (!req.user) {
      console.log('Unauthorized attempt to upload');
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (!req.file) {
      console.log('No file received in request');
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      console.log('File received:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);

      console.log('Processing upload for:', { orgId, batchId });

      // Get batch details first
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        console.log('Batch not found:', batchId);
        return res.status(404).json({ message: "Batch not found" });
      }

      console.log('Found batch:', batch);

      // Check remaining capacity 
      const currentTrainees = await storage.getBatchTrainees(batchId);
      const remainingCapacity = batch.capacityLimit - currentTrainees.length;
      
      console.log('Batch capacity check:', {
        total: batch.capacityLimit,
        current: currentTrainees.length,
        remaining: remainingCapacity
      });

      // Read the uploaded file
      console.log('Reading Excel file');
      const workbook = XLSX.read(req.file.buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

      console.log('Excel parsing complete. Row count:', rows.length);

      // Validate total rows against capacity
      if (rows.length > remainingCapacity) {
        console.log('Capacity exceeded:', {
          rowCount: rows.length,
          remainingCapacity
        });
        return res.status(400).json({
          message: `Cannot upload ${rows.length} trainees. Only ${remainingCapacity} slots remaining in batch.`
        });
      }

      let successCount = 0;
      let failureCount = 0;
      const errors = [];
      const requiredFields = ['username', 'fullName', 'email', 'employeeId', 'phoneNumber', 'dateOfJoining', 'dateOfBirth', 'education', 'password', 'role'];

      // Process each row
      for (const row of rows) {
        try {
          console.log('Processing row:', row);

          // Validate required fields
          const missingFields = requiredFields.filter(field => !row[field]);
          if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
          }

          // Validate email format
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
            throw new Error('Invalid email format');
          }

          // Validate role
          const role = String(row.role).toLowerCase();
          const validRoles = ['manager', 'team_lead', 'quality_analyst', 'trainer', 'advisor'];
          if (!validRoles.includes(role)) {
            throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
          }

          // Convert and validate dates
          let dateOfJoining: string;
          let dateOfBirth: string;

          try {
            // Check if the date is a number (Excel serial date) or string
            if (typeof row.dateOfJoining === 'number') {
              dateOfJoining = excelSerialDateToJSDate(row.dateOfJoining);
            } else {
              dateOfJoining = row.dateOfJoining;
            }

            if (typeof row.dateOfBirth === 'number') {
              dateOfBirth = excelSerialDateToJSDate(row.dateOfBirth);
            } else {
              dateOfBirth = row.dateOfBirth;
            }

            // Validate date format
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfJoining) || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
              throw new Error('Invalid date format');
            }
          } catch (error) {
            throw new Error('Invalid date format. Use YYYY-MM-DD format');
          }

          // Create trainee data object
          const traineeData = {
            username: String(row.username),
            fullName: String(row.fullName),
            email: String(row.email),
            employeeId: String(row.employeeId),
            phoneNumber: String(row.phoneNumber),
            dateOfJoining: dateOfJoining,
            dateOfBirth: dateOfBirth,
            education: String(row.education),
            password: await hashPassword(String(row.password)),
            role: role,
            category: "trainee", // This is correct - category should be trainee
            processId: batch.processId,
            lineOfBusinessId: batch.lineOfBusinessId,
            locationId: batch.locationId,
            trainerId: batch.trainerId,
            organizationId: orgId
          };

          console.log('Creating user with data:', { 
            ...traineeData, 
            password: '[REDACTED]',
            role,
            category: 'trainee'
          });

          // Create user
          const user = await storage.createUser(traineeData);
          console.log('User created:', user.id);
          
          // Create batch process assignment
          await storage.assignUserToBatch({
            userId: user.id,
            batchId,
            processId: batch.processId,
            status: 'active',
            joinedAt: new Date()
          });

          console.log('User assigned to batch');

          // Create user process record
          await storage.createUserProcess({
            userId: user.id,
            processId: batch.processId,
            organizationId: orgId,
            lineOfBusinessId: batch.lineOfBusinessId,
            locationId: batch.locationId,
            status: 'active',
            assignedAt: new Date()
          });

          console.log('User process record created');

          successCount++;
        } catch (error) {
          failureCount++;
          const rowNum = rows.indexOf(row) + 2; // +2 for header row and 0-based index
          const errorMessage = `Row ${rowNum}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMessage);
          console.error('Error processing row:', errorMessage);
        }
      }

      console.log('Upload processing complete:', {
        totalRows: rows.length,
        successCount,
        failureCount,
        errors
      });

      // Send detailed response
      res.json({
        message: "Bulk upload completed",
        totalRows: rows.length,
        successCount,
        failureCount,
        errors: errors.length > 0 ? errors : undefined,
        remainingCapacity: remainingCapacity - successCount
      });
    } catch (error) {
      console.error("Bulk upload error:", error);
      res.status(500).json({
        message: "Failed to process bulk upload",
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Update attendance endpoint 
  app.post("/api/attendance", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const { traineeId, status, date, batchId, phase } = req.body;

      // Validate required fields
      if (!traineeId || !status || !date || !batchId || !phase) {
        return res.status(400).json({ 
          message: "Missing required fields",
          required: ["traineeId", "status", "date", "batchId", "phase"]
        });
      }

      // Validate the status
      const validStatuses = ['present', 'absent', 'late', 'leave'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          message: "Invalid attendance status",
          validStatuses
        });
      }

      // Check if trainee belongs to the batch
      const [batchTrainee] = await db
        .select()
        .from(userBatchProcesses)
        .where(
          and(
            eq(userBatchProcesses.userId, traineeId),
            eq(userBatchProcesses.batchId, batchId),
            eq(userBatchProcesses.status, 'active')
          )
        );

      if (!batchTrainee) {
        return res.status(400).json({
          message: "Trainee is not enrolled in this batch or is not active"
        });
      }

      // Create or update attendance record
      const [result] = await db
        .insert(attendance)
        .values({
          traineeId,
          status,
          date,
          batchId,
          phase,
          markedById: req.user.id,
          organizationId: req.user.organizationId,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [attendance.traineeId, attendance.date, attendance.batchId],
          set: {
            status,
            phase,
            updatedAt: new Date()
          }
        })
        .returning();

      console.log('Attendance record saved:', result);
      return res.json(result);
    } catch (error: any) {
      console.error("Error saving attendance record:", error);
      return res.status(500).json({ 
        message: "Failed to save attendance record",
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
        return res.status(403).json({ message: "Youcan only delete processes in your own organization" });
      }

      console.log('Deleting process:', processId);
      await storage.deleteProcess(processId);

      console.log('Process deleted successfully');
      res.status(200).json({ message: "Processdeleted successfully"});
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

      // Create user with role from form 
      const userToCreate = {
        ...userData,
        password: hashedPassword,
        category: "trainee", // Keep category as trainee
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

  // Add new route for starting a batch after existing batch routes
  app.post("/api/batches/:batchId/start", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      if (!batchId) {
        return res.status(400).json({ message: "Invalid batch ID" });
      }

      // Get the batch
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if batch can be started
      if (batch.status !== 'planned') {
        return res.status(400).json({ 
          message: "Only planned batches can be started" 
        });
      }

      // Get trainees count for this batch
      const trainees = await storage.getBatchTrainees(batchId);
      const traineeCount = trainees.filter(trainee => trainee.category === 'trainee').length;

      if (traineeCount === 0) {
        return res.status(400).json({
          message: "Cannot start batch without any trainees. Please add at least one trainee before starting the batch."
        });
      }

      // Store dates in UTC format while preserving IST midnight
      const currentDate = new Date();
      const updatedBatch = await storage.updateBatch(batchId, {
        status: 'induction',
        startDate: toUTCStorage(currentDate.toISOString())
      });

      console.log('Successfully started batch:', {
        ...updatedBatch,
        startDate: formatISTDateOnly(updatedBatch.startDate)
      });

      res.json(updatedBatch);

    } catch (error: any) {
      console.error("Error starting batch:", error);
      res.status(500).json({ message: error.message || "Failed to start batch" });
    }
  });

  // Add batch listing route with status filter
  app.get("/api/organizations/:orgId/batches", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const status = req.query.status as string;

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view batches in your own organization" });
      }

      let batches = await storage.listBatches(orgId);

      // Filter by status if specified
      if (status) {
        batches = batches.filter(batch => batch.status === status);
      }

      // For each batch, enrich with location, process, and line of business details
      const enrichedBatches = awaitPromise.all(batches.map(async (batch) => {
        const [location, process, line_of_business] = await Promise.all([
          storage.getLocation(batch.locationId),
          storage.getProcess(batch.processId),
          storage.getLineOfBusiness(batch.lineOfBusinessId)
        ]);

        return {
          ...batch,
          location,
          process,
          line_ofbusiness
        };
      }));

      console.log(`Found ${enrichedBatches.length} batches for organization ${orgId}`);
      res.json(enrichedBatches);
    } catch (error: any) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Modify trainee management route to only show 'planned' batches
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

      // Check if batch status is 'planned'
      if (batch.status !== 'planned') {
        return res.status(403).json({ message: "Only 'planned' batches can be accessed through this route." });
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

  // Add new route for starting a batch after existing batch routes
  app.post("/api/batches/:batchId/start", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      if (!batchId) {
        return res.status(400).json({ message: "Invalid batch ID" });
      }

      // Get the batch
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if batch can be started
      if (batch.status !== 'planned') {
        return res.status(400).json({ 
          message: "Only planned batches can be started" 
        });
      }

      // Get trainees count for this batch
      const trainees = await storage.getBatchTrainees(batchId);
      const traineeCount = trainees.filter(trainee => trainee.category === 'trainee').length;

      if (traineeCount === 0) {
        return res.status(400).json({
          message: "Cannot start batch without any trainees. Please add at least one trainee before starting the batch."
        });
      }

      // Store dates in UTC format while preserving IST midnight
      const currentDate = new Date();
      const updatedBatch = await storage.updateBatch(batchId, {
        status: 'induction',
        startDate: toUTCStorage(currentDate.toISOString())
      });

      console.log('Successfully started batch:', {
        ...updatedBatch,
        startDate: formatISTDateOnly(updatedBatch.startDate)
      });

      res.json(updatedBatch);

    } catch (error: any) {
      console.error("Error starting batch:", error);
      res.status(500).json({ message: error.message || "Failed to start batch" });
    }
  });

  // Add batch listing route with status filter
  app.get("/api/organizations/:orgId/batches", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const status = req.query.status as string;

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only view batches in your own organization" });
      }

      let batches = await storage.listBatches(orgId);

      // Filter by status if specified
      if (status) {
        batches = batches.filter(batch => batch.status === status);
      }

      // For each batch, enrich with location, process, and line of business details
      const enrichedBatches = await Promise.all(batches.map(async (batch) => {
        const [location, process, line_of_business] = await Promise.all([
          storage.getLocation(batch.locationId),
          storage.getProcess(batch.processId),
          storage.getLineOfBusiness(batch.lineOfBusinessId)
        ]);

        return {
          ...batch,
          location,
          process,
          line_ofbusiness
        };
      }));

      console.log(`Found ${enrichedBatches.length} batches for organization ${orgId}`);
      res.json(enrichedBatches);
    } catch (error: any) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Modify trainee management route to only show 'planned' batches
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

      // Check if batch status is 'planned'
      if (batch.status !== 'planned') {
        return res.status(403).json({ message: "Only 'planned' batches can be accessed through this route." });
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

  // Add new route for starting a batch after existing batch routes
  app.post("/api/batches/:batchId/start", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId);
      if (!batchId) {
        return res.status(400).json({ message: "Invalid batch ID" });
      }

      // Get the batch
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Check if batch can be started
      if (batch.status !== 'planned') {
        return res.status(400).json({ 
          message: "Only planned batches can be started" 
        });
      }

      // Get trainees count for this batch
      const trainees = await storage.getBatchTrainees(batchId);
      const traineeCount = trainees.filter(trainee => trainee.category === 'trainee').length;

      if (traineeCount === 0) {
        return res.status(400).json({
          message: "Cannot start batch without any trainees. Please add at least one trainee before starting the batch."
        });
      }

      // Store dates in UTC format while preserving IST midnight
      const currentDate = new Date();
      const updatedBatch = await storage.updateBatch(batchId, {
        status: 'induction',
        startDate: toUTCStorage(currentDate.toISOString())
      });

      console.log('Successfully started batch:', {
        ...updatedBatch,
        startDate: formatISTDateOnly(updatedBatch.startDate)
      });

      res.json(updatedBatch);

    } catch (error: any) {
      console.error("Error starting batch:", error);
      res.status(500).json({ message: error.message || "Failed to start batch" });
    }
  });

  // Add attendance routes
  app.post("/api/attendance/:traineeId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const traineeId = parseInt(req.params.traineeId);
      const { status, date } = req.body;

      // Validate the status
      const validStatuses = ['present', 'absent', 'late'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid attendance status" });
      }

      // Save attendance record
      const attendance = await storage.createAttendanceRecord({
        traineeId,
        status,
        date,
        markedById: req.user.id,
        organizationId: req.user.organizationId
      });

      // Return the updated attendance record
      res.json(attendance);
    } catch (error: any) {
      console.error("Error updating attendance:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get attendance for a trainee
  app.get("/api/attendance/:traineeId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const traineeId = parseInt(req.params.traineeId);
      const date = req.query.date as string;

      const attendance = await storage.getAttendanceRecord(traineeId, date);
      res.json(attendance);
    } catch (error: any) {
      console.error("Error fetching attendance:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add question routes
  app.post("/api/questions", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const questionData = {
        ...req.body,
        createdBy: req.user.id,
        organizationId: req.user.organizationId, 
        processId: req.user.processId || 1, // Default to first process if none assigned
      };

      // Create the question in the database
      const question = await storage.createQuestion(questionData);
      console.log('Created question:', question);
      
      res.status(201).json(question);
    } catch (error: any) {
      console.error("Error creating question:", error); 
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/questions", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      // Get questions for the user's organization  
      const questions = await storage.listQuestions(req.user.organizationId);
      res.json(questions);
    } catch (error: any) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get batch trainees with attendance
  app.get("/api/organizations/:orgId/batches/:batchId/trainees", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const batchId = parseInt(req.params.batchId); 
      const date = new Date().toISOString().split('T')[0]; // Get current date

      const trainees = await storage.getBatchTrainees(batchId);
      
      // Get attendance status for each trainee
      const traineesWithAttendance = await Promise.all(
        trainees.map(async (trainee) => {
          const attendance = await storage.getAttendanceRecord(trainee.userId, date);
          const user = await storage.getUser(trainee.userId);
          
          return {
            id: trainee.userId,
            name: user?.fullName || 'Unknown',
            status: attendance?.status || null,
            lastUpdated: attendance?.updatedAt || null
          };
        })
      );

      res.json(traineesWithAttendance);
    } catch (error: any) {
      console.error("Error fetching trainees with attendance:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Mock Call Scenario Routes
  app.post("/api/mock-call-scenarios", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      console.log('Creating mock call scenario:', req.body);
      const validatedData = insertMockCallScenarioSchema.parse({
        ...req.body,
        organizationId: req.user.organizationId,
        createdBy: req.user.id
      });

      const newScenario = await storage.createMockCallScenario(validatedData);
      console.log('Created mock call scenario:', newScenario);
      res.status(201).json(newScenario);
    } catch (error: any) {
      console.error("Error creating mock call scenario:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/organizations/:organizationId/mock-call-scenarios", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const orgId = parseInt(req.params.organizationId);
      if (!orgId || req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const scenarios = await db
        .select()
        .from(mockCallScenarios)
        .where(eq(mockCallScenarios.organizationId, orgId));

      res.json(scenarios);
    } catch (error: any) {
      console.error("Error fetching mock call scenarios:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/mock-call-scenarios/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const scenarioId = parseInt(req.params.id);
      const scenario = await db
        .select()
        .from(mockCallScenarios)
        .where(eq(mockCallScenarios.id, scenarioId))
        .limit(1);

      if (!scenario.length) {
        return res.status(404).json({ message: "Scenario not found" });
      }

      // Verify organization access
      if (scenario[0].organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(scenario[0]);
    } catch (error: any) {
      console.error("Error fetching mock call scenario:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/mock-call-scenarios/:id/attempts", async (req, res) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const scenarioId = parseInt(req.params.id);
      const validatedData = insertMockCallAttemptSchema.parse({
        ...req.body,
        scenarioId,
        userId: req.user.id,
        organizationId: req.user.organizationId,
        startedAt: new Date().toISOString()
      });

      const newAttempt = await storage.createMockCallAttempt(validatedData);
      res.status(201).json(newAttempt);
    } catch (error: any) {
      console.error("Error creating mock call attempt:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/mock-call-attempts/:id/evaluate", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const attemptId = parseInt(req.params.id);
      const { scores, feedback } = req.body;

      // Verify the attempt exists and user has permission to evaluate
      const attempt = await db
        .select()
        .from(mockCallAttempts)
        .where(eq(mockCallAttempts.id, attemptId))
        .limit(1);

      if (!attempt.length) {
        return res.status(404).json({ message: "Attempt not found" });
      }

      if (attempt[0].evaluatorId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to evaluate this attempt" });
      }

      // Update the attempt with evaluation
      const updatedAttempt = await db
        .update(mockCallAttempts)
        .set({
          scores,
          feedback,
          status: 'completed',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where(eq(mockCallAttempts.id, attemptId))
        .returning();

      res.json(updatedAttempt[0]);
    } catch (error: any) {
      console.error("Error evaluating mock call attempt:", error);
      res.status(400).json({ message: error.message });
    }
  });

  return createServer(app);
}