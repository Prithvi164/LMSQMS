import { Router } from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import multer from 'multer';
import { initAzureStorageService, AudioFileMetadata } from '../services/azureStorageService';
import { audioFileAllocations, audioFiles, audioLanguageEnum } from '../../shared/schema';
import { db } from '../db';
import { eq, and, inArray } from 'drizzle-orm';
import * as XLSX from 'xlsx';

const router = Router();

// Function to parse the uploaded Excel file
async function parseExcelFile(filePath: string): Promise<AudioFileMetadata[]> {
  try {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    
    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert the worksheet to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    
    // Map the raw data to AudioFileMetadata structure
    const metadataItems: AudioFileMetadata[] = rawData.map((row: any) => {
      // Basic validation
      if (!row.filename) {
        throw new Error('Excel file missing required "filename" column');
      }
      
      if (!row.language) {
        throw new Error('Excel file missing required "language" column');
      }
      
      if (!row.version) {
        throw new Error('Excel file missing required "version" column');
      }
      
      if (!row.call_date) {
        throw new Error('Excel file missing required "call_date" column');
      }
      
      // Extract call metrics from the row
      const callMetrics: any = {};
      for (const key in row) {
        if (key !== 'filename' && key !== 'originalFilename' && 
            key !== 'language' && key !== 'version' && key !== 'call_date') {
          callMetrics[key] = row[key];
        }
      }
      
      // Return a properly formatted AudioFileMetadata object
      return {
        filename: row.filename,
        originalFilename: row.originalFilename || row.filename,
        language: row.language.toLowerCase(),
        version: row.version,
        call_date: row.call_date,
        callMetrics
      };
    });
    
    return metadataItems;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw new Error(`Error parsing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

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

// Get folders in a container
router.get('/azure-folders/:containerName', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  
  const { containerName } = req.params;
  
  try {
    const folders = await azureService.listFolders(containerName);
    res.json(folders);
  } catch (error) {
    console.error(`Error listing folders in container ${containerName}:`, error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error occurred' });
  }
});

// Get blobs in a container (optional folder path)
router.get('/azure-blobs/:containerName', async (req, res) => {
  console.log(`Received request for blobs in container: ${req.params.containerName}`);
  
  if (!req.user) {
    console.log('User not authenticated for blob listing');
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  if (!azureService) {
    console.log('Azure service not available for blob listing');
    return res.status(503).json({ message: 'Azure service not available' });
  }
  
  const { containerName } = req.params;
  const folderPath = req.query.folderPath as string || '';
  
  console.log(`Attempting to list blobs in container: ${containerName}, folder path: ${folderPath}`);
  
  try {
    console.log(`Calling Azure service to list blobs for container: ${containerName}`);
    const blobs = await azureService.listBlobs(containerName, folderPath);
    console.log(`Retrieved ${blobs.length} blobs from container ${containerName} in folder ${folderPath || 'root'}`);
    res.json(blobs);
  } catch (error) {
    console.error(`Error listing blobs in container ${containerName}:`, error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error occurred' });
  }
});

// Upload Excel metadata file and process with Azure audio files
router.post('/azure-audio-import/:containerName', excelUpload.single('metadataFile'), async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
  const { containerName } = req.params;
  // ProcessId is now optional
  const { processId } = req.body;
  
  try {
    // First check if container exists
    const containerClient = azureService.getContainerClient(containerName);
    const containerExists = await containerClient.exists();
    
    if (!containerExists) {
      return res.status(404).json({ message: `Container ${containerName} does not exist` });
    }
    
    // Parse the uploaded Excel file directly
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: 'Excel file upload failed' });
    }
    
    // Parse metadata from the uploaded Excel file
    const metadataItems = await parseExcelFile(req.file.path);
    
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
            // Use a default process ID if none is provided (1 is typically the default process)
            processId: processId ? parseInt(processId) : 1,
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

// Create a template Excel file for audio metadata
router.get('/azure-metadata-template', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    // Create a new workbook
    const wb = XLSX.utils.book_new();
    
    // Sample data with all required fields
    const sampleData = [
      {
        filename: 'agent-123-20250401-1234.mp3', // This should match the actual filename in Azure
        originalFilename: 'Customer Call - John Smith - Billing Issue.mp3',
        language: 'english', // must be one of: english, spanish, french, hindi, other
        version: '1.0',
        call_date: '2025-04-01', // YYYY-MM-DD format
        callId: '101',
        callType: 'inbound',
        agentId: '249',
        campaignName: 'Symp_Inbound_D2C',
        duration: 1, // in minutes
        disposition1: 'Lead',
        disposition2: 'happy',
        customerMobile: '9876543210',
        callTime: '15:30:45',
        subType: 'Customer Service',
        subSubType: 'Billing Inquiry',
        VOC: 'Positive',
        userRole: 'Agent',
        advisorCategory: 'Level 1',
        queryType: 'General',
        businessSegment: 'Consumer'
      },
      {
        filename: 'agent-456-20250401-5678.mp3',
        originalFilename: 'Customer Call - Jane Doe - Technical Issue.mp3',
        language: 'spanish',
        version: '1.0',
        call_date: '2025-04-01',
        callId: '102',
        callType: 'outbound',
        agentId: '204',
        campaignName: 'NPR_Restel_Outbound',
        duration: 2, // in minutes
        disposition1: 'Not Lead',
        disposition2: 'not happy',
        customerMobile: '8765432109',
        callTime: '16:45:30',
        subType: 'Technical Support',
        subSubType: 'Product Issue',
        VOC: 'Negative',
        userRole: 'Supervisor',
        advisorCategory: 'Level 2',
        queryType: 'Specific',
        businessSegment: 'Enterprise'
      }
    ];
    
    // Create worksheet and add to workbook
    const ws = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, 'Audio Metadata');
    
    // Add column width specifications for better readability
    const wscols = [
      { wch: 30 }, // filename
      { wch: 40 }, // originalFilename
      { wch: 10 }, // language
      { wch: 10 }, // version
      { wch: 12 }, // call_date
      { wch: 10 }, // callId
      { wch: 10 }, // callType
      { wch: 10 }, // agentId
      { wch: 20 }, // campaignName
      { wch: 10 }, // duration
      { wch: 12 }, // disposition1
      { wch: 12 }, // disposition2
      { wch: 15 }, // customerMobile
      { wch: 10 }, // callTime
      { wch: 15 }, // subType
      { wch: 15 }, // subSubType
      { wch: 10 }, // VOC
      { wch: 12 }, // userRole
      { wch: 15 }, // advisorCategory
      { wch: 12 }, // queryType
      { wch: 18 }  // businessSegment
    ];
    ws['!cols'] = wscols;
    
    // Write to buffer
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=audio-metadata-template.xlsx');
    
    // Send the file
    res.send(buf);
  } catch (error) {
    console.error('Error creating metadata template:', error);
    res.status(500).json({ message: 'Failed to generate template' });
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