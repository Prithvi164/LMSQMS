import { Router } from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import multer from 'multer';
import { initAzureStorageService } from '../services/azureStorageService';
import { audioFileAllocations, audioFiles, audioLanguageEnum } from '../../shared/schema';
import { db } from '../db';
import { eq, and, inArray } from 'drizzle-orm';

const router = Router();

// Make sure Azure credentials are available before initializing routes
const azureService = initAzureStorageService();
if (!azureService) {
  console.error('Azure service could not be initialized. Routes will not function.');
}

// Configure multer storage for Excel file uploads
const uploadsDir = join(process.cwd(), 'public', 'uploads', 'excel');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop();
    cb(null, `azure-metadata-${uniqueSuffix}.${ext}`);
  }
});

const excelUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const allowedExtensions = ['.xls', '.xlsx'];
    const fileExtension = '.' + file.originalname.split('.').pop();
    
    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files are allowed.'), false);
    }
  }
});

// Get available containers in Azure
router.get('/azure-containers', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  
  try {
    const containers = await azureService.blobServiceClient.listContainers();
    const containerList = [];
    
    for await (const container of containers) {
      containerList.push({
        name: container.name,
        properties: container.properties
      });
    }
    
    res.json(containerList);
  } catch (error) {
    console.error('Error listing Azure containers:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get blobs in a container
router.get('/azure-blobs/:containerName', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  
  const { containerName } = req.params;
  
  try {
    const blobs = await azureService.listBlobs(containerName);
    res.json(blobs);
  } catch (error) {
    console.error(`Error listing blobs in container ${containerName}:`, error);
    res.status(500).json({ message: error.message });
  }
});

// Upload Excel metadata file and process with Azure audio files
router.post('/azure-audio-import/:containerName', excelUpload.single('metadataFile'), async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
  const { containerName } = req.params;
  const { processId } = req.body;
  
  if (!processId) {
    return res.status(400).json({ message: 'Process ID is required' });
  }
  
  try {
    // First check if container exists
    const containerClient = azureService.getContainerClient(containerName);
    const containerExists = await containerClient.exists();
    
    if (!containerExists) {
      return res.status(404).json({ message: `Container ${containerName} does not exist` });
    }
    
    // Parse Excel file from Azure (assuming you have an Excel with metadata in Azure)
    const excelBlobName = req.body.excelBlobName;
    
    // If the Excel file was uploaded locally, we could parse it directly
    // but for now we'll assume we're parsing from Azure
    if (!excelBlobName) {
      return res.status(400).json({ message: 'Excel blob name is required' });
    }
    
    // Parse metadata from Excel
    const metadataItems = await azureService.parseMetadataExcel(containerName, excelBlobName);
    
    // Match with actual files in Azure and get enhanced metadata
    const enrichedItems = await azureService.matchAudioFilesWithMetadata(containerName, metadataItems);
    
    // Store in database
    const importResults = [];
    
    for (const item of enrichedItems) {
      try {
        // Generate a SAS URL for the file
        const sasUrl = await azureService.generateBlobSasUrl(
          containerName,
          item.filename,
          1440 // 24 hours
        );
        
        // Create the database record
        const [audioFile] = await db
          .insert(audioFiles)
          .values({
            filename: item.filename,
            originalFilename: item.originalFilename || item.filename,
            fileUrl: sasUrl,
            fileSize: item.fileSize || 0,
            duration: item.duration || 0,
            language: item.language as any,
            version: item.version,
            call_date: item.call_date,
            callMetrics: item.callMetrics,
            status: 'pending',
            uploadedBy: req.user.id,
            processId: parseInt(processId),
            organizationId: req.user.organizationId
          })
          .returning();
        
        importResults.push({
          file: item.filename,
          status: 'success',
          id: audioFile.id
        });
      } catch (error) {
        console.error(`Error importing ${item.filename}:`, error);
        importResults.push({
          file: item.filename,
          status: 'error',
          error: error.message
        });
      }
    }
    
    res.json({
      totalProcessed: enrichedItems.length,
      successCount: importResults.filter(r => r.status === 'success').length,
      errorCount: importResults.filter(r => r.status === 'error').length,
      results: importResults
    });
  } catch (error) {
    console.error('Error processing Azure audio file import:', error);
    res.status(500).json({ message: error.message });
  }
});

// Generate SAS URL for a specific file (used by auditors when playing)
router.get('/azure-audio-sas/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  
  const { id } = req.params;
  
  try {
    // Get the audio file record
    const [audioFile] = await db
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.id, parseInt(id)));
    
    if (!audioFile) {
      return res.status(404).json({ message: 'Audio file not found' });
    }
    
    // Check org access
    if (audioFile.organizationId !== req.user.organizationId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Extract container and filename from fileUrl
    const url = new URL(audioFile.fileUrl);
    const pathParts = url.pathname.split('/');
    const containerName = pathParts[1];
    const blobName = pathParts.slice(2).join('/');
    
    // Generate a fresh SAS URL (existing one may have expired)
    const sasUrl = await azureService.generateBlobSasUrl(containerName, blobName, 60); // 60 minute expiry
    
    res.json({ sasUrl });
  } catch (error) {
    console.error(`Error generating SAS URL for audio file ${id}:`, error);
    res.status(500).json({ message: error.message });
  }
});

// Allocate audio files to quality analysts
router.post('/azure-audio-allocate', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  
  const { audioFileIds, qualityAnalystId, dueDate } = req.body;
  
  if (!audioFileIds || !Array.isArray(audioFileIds) || audioFileIds.length === 0) {
    return res.status(400).json({ message: 'Audio file IDs are required' });
  }
  
  if (!qualityAnalystId) {
    return res.status(400).json({ message: 'Quality analyst ID is required' });
  }
  
  try {
    // Verify files exist and belong to user's organization
    const audioFilesToAllocate = await db
      .select()
      .from(audioFiles)
      .where(and(
        eq(audioFiles.organizationId, req.user.organizationId),
        inArray(audioFiles.id, audioFileIds)
      ));
    
    if (audioFilesToAllocate.length !== audioFileIds.length) {
      return res.status(400).json({ 
        message: 'Some audio files were not found or do not belong to your organization' 
      });
    }
    
    // Create allocations
    const allocations = [];
    
    for (const file of audioFilesToAllocate) {
      try {
        const [allocation] = await db
          .insert(audioFileAllocations)
          .values({
            audioFileId: file.id,
            qualityAnalystId,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            status: 'allocated',
            allocatedBy: req.user.id,
            organizationId: req.user.organizationId
          })
          .returning();
        
        // Update audio file status
        await db
          .update(audioFiles)
          .set({
            status: 'allocated',
            updatedAt: new Date()
          })
          .where(eq(audioFiles.id, file.id));
        
        allocations.push(allocation);
      } catch (error) {
        console.error(`Error allocating audio file ${file.id}:`, error);
      }
    }
    
    res.json({
      allocated: allocations.length,
      allocations
    });
  } catch (error) {
    console.error('Error allocating audio files:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;