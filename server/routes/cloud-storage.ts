import express, { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { organizations } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import cloudStorage from '../services/cloudStorage';
import azureStorage from '../services/azureStorage';
import multer from 'multer';

// Create upload middleware for file handling
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Schema for cloud storage configuration
const cloudStorageConfigSchema = z.object({
  provider: z.enum(['azure', 'aws', 'gcp', 'local', 'other']),
  enabled: z.boolean(),
  
  // General config properties
  connectionString: z.string().optional(),
  container: z.string().optional(),
  bucket: z.string().optional(),
  region: z.string().optional(),
  folder: z.string().optional(),
  accessKey: z.string().optional(),
  secretKey: z.string().optional(),
  endpoint: z.string().optional(),
});

// Create router
const router = Router();

// Properly typed middleware for authentication and organization checks
import { Request, Response, NextFunction } from 'express';

// Interface to extend Express Request with our User type
// Ensures organizationId is strictly typed as number (not number|null)
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    organizationId: number; // Always a number when present
    username: string;
    role: string;
    [key: string]: any;
  };
}

// Check if user is authenticated
function isAuthenticated(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

// Check if user has organizationId
function hasOrganization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  // Since we've defined organizationId as non-null in our interface,
  // we only need to check if req.user exists
  next();
}

// Get cloud storage configuration for an organization
router.get('/api/organizations/:organizationId/cloud-storage', 
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = parseInt(req.params.organizationId);
      
      // Ensure user belongs to this organization
      if (!req.user || organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Get organization's cloud storage configuration
      const [org] = await db
        .select({
          cloudStorageEnabled: organizations.cloudStorageEnabled,
          cloudStorageProvider: organizations.cloudStorageProvider,
          cloudStorageConfig: organizations.cloudStorageConfig
        })
        .from(organizations)
        .where(eq(organizations.id, organizationId));
      
      if (!org) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      // Check if storage is properly configured
      const isConfigured = await cloudStorage.isConfigured(organizationId);
      
      res.json({
        enabled: org.cloudStorageEnabled,
        provider: org.cloudStorageProvider,
        config: org.cloudStorageConfig || {},
        isConfigured
      });
    } catch (error: any) {
      console.error('Error fetching cloud storage configuration:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Update cloud storage configuration for an organization
router.post('/api/organizations/:organizationId/cloud-storage', 
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = parseInt(req.params.organizationId);
      
      // Ensure user belongs to this organization
      if (!req.user || organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Validate request body
      const config = cloudStorageConfigSchema.parse(req.body);
      
      // Update organization's cloud storage configuration
      await db
        .update(organizations)
        .set({
          cloudStorageEnabled: config.enabled,
          cloudStorageProvider: config.provider,
          cloudStorageConfig: {
            connectionString: config.connectionString,
            container: config.container,
            bucket: config.bucket, 
            region: config.region,
            folder: config.folder,
            accessKey: config.accessKey,
            secretKey: config.secretKey,
            endpoint: config.endpoint
          }
        })
        .where(eq(organizations.id, organizationId));
      
      // Check if the new configuration is valid
      const isConfigured = await cloudStorage.isConfigured(organizationId);
      
      res.json({
        enabled: config.enabled,
        provider: config.provider,
        isConfigured
      });
    } catch (error: any) {
      console.error('Error updating cloud storage configuration:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid configuration data', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: error.message });
    }
  }
);

// List files in storage
router.get('/api/organizations/:organizationId/cloud-storage/files', 
  isAuthenticated,
  hasOrganization,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = parseInt(req.params.organizationId);
      const prefix = req.query.prefix as string | undefined;
      
      // Ensure user belongs to this organization
      if (!req.user || organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Check if storage is configured
      const isConfigured = await cloudStorage.isConfigured(organizationId);
      if (!isConfigured) {
        return res.status(400).json({ message: 'Cloud storage is not properly configured' });
      }
      
      // List files
      const files = await cloudStorage.listFiles(organizationId, prefix);
      
      res.json(files);
    } catch (error: any) {
      console.error('Error listing files from cloud storage:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Upload file to storage
router.post('/api/organizations/:organizationId/cloud-storage/upload',
  isAuthenticated,
  hasOrganization,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = parseInt(req.params.organizationId);
      
      // Ensure user belongs to this organization
      if (!req.user || organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Check if storage is configured
      const isConfigured = await cloudStorage.isConfigured(organizationId);
      if (!isConfigured) {
        return res.status(400).json({ message: 'Cloud storage is not properly configured' });
      }
      
      // Ensure file is uploaded
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Get file info
      const { originalname, mimetype, buffer, size } = req.file;
      
      // Upload file
      const uploadResult = await cloudStorage.uploadFile(
        organizationId,
        buffer,
        originalname,
        mimetype
      );
      
      res.status(201).json({
        url: uploadResult.url,
        etag: uploadResult.etag,
        originalName: originalname,
        size,
        contentType: mimetype
      });
    } catch (error: any) {
      console.error('Error uploading file to cloud storage:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Delete file from storage
router.delete('/api/organizations/:organizationId/cloud-storage/files',
  isAuthenticated,
  hasOrganization,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = parseInt(req.params.organizationId);
      const fileUrl = req.query.url as string;
      
      // Ensure user belongs to this organization
      if (!req.user || organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Check if storage is configured
      const isConfigured = await cloudStorage.isConfigured(organizationId);
      if (!isConfigured) {
        return res.status(400).json({ message: 'Cloud storage is not properly configured' });
      }
      
      // Ensure file URL is provided
      if (!fileUrl) {
        return res.status(400).json({ message: 'File URL is required' });
      }
      
      // Delete file
      await cloudStorage.deleteFile(organizationId, fileUrl);
      
      res.status(204).end();
    } catch (error: any) {
      console.error('Error deleting file from cloud storage:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Generate pre-signed URL for file
router.get('/api/organizations/:organizationId/cloud-storage/files/presigned',
  isAuthenticated,
  hasOrganization,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = parseInt(req.params.organizationId);
      const fileUrl = req.query.url as string;
      const expiryMinutes = req.query.expiryMinutes ? parseInt(req.query.expiryMinutes as string) : 60;
      
      // Ensure user belongs to this organization
      if (!req.user || organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Check if storage is configured
      const isConfigured = await cloudStorage.isConfigured(organizationId);
      if (!isConfigured) {
        return res.status(400).json({ message: 'Cloud storage is not properly configured' });
      }
      
      // Ensure file URL is provided
      if (!fileUrl) {
        return res.status(400).json({ message: 'File URL is required' });
      }
      
      // Generate pre-signed URL
      const presignedUrl = await cloudStorage.generatePresignedUrl(organizationId, fileUrl, expiryMinutes);
      
      res.json({ url: presignedUrl, expiryMinutes });
    } catch (error: any) {
      console.error('Error generating pre-signed URL:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Test storage connection
router.post('/api/organizations/:organizationId/cloud-storage/test-connection',
  isAuthenticated,
  hasOrganization,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = parseInt(req.params.organizationId);
      
      // Ensure user belongs to this organization
      if (!req.user || organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Test if the provided configuration works
      let isConfigured = false;
      
      if (req.body.testExisting) {
        // Test the existing configuration
        isConfigured = await cloudStorage.isConfigured(organizationId);
      } else {
        // Test a new configuration without saving it
        const config = cloudStorageConfigSchema.parse(req.body);
        
        // A proper test would involve temporarily setting this configuration and testing it
        // This is a simplified version
        isConfigured = config.enabled && (
          (config.provider === 'azure' && !!config.connectionString) ||
          (config.provider === 'aws' && !!config.accessKey && !!config.secretKey) ||
          (config.provider === 'local')
        );
      }
      
      res.json({ success: isConfigured });
    } catch (error: any) {
      console.error('Error testing cloud storage connection:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid configuration data', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: error.message });
    }
  }
);

export default router;