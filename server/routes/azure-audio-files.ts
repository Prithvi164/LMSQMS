import { Router } from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import multer from 'multer';
import { initAzureStorageService, AudioFileMetadata } from '../services/azureStorageService';
import { audioFileAllocations, audioFiles, audioLanguageEnum, users } from '../../shared/schema';
import { db } from '../db';
import { eq, and, inArray } from 'drizzle-orm';
import { read as readXLSX, utils as xlsxUtils, write as writeXLSX } from 'xlsx';

const router = Router();

// Function to parse the uploaded Excel file
async function parseExcelFile(filePath: string): Promise<AudioFileMetadata[]> {
  try {
    // First try using the normal xlsx parsing
    let workbook;
    let excelParsingFailed = false;

    try {
      workbook = readXLSX(filePath, { cellDates: true, type: 'file' });
    } catch (e) {
      console.error("Regular Excel parsing failed:", e);
      excelParsingFailed = true;
    }

    // If standard parsing failed, let's try an alternative approach - try reading as binary
    if (excelParsingFailed) {
      try {
        workbook = readXLSX(filePath, { type: 'binary' });
        console.log("Binary Excel parsing succeeded as fallback");
        excelParsingFailed = false;
      } catch (e) {
        console.error("Binary Excel parsing also failed:", e);
        throw new Error("Excel file is corrupted or in an unsupported format. Please download and use one of our templates.");
      }
    }
    
    // Verify we have a valid workbook with at least one sheet
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file contains no worksheets');
    }
    
    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      throw new Error('Excel file contains an empty worksheet');
    }

    // TRY SIMPLER APPROACH: Use array of arrays method first
    // This often works better with problematic Excel files
    try {
      const rawDataArray = xlsxUtils.sheet_to_json(worksheet, { 
        header: 1,  // Get array of arrays with first row as headers
        raw: false, // Convert everything to strings for consistency
        blankrows: false // Skip blank rows
      }) as any[][];

      if (!rawDataArray || rawDataArray.length < 2) { // Need at least header row and one data row
        throw new Error('Excel file must contain at least a header row and one data row');
      }

      // Get header row and convert to lowercase for case-insensitive matching
      const headers = rawDataArray[0].map(h => String(h || '').toLowerCase());
      
      // Find the required column indices
      const filenameIndex = headers.findIndex(h => h.includes('file') || h.includes('name') || h === 'filename');
      const languageIndex = headers.findIndex(h => h.includes('lang') || h === 'language');
      const versionIndex = headers.findIndex(h => h.includes('ver') || h === 'version');
      const dateIndex = headers.findIndex(h => h.includes('date') || h === 'call_date');
      
      if (filenameIndex === -1) {
        throw new Error(`Could not find filename column. Available columns are: ${headers.join(', ')}`);
      }

      // Process data rows
      const result: AudioFileMetadata[] = [];
      
      for (let i = 1; i < rawDataArray.length; i++) {
        const row = rawDataArray[i];
        if (!row || row.length === 0) continue;
        
        // Ensure the filename exists
        const filename = row[filenameIndex]?.toString().trim();
        if (!filename) {
          console.warn(`Row ${i+1}: Missing filename, skipping`);
          continue;
        }
        
        // Get other fields without defaults
        const language = (languageIndex >= 0 && row[languageIndex]) ? 
          row[languageIndex].toString().toLowerCase() : null;
        
        const version = (versionIndex >= 0 && row[versionIndex]) ? 
          row[versionIndex].toString() : null;
        
        let callDate = (dateIndex >= 0 && row[dateIndex]) ? 
          row[dateIndex].toString() : null;
        
        // Basic date parsing for common formats
        if (callDate) {
          try {
            const parsedDate = new Date(callDate);
            if (!isNaN(parsedDate.getTime())) {
              callDate = parsedDate.toISOString().split('T')[0];
            }
          } catch (e) {
            console.warn(`Invalid date "${callDate}" for file ${filename}, using today's date`);
            callDate = new Date().toISOString().split('T')[0];
          }
        }
        
        // Collect any additional metrics from other columns
        const callMetrics = {};
        for (let j = 0; j < headers.length; j++) {
          if (j !== filenameIndex && j !== languageIndex && j !== versionIndex && j !== dateIndex) {
            if (row[j] !== undefined && row[j] !== '') {
              callMetrics[headers[j]] = row[j].toString();
            }
          }
        }
        
        result.push({
          filename,
          language: language as any,
          version,
          call_date: callDate,
          callMetrics
        });
      }
      
      if (result.length === 0) {
        throw new Error('No valid data rows found in the Excel file');
      }
      
      return result;
      
    } catch (arrayParsingError) {
      console.error("Array-based parsing failed:", arrayParsingError);
      // Continue to traditional object-based parsing as fallback
    }
    
    // FALLBACK: Traditional object-based parsing if array method fails
    const rawData = xlsxUtils.sheet_to_json(worksheet, { 
      raw: false,
      defval: '', 
      blankrows: false
    });
    
    if (!rawData || rawData.length === 0) {
      throw new Error('Excel file contains no data or cannot be parsed properly');
    }
    
    // Check for corrupted headers
    const firstRow = rawData[0] as Record<string, any>;
    const keys = Object.keys(firstRow);
    
    let corruptedFileDetected = true;
    for (const key of keys) {
      if (/[a-zA-Z0-9]{3,}/.test(key)) {
        corruptedFileDetected = false;
        break;
      }
    }
    
    if (corruptedFileDetected) {
      throw new Error(`File appears to be corrupted. Found invalid column names: ${keys.join(', ')}. Please download and use one of our templates instead.`);
    }
    
    // Enhanced column mapping with more variations and fuzzy matching
    const columnMap: Record<string, string> = {
      // Filename variations - exact matches
      'filename': 'filename',
      'Filename': 'filename',
      'FILENAME': 'filename',
      'fileName': 'filename',
      'FileName': 'filename',
      'file_name': 'filename',
      'File Name': 'filename',
      'File_Name': 'filename',
      'FNAME': 'filename',
      'file': 'filename',
      'audiofile': 'filename',
      'audio_file': 'filename',
      'Audio File': 'filename',
      'AudioFile': 'filename',
      'Recording': 'filename',
      'recording': 'filename',
      'Record Name': 'filename',
      
      // Language variations
      'language': 'language',
      'Language': 'language',
      'LANGUAGE': 'language',
      'lang': 'language',
      'Lang': 'language',
      'call_language': 'language',
      'Audio Language': 'language',
      
      // Version variations
      'version': 'version',
      'Version': 'version',
      'VERSION': 'version',
      'Ver': 'version',
      'ver': 'version',
      'v': 'version',
      
      // Call date variations
      'call_date': 'call_date',
      'Call_Date': 'call_date',
      'CallDate': 'call_date',
      'callDate': 'call_date',
      'Call Date': 'call_date',
      'CALL_DATE': 'call_date',
      'date': 'call_date',
      'Date': 'call_date',
      'DATE': 'call_date',
      'call date': 'call_date',
      'recording_date': 'call_date',
      'Recording Date': 'call_date'
    };
    
    // Function to find the best matching column for a given target
    const findBestMatchingColumn = (row: any, targetColumn: string): string | null => {
      // First try exact matches using our column map
      for (const key in row) {
        if (columnMap[key] === targetColumn) {
          return key;
        }
      }
      
      // Then try case-insensitive whole-word matching
      for (const key in row) {
        if (key.toLowerCase() === targetColumn.toLowerCase()) {
          return key;
        }
      }
      
      // Then try removing spaces and special characters
      const simplifiedTarget = targetColumn.toLowerCase().replace(/[^a-z0-9]/gi, '');
      for (const key in row) {
        const simplifiedKey = key.toLowerCase().replace(/[^a-z0-9]/gi, '');
        if (simplifiedKey === simplifiedTarget) {
          return key;
        }
      }
      
      // Try partial matching (contains)
      for (const key in row) {
        if (key.toLowerCase().includes(targetColumn.toLowerCase()) ||
            targetColumn.toLowerCase().includes(key.toLowerCase())) {
          return key;
        }
      }
      
      return null;
    };
    
    // Function to normalize a row using our column mapping and smart matching
    const normalizeRow = (row: any, rowIndex: number) => {
      const normalizedRow: any = {};
      const foundColumns: Record<string, string> = {};
      
      // First pass: find the four required columns using our best matching algorithm
      const requiredColumns = ['filename', 'language', 'version', 'call_date'];
      for (const reqCol of requiredColumns) {
        const matchedKey = findBestMatchingColumn(row, reqCol);
        if (matchedKey) {
          normalizedRow[reqCol] = row[matchedKey];
          foundColumns[reqCol] = matchedKey;
        } else {
          // Don't provide defaults for columns that don't exist
          // Only filename field is required, leave others as null if not found
          if (reqCol !== 'filename') {
            normalizedRow[reqCol] = null;
          }
          // For filename we'll leave it undefined and handle the error later
        }
      }
      
      // Second pass: copy all other columns as-is for additional metadata
      for (const key in row) {
        // Skip keys we've already processed
        if (!Object.values(foundColumns).includes(key)) {
          // Use the column map if available, otherwise keep the original name
          const normalizedKey = columnMap[key] || key;
          normalizedRow[normalizedKey] = row[key];
        }
      }
      
      // For filename, ensure we have one and give helpful error if missing
      if (!normalizedRow.filename) {
        if (rowIndex === 0) {
          // If the first row is missing the filename, it's likely a column mapping issue
          throw new Error(`Could not find filename column. Available columns are: ${Object.keys(row).join(', ')}`);
        } else {
          // For other rows, provide more specific error
          throw new Error(`Row ${rowIndex + 1} is missing a filename`);
        }
      }
      
      return normalizedRow;
    };
    
    // Track rows we successfully process and errors we encounter
    const validRows: AudioFileMetadata[] = [];
    const errors: string[] = [];
    
    // Process each row with better error handling
    for (let i = 0; i < rawData.length; i++) {
      try {
        const row = rawData[i] as Record<string, any>;
        const normalizedRow = normalizeRow(row, i);
        
        // Validate language is one of the supported values if provided
        const validLanguages = ['english', 'spanish', 'french', 'hindi', 'other'];
        let language = normalizedRow.language;
        
        // If language is provided, validate it
        if (language) {
          language = language.toString().toLowerCase();
          if (!validLanguages.includes(language)) {
            console.warn(`Warning: Row ${i + 1} has invalid language "${language}"`);
            language = null;
          }
        }
        
        // Handle date parsing and formatting
        let callDate = normalizedRow.call_date;
        // Only process the date if it exists
        if (callDate) {
          // Try to parse different date formats
          try {
            // If it's already a date object, format it
            if (callDate instanceof Date) {
              callDate = callDate.toISOString().split('T')[0];
            } 
            // Try to recognize various formats
            else if (typeof callDate === 'string') {
              // Check for common formats
              if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(callDate)) {
                // Handle MM/DD/YYYY, DD/MM/YYYY, etc.
                const parts = callDate.split(/[\/\-\.]/);
                // Assuming it's MM/DD/YYYY format but being flexible
                const parsedDate = new Date(`${parts[2].length === 2 ? '20' + parts[2] : parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
                if (!isNaN(parsedDate.getTime())) {
                  callDate = parsedDate.toISOString().split('T')[0];
                }
              } else {
                // Generic date parsing
                const parsedDate = new Date(callDate);
                if (!isNaN(parsedDate.getTime())) {
                  callDate = parsedDate.toISOString().split('T')[0];
                }
              }
            }
          } catch (e) {
            console.warn(`Warning: Could not parse date "${callDate}" in row ${i + 1}`);
            callDate = null;
          }
        }
        
        // Extract call metrics from the row for any additional fields
        const callMetrics: any = {};
        for (const key in normalizedRow) {
          if (key !== 'filename' && key !== 'originalFilename' && 
              key !== 'language' && key !== 'version' && key !== 'call_date') {
            callMetrics[key] = normalizedRow[key];
          }
        }
        
        // Create a validated metadata object
        const metadata: AudioFileMetadata = {
          filename: normalizedRow.filename.toString().trim(),
          originalFilename: normalizedRow.originalFilename || normalizedRow.filename,
          language: language as any,
          version: normalizedRow.version ? normalizedRow.version.toString() : null,
          call_date: callDate ? callDate.toString() : null,
          callMetrics
        };
        
        validRows.push(metadata);
      } catch (err) {
        // Collect errors but continue processing other rows
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Row ${i + 1}: ${errorMessage}`);
      }
    }
    
    // If we have no valid rows but have errors, report the errors
    if (validRows.length === 0 && errors.length > 0) {
      throw new Error(`Could not parse any valid rows: ${errors.join('; ')}`);
    }
    
    // If we have no valid rows and no errors, that's strange
    if (validRows.length === 0) {
      throw new Error('Excel file parsing resulted in no valid data');
    }
    
    // Log any errors as warnings
    if (errors.length > 0) {
      console.warn(`Warnings during Excel parsing: ${errors.join('; ')}`);
    }
    
    return validRows;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    
    // Enhance the error message based on the type of error
    if (error instanceof Error) {
      if (error.message.includes('Unsupported file')) {
        throw new Error('The file is not a valid Excel spreadsheet. Please use XLSX format.');
      } else if (error.message.includes('Invalid')) {
        throw new Error('The Excel file appears to be corrupted. Please download one of our templates and try again.');
      } else {
        throw error;
      }
    }
    
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
  const { processId, autoAssign } = req.body;
  
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
    
    // Get quality analysts for auto-assignment if requested
    let qualityAnalysts = [];
    if (autoAssign === 'true') {
      qualityAnalysts = await db
        .select()
        .from(users)
        .where(and(
          eq(users.organizationId, req.user.organizationId),
          eq(users.role, 'quality_analyst'),
          eq(users.active, true)
        ));
      
      if (qualityAnalysts.length === 0) {
        return res.status(400).json({ 
          message: 'Auto-assignment requested but no quality analysts found in the organization' 
        });
      }
    }
    
    // Store in database
    const importResults = [];
    const successfulImports = [];
    
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
        
        // Add to successful imports for auto-assignment
        successfulImports.push(audioFile);
      } catch (error) {
        console.error(`Error importing ${item.filename}:`, error);
        importResults.push({
          file: item.filename,
          status: 'error',
          error: error.message
        });
      }
    }
    
    // Auto-assign files to quality analysts if requested and successful imports exist
    let assignmentResults = [];
    if (autoAssign === 'true' && qualityAnalysts.length > 0 && successfulImports.length > 0) {
      try {
        // Distribute files evenly among quality analysts
        const assignmentMap = new Map();
        
        // Initialize assignment map for each quality analyst
        qualityAnalysts.forEach(qa => {
          assignmentMap.set(qa.id, []);
        });
        
        // Distribute files to quality analysts evenly
        successfulImports.forEach((file, index) => {
          const qaIndex = index % qualityAnalysts.length;
          const qaId = qualityAnalysts[qaIndex].id;
          assignmentMap.get(qaId).push(file.id);
        });
        
        // Create allocations in the database
        for (const [qaId, fileIds] of assignmentMap.entries()) {
          if (fileIds.length > 0) {
            for (const fileId of fileIds) {
              const [allocation] = await db
                .insert(audioFileAllocations)
                .values({
                  audioFileId: fileId,
                  qualityAnalystId: qaId,
                  status: 'allocated',
                  allocatedBy: req.user.id,
                  organizationId: req.user.organizationId
                })
                .returning();
                
              // Update audio file status to 'allocated'
              await db
                .update(audioFiles)
                .set({ status: 'allocated' })
                .where(eq(audioFiles.id, fileId));
                
              assignmentResults.push({
                fileId,
                qualityAnalystId: qaId,
                allocationId: allocation.id
              });
            }
          }
        }
      } catch (error) {
        console.error('Error auto-assigning files:', error);
      }
    }
    
    res.json({
      totalProcessed: enrichedItems.length,
      successCount: importResults.filter(r => r.status === 'success').length,
      errorCount: importResults.filter(r => r.status === 'error').length,
      results: importResults,
      autoAssigned: autoAssign === 'true' ? assignmentResults.length : 0,
      assignmentResults: autoAssign === 'true' ? assignmentResults : []
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
    const wb = xlsxUtils.book_new();
    
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
    const ws = xlsxUtils.json_to_sheet(sampleData);
    xlsxUtils.book_append_sheet(wb, ws, 'Audio Metadata');
    
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
    
    // Write to buffer with compression for better compatibility
    const buf = writeXLSX(wb, { 
      bookType: 'xlsx', 
      type: 'buffer',
      compression: true
    });
    
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

// Create a custom template Excel file with actual blob filenames
router.get('/azure-custom-template/:containerName', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  
  const { containerName } = req.params;
  
  try {
    // Fetch the actual blob names from the container
    const blobs = await azureService.listBlobs(containerName, '');
    
    // Create a new workbook
    const wb = xlsxUtils.book_new();
    
    if (!blobs || blobs.length === 0) {
      return res.status(404).json({ message: 'No blobs found in container' });
    }
    
    // Generate sample data using the actual blob filenames
    const sampleData = blobs.slice(0, 10).map(blob => ({
      filename: blob.name,
      originalFilename: `Customer Call - ${new Date(blob.properties.lastModified).toLocaleDateString()}.${blob.name.split('.').pop()}`,
      language: 'english',
      version: '1.0',
      call_date: new Date(blob.properties.lastModified).toISOString().split('T')[0],
    }));
    
    // Create worksheet and add to workbook
    const ws = xlsxUtils.json_to_sheet(sampleData);
    xlsxUtils.book_append_sheet(wb, ws, 'Audio Metadata');
    
    // Add column width specifications for better readability
    const wscols = [
      { wch: 70 }, // filename (extra wide for the long filenames)
      { wch: 40 }, // originalFilename
      { wch: 10 }, // language
      { wch: 10 }, // version
      { wch: 12 }, // call_date
    ];
    ws['!cols'] = wscols;
    
    // Write to buffer with compression for better compatibility
    const buf = writeXLSX(wb, { 
      bookType: 'xlsx', 
      type: 'buffer',
      compression: true
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${containerName}-audio-template.xlsx`);
    
    // Send the file
    res.send(buf);
  } catch (error) {
    console.error('Error creating custom metadata template:', error);
    res.status(500).json({ message: 'Failed to generate custom template' });
  }
});

// Create a minimal template Excel file
router.get('/azure-minimal-template', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    // Create a new workbook
    const wb = xlsxUtils.book_new();
    
    // Sample data with only the required fields
    const sampleData = [
      {
        filename: 'agent-261-17027502083-4769-SIL_Inbound-2023_12_15_13_45_05-919880769769.wav',
        language: 'english',
        version: '1.0',
        call_date: '2023-12-15'
      },
      {
        filename: 'agent-261-17027502084-1546-SIL_Inbound-2023_12_15_10_35_33-919700514723.wav',
        language: 'spanish',
        version: '1.0',
        call_date: '2023-12-15'
      }
    ];
    
    // Create worksheet and add to workbook
    const ws = xlsxUtils.json_to_sheet(sampleData);
    xlsxUtils.book_append_sheet(wb, ws, 'Audio Metadata');
    
    // Add column width specifications for better readability
    const wscols = [
      { wch: 70 }, // filename (extra wide for the long filenames)
      { wch: 10 }, // language
      { wch: 10 }, // version
      { wch: 12 }  // call_date
    ];
    ws['!cols'] = wscols;
    
    // Write to buffer with compression for better compatibility
    const buf = writeXLSX(wb, { 
      bookType: 'xlsx', 
      type: 'buffer',
      compression: true
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=minimal-audio-template.xlsx');
    
    // Send the file
    res.send(buf);
  } catch (error) {
    console.error('Error creating minimal metadata template:', error);
    res.status(500).json({ message: 'Failed to generate minimal template' });
  }
});

// Create an ultra-simple template with just one file from the container
router.get('/azure-simple-template/:containerName', async (req, res) => {
  // Skip user authentication check for template downloads to make it more accessible
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  
  const { containerName } = req.params;
  
  try {
    console.log(`Creating simple template for container: ${containerName}`);
    
    // Fetch the actual blob names from the container
    const blobs = await azureService.listBlobs(containerName, '');
    
    if (!blobs || blobs.length === 0) {
      console.log('No blobs found in container:', containerName);
      return res.status(404).json({ message: 'No blobs found in container' });
    }
    
    console.log(`Found ${blobs.length} blobs, using first one as template`);
    
    // Use just the first blob as a template
    const firstBlob = blobs[0];
    
    // Create a very basic Excel file with a single row
    const wb = xlsxUtils.book_new();
    const ws = xlsxUtils.aoa_to_sheet([
      ['filename', 'language', 'version', 'call_date'],
      [firstBlob.name, 'english', '1.0', new Date().toISOString().split('T')[0]]
    ]);
    
    // Add column width specifications for better readability
    ws['!cols'] = [
      { wch: 70 }, // filename (extra wide for the long filenames)
      { wch: 10 }, // language
      { wch: 10 }, // version
      { wch: 12 }  // call_date
    ];
    
    xlsxUtils.book_append_sheet(wb, ws, 'Simple Template');
    
    // Write directly to a buffer with absolute minimal options
    const buf = writeXLSX(wb, { type: 'buffer' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${containerName}-simple-template.xlsx`);
    
    console.log('Sending ultra-simple template file');
    
    // Send the file
    res.send(buf);
  } catch (error) {
    console.error('Error creating ultra-simple template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Failed to generate simple template', error: errorMessage });
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

// Direct download route for Excel template without Azure dependency
router.get('/download-audio-template', (req, res) => {
  try {
    console.log('Direct template download requested');
    
    // Create a very simple Excel file with sample data
    const wb = xlsxUtils.book_new();
    
    // Create a worksheet with headers and one example row
    const ws = xlsxUtils.aoa_to_sheet([
      ['filename', 'language', 'version', 'call_date', 'duration', 'agent_id', 'customer_id', 'call_reason', 'disposition'],
      ['call-recording-20250403-123456.mp3', 'english', '1.0', '2025-04-03', '360', 'A12345', 'C67890', 'Support', 'Resolved']
    ]);
    
    // Add column width specifications for better readability
    ws['!cols'] = [
      { wch: 45 }, // filename
      { wch: 12 }, // language
      { wch: 10 }, // version
      { wch: 12 }, // call_date
      { wch: 10 }, // duration
      { wch: 12 }, // agent_id
      { wch: 12 }, // customer_id
      { wch: 15 }, // call_reason
      { wch: 15 }  // disposition
    ];
    
    // Add the worksheet to the workbook
    xlsxUtils.book_append_sheet(wb, ws, 'Audio Files');
    
    // Write directly to a buffer
    const buf = writeXLSX(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Set response headers for Excel file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=audio-metadata-template.xlsx');
    res.setHeader('Cache-Control', 'no-cache');
    
    console.log('Sending audio metadata template file buffer with length:', buf.length);
    
    // Send the file buffer
    res.send(buf);
  } catch (error) {
    console.error('Error generating direct template download:', error);
    res.status(500).json({ 
      message: 'Failed to generate template file', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Integrated workflow for folder selection, metadata upload, and allocation
router.post('/azure-folder-batch-process', excelUpload.single('metadataFile'), async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  if (!req.file) return res.status(400).json({ message: 'No metadata file uploaded' });
  
  const { containerName, folderPath, qualityAnalysts, distributionMethod = 'random', dueDate, name } = req.body;
  
  if (!containerName) {
    return res.status(400).json({ message: 'Container name is required' });
  }
  
  if (!folderPath) {
    return res.status(400).json({ message: 'Folder path is required' });
  }
  
  if (!qualityAnalysts || !Array.isArray(qualityAnalysts) || qualityAnalysts.length === 0) {
    return res.status(400).json({ message: 'Quality analyst assignments are required' });
  }
  
  try {
    // Verify container exists
    const containerClient = azureService.getContainerClient(containerName);
    const containerExists = await containerClient.exists();
    
    if (!containerExists) {
      return res.status(404).json({ message: `Container ${containerName} does not exist` });
    }
    
    // Parse metadata from the uploaded Excel file
    const metadataItems = await parseExcelFile(req.file.path);
    
    // Match with actual files in Azure and get enhanced metadata
    const enrichedItems = await azureService.matchAudioFilesWithMetadata(containerName, metadataItems);
    
    // Filter enriched items to only include files in the selected folder
    const folderFilteredItems = enrichedItems.filter(item => {
      // Handle files that might be directly in the folder or in subfolders
      return item.filename.startsWith(folderPath === '/' ? '' : folderPath);
    });
    
    if (folderFilteredItems.length === 0) {
      return res.status(400).json({ 
        message: 'No matching audio files found in the selected folder with the provided metadata' 
      });
    }
    
    // Store in database
    const importResults = [];
    const successfulImports = [];
    let allocations = [];
    let batchAllocationId = null;
    
    // Transaction to ensure all operations succeed or fail together
    await db.transaction(async (tx) => {
      // First, create batch allocation record if name is provided
      if (name) {
        const [batchAllocation] = await tx
          .insert(audioFileBatchAllocations)
          .values({
            name,
            organizationId: req.user.organizationId,
            allocatedBy: req.user.id,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            status: 'allocated',
          })
          .returning();
          
        batchAllocationId = batchAllocation.id;
      }
      
      // Import all files from the folder
      for (const item of folderFilteredItems) {
        try {
          // Generate a SAS URL for the file
          const sasUrl = await azureService.generateBlobSasUrl(
            containerName,
            item.filename,
            1440 // 24 hours
          );
          
          // Create the database record
          const [audioFile] = await tx
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
              status: 'pending', // Initially pending, will be updated to allocated
              uploadedBy: req.user.id,
              processId: 1, // Default process ID
              organizationId: req.user.organizationId
            })
            .returning();
          
          successfulImports.push(audioFile);
          importResults.push({
            file: item.filename,
            status: 'success',
            id: audioFile.id
          });
        } catch (error) {
          console.error(`Error importing file ${item.filename}:`, error);
          importResults.push({
            file: item.filename,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      // Parse quality analysts data
      const qaAssignments = qualityAnalysts.map(qa => {
        // Handle both string and object format
        if (typeof qa === 'string') {
          const [id, count] = qa.split(':');
          return { id: parseInt(id), count: parseInt(count) };
        }
        return { id: parseInt(qa.id), count: parseInt(qa.count) };
      }).filter(qa => !isNaN(qa.id) && !isNaN(qa.count) && qa.count > 0);
      
      if (qaAssignments.length === 0) {
        throw new Error('No valid quality analyst assignments provided');
      }
      
      // Create allocations based on distribution method
      allocations = [];
      
      if (distributionMethod === 'agent-balanced') {
        // Group files by agent ID
        const filesByAgent = new Map<string, typeof successfulImports[0][]>();
        
        // Process each file and group by agent
        for (const file of successfulImports) {
          // Extract agentId from callMetrics if available
          const agentId = file.callMetrics?.agentId || 'unknown';
          
          if (!filesByAgent.has(agentId)) {
            filesByAgent.set(agentId, []);
          }
          
          filesByAgent.get(agentId)!.push(file);
        }
        
        // Calculate total allocation count
        const totalQACount = qaAssignments.reduce((sum, qa) => sum + qa.count, 0);
        
        // Sort QAs by count (descending) to prioritize those who should receive more files
        qaAssignments.sort((a, b) => b.count - a.count);
        
        // Distribute files from each agent proportionally to QAs
        for (const [agentId, agentFiles] of filesByAgent.entries()) {
          let remainingAgentFiles = agentFiles.length;
          let qaIndex = 0;
          
          while (remainingAgentFiles > 0) {
            const qa = qaAssignments[qaIndex % qaAssignments.length];
            // Calculate how many files this QA should get from this agent
            const targetProportion = qa.count / totalQACount;
            const targetCount = Math.ceil(agentFiles.length * targetProportion);
            
            // Only allocate what's remaining for this QA (max they can take)
            const actualCount = Math.min(
              remainingAgentFiles, 
              qaIndex === qaAssignments.length - 1 ? remainingAgentFiles : targetCount
            );
            
            // Create allocations for these files
            for (let i = 0; i < actualCount; i++) {
              const fileIndex = agentFiles.length - remainingAgentFiles;
              const file = agentFiles[fileIndex];
              
              try {
                const [allocation] = await tx
                  .insert(audioFileAllocations)
                  .values({
                    audioFileId: file.id,
                    qualityAnalystId: qa.id,
                    dueDate: dueDate ? new Date(dueDate) : undefined,
                    status: 'allocated',
                    allocatedBy: req.user.id,
                    organizationId: req.user.organizationId,
                    batchAllocationId
                  })
                  .returning();
                
                // Update audio file status
                await tx
                  .update(audioFiles)
                  .set({
                    status: 'allocated',
                    updatedAt: new Date()
                  })
                  .where(eq(audioFiles.id, file.id));
                
                allocations.push(allocation);
                remainingAgentFiles--;
              } catch (error) {
                console.error(`Error allocating file ${file.id}:`, error);
              }
            }
            
            qaIndex++;
          }
        }
      } else {
        // Random distribution - evenly distribute files among QAs based on their count
        const totalCount = qaAssignments.reduce((sum, qa) => sum + qa.count, 0);
        const filesToAssign = [...successfulImports];
        
        if (totalCount === 0) {
          throw new Error('Total allocation count must be greater than 0');
        }
        
        // Distribute files proportionally
        for (const qa of qaAssignments) {
          // Calculate how many files this QA should get
          const fileCount = Math.min(
            Math.round((qa.count / totalCount) * filesToAssign.length),
            filesToAssign.length
          );
          
          for (let i = 0; i < fileCount && filesToAssign.length > 0; i++) {
            // Pick a random file from the remaining files
            const randomIndex = Math.floor(Math.random() * filesToAssign.length);
            const file = filesToAssign.splice(randomIndex, 1)[0];
            
            try {
              const [allocation] = await tx
                .insert(audioFileAllocations)
                .values({
                  audioFileId: file.id,
                  qualityAnalystId: qa.id,
                  dueDate: dueDate ? new Date(dueDate) : undefined,
                  status: 'allocated',
                  allocatedBy: req.user.id,
                  organizationId: req.user.organizationId,
                  batchAllocationId
                })
                .returning();
              
              // Update audio file status
              await tx
                .update(audioFiles)
                .set({
                  status: 'allocated',
                  updatedAt: new Date()
                })
                .where(eq(audioFiles.id, file.id));
              
              allocations.push(allocation);
            } catch (error) {
              console.error(`Error allocating file ${file.id}:`, error);
            }
          }
        }
        
        // Assign any remaining files
        while (filesToAssign.length > 0) {
          const file = filesToAssign.pop();
          if (!file) break;
          
          // Find QA with lowest allocation count
          qaAssignments.sort((a, b) => {
            const aCount = allocations.filter(alloc => alloc.qualityAnalystId === a.id).length;
            const bCount = allocations.filter(alloc => alloc.qualityAnalystId === b.id).length;
            return aCount - bCount;
          });
          
          const qa = qaAssignments[0];
          
          try {
            const [allocation] = await tx
              .insert(audioFileAllocations)
              .values({
                audioFileId: file.id,
                qualityAnalystId: qa.id,
                dueDate: dueDate ? new Date(dueDate) : undefined,
                status: 'allocated',
                allocatedBy: req.user.id,
                organizationId: req.user.organizationId,
                batchAllocationId
              })
              .returning();
            
            // Update audio file status
            await tx
              .update(audioFiles)
              .set({
                status: 'allocated',
                updatedAt: new Date()
              })
              .where(eq(audioFiles.id, file.id));
            
            allocations.push(allocation);
          } catch (error) {
            console.error(`Error allocating file ${file.id}:`, error);
          }
        }
      }
    });
    
    res.json({
      totalProcessed: folderFilteredItems.length,
      successCount: importResults.filter(r => r.status === 'success').length,
      errorCount: importResults.filter(r => r.status === 'error').length,
      results: importResults,
      allocationsCreated: allocations.length,
      batchAllocationId
    });
  } catch (error) {
    console.error('Error in integrated folder batch process:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error occurred' });
  }
});

export default router;