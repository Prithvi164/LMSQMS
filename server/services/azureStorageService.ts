import { BlobServiceClient, StorageSharedKeyCredential, ContainerClient, BlobItem, BlobSASPermissions, generateBlobSASQueryParameters, SASProtocol } from '@azure/storage-blob';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import * as mm from 'music-metadata';

// Define the shape of metadata for audio files
export interface AudioFileMetadata {
  filename: string;      // Name of the file in Azure
  originalFilename?: string; // Original name if different
  language: string;      // Language of the audio
  version: string;       // Version of the recording
  call_date: string;     // Date of the call (YYYY-MM-DD)
  callMetrics: {
    // Standard fields
    callDate: string;    // Call date in readable format (YYYY-MM-DD)
    callId: string;      // Unique call identifier
    callType: string;    // Type of call (e.g., inbound, outbound)
    agentId?: string;    // Agent identifier
    customerSatisfaction?: number; // Customer satisfaction score
    handleTime?: number; // Handle time in seconds
    
    // Required fields from the metadata requirements
    auditRole: string;   // Auto-filled based on logged-in auditor (Quality Analyst)
    OLMSID: string;      // Unique ID for the agent/system
    Name: string;        // Name of the agent being evaluated
    PBXID: string;       // Unique telephony ID
    partnerName: string; // Partner/Client the call belongs to (CloudPoint Technologies)
    customerMobile: string; // For call tracking (Customer Mobile #)
    callDuration: string; // Duration of the call in seconds
    subType: string;     // Further classification (Customer Service, Technical Support, etc.)
    subSubType: string;  // Further granularity (Billing Inquiry, Hardware Issue, etc.)
    VOC: string;         // Captures Voice of Customer (Positive, Negative, Neutral)
    languageOfCall: string; // Language spoken during call (matching standard language codes)
    userRole: string;    // Based on logged-in user's profile (Agent, Senior Agent)
    advisorCategory: string; // E.g., Challenger, Performer
    businessSegment: string; // E.g., Care, Tech Support, Sales
    LOB: string;         // Line of Business (e.g., Prepaid, Postpaid, Enterprise)
    formName: string;    // Select form for evaluation (Evaluation Form 1)
    
    [key: string]: any;  // For additional metrics
  };
  duration?: number;     // Will be populated from audio analysis
  fileSize?: number;     // Will be populated from blob properties
}

export class AzureStorageService {
  public blobServiceClient: BlobServiceClient;
  private accountName: string;
  private accountKey: string;

  constructor(
    accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME,
    accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY
  ) {
    this.accountName = accountName || '';
    this.accountKey = accountKey || '';

    // Check if credentials are available
    if (!this.accountName || !this.accountKey) {
      console.error('Azure Storage credentials not provided. Service will not function properly.');
      // Initialize with placeholder to prevent errors, but functionality will be limited
      this.blobServiceClient = BlobServiceClient.fromConnectionString('DefaultEndpointsProtocol=https;AccountName=placeholder;AccountKey=placeholder;EndpointSuffix=core.windows.net');
      return;
    }

    // Create a SharedKeyCredential object
    const sharedKeyCredential = new StorageSharedKeyCredential(
      this.accountName,
      this.accountKey
    );

    // Create the BlobServiceClient using the credential
    this.blobServiceClient = new BlobServiceClient(
      `https://${this.accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );
  }

  /**
   * Get a container client for the specified container
   */
  getContainerClient(containerName: string): ContainerClient {
    return this.blobServiceClient.getContainerClient(containerName);
  }

  /**
   * List all blobs in a container
   */
  async listBlobs(containerName: string, folderPath: string = ''): Promise<BlobItem[]> {
    console.log(`Azure Service: Listing blobs in container "${containerName}" with folderPath "${folderPath}"`);
    
    try {
      const containerClient = this.getContainerClient(containerName);
      
      // Check if the container exists
      const containerExists = await containerClient.exists();
      if (!containerExists) {
        console.log(`Container "${containerName}" does not exist`);
        return [];
      }
      
      const blobs: BlobItem[] = [];

      // Create an async iterator with the prefix (folder path)
      const options = folderPath ? { prefix: folderPath } : undefined;
      console.log(`Iterating through blobs in container "${containerName}" with options:`, options);
      const asyncIterator = containerClient.listBlobsFlat(options);
      let blobItem = await asyncIterator.next();

      // Iterate through all blobs
      while (!blobItem.done) {
        blobs.push(blobItem.value);
        blobItem = await asyncIterator.next();
      }

      console.log(`Found ${blobs.length} blobs in container "${containerName}" with folder path "${folderPath}"`);
      return blobs;
    } catch (error) {
      console.error(`Error listing blobs in container "${containerName}":`, error);
      throw error;
    }
  }
  
  /**
   * List folders/virtual directories in a container
   * Azure Blob Storage doesn't have a formal folder structure, but we can emulate it using prefixes
   */
  async listFolders(containerName: string): Promise<string[]> {
    console.log(`Azure Service: Listing folders in container "${containerName}"`);
    
    try {
      const containerClient = this.getContainerClient(containerName);
      
      // Check if the container exists
      const containerExists = await containerClient.exists();
      if (!containerExists) {
        console.log(`Container "${containerName}" does not exist`);
        return [];
      }
      
      // Folders in Azure Blob are simulated by using delimiters
      const blobs: BlobItem[] = [];
      const asyncIterator = containerClient.listBlobsFlat();
      let blobItem = await asyncIterator.next();
      
      while (!blobItem.done) {
        blobs.push(blobItem.value);
        blobItem = await asyncIterator.next();
      }
      
      // Extract folder names from blob paths (everything before the first slash)
      const folders = new Set<string>();
      
      blobs.forEach(blob => {
        const name = blob.name;
        const slashIndex = name.indexOf('/');
        
        if (slashIndex > 0) {
          // This is a blob in a virtual folder
          const folderName = name.substring(0, slashIndex);
          folders.add(folderName);
        }
      });
      
      // Convert Set to array and sort
      const folderList = Array.from(folders).sort((a, b) => {
        // Try to sort by date if folder names are dates
        const dateA = new Date(a);
        const dateB = new Date(b);
        
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          // Both are valid dates, sort most recent first
          return dateB.getTime() - dateA.getTime();
        }
        
        // Fall back to alphabetical sort if not dates
        return a.localeCompare(b);
      });
      
      console.log(`Found ${folderList.length} folders in container "${containerName}"`);
      return folderList;
    } catch (error) {
      console.error(`Error listing folders in container "${containerName}":`, error);
      throw error;
    }
  }

  /**
   * Generate a SAS URL for a blob to allow direct access
   * SAS = Shared Access Signature
   */
  async generateBlobSasUrl(
    containerName: string,
    blobName: string,
    expiryMinutes: number = 60, // Default to 1 hour
    contentType?: string // Optional content type parameter
  ): Promise<string> {
    try {
      console.log(`Generating SAS URL for container: ${containerName}, blob: ${blobName}, expiry: ${expiryMinutes} minutes, contentType: ${contentType || 'not specified'}`);
      
      // Verify all inputs are valid
      if (!containerName || !blobName) {
        console.error('Invalid container or blob name:', { containerName, blobName });
        throw new Error('Container name and blob name are required');
      }
      
      const containerClient = this.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobName);
      
      console.log(`Blob URL before SAS token: ${blobClient.url}`);

      if (!this.accountName || !this.accountKey) {
        console.error('Azure Storage credentials not provided. Cannot generate SAS URL.');
        throw new Error('Azure Storage credentials not properly configured');
      }

      // Calculate expiry date
      const expiryTime = new Date();
      expiryTime.setMinutes(expiryTime.getMinutes() + expiryMinutes);
      
      console.log(`SAS token will expire at: ${expiryTime.toISOString()}`);

      // Determine appropriate content type based on file extension if not provided
      let detectedContentType = contentType || "audio/mpeg"; // Default to audio/mpeg
      
      if (!contentType) {
        const fileExtension = blobName.split('.').pop()?.toLowerCase();
        if (fileExtension) {
          switch (fileExtension) {
            case 'mp3':
              detectedContentType = 'audio/mpeg';
              break;
            case 'wav':
              detectedContentType = 'audio/wav';
              break;
            case 'ogg':
              detectedContentType = 'audio/ogg';
              break;
            case 'm4a':
              detectedContentType = 'audio/mp4';
              break;
            case 'aac':
              detectedContentType = 'audio/aac';
              break;
            case 'flac':
              detectedContentType = 'audio/flac';
              break;
            case 'webm':
              detectedContentType = 'audio/webm';
              break;
          }
        }
      }
      
      console.log(`Using content type: ${detectedContentType} for blob: ${blobName}`);

      // Set permissions for the SAS URL with more explicit options
      const sasOptions = {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse('r'), // Read only access
        expiresOn: expiryTime,
        protocol: SASProtocol.Https, // Force HTTPS for security
        startsOn: new Date(), // Start time is now
        contentDisposition: "inline", // Make it playable in browser
        contentType: detectedContentType, // Use the detected or provided content type
      };

      // Create a shared key credential
      const sharedKeyCredential = new StorageSharedKeyCredential(
        this.accountName,
        this.accountKey
      );

      // Generate SAS query parameters using the shared key credential
      const sasToken = generateBlobSASQueryParameters(
        sasOptions,
        sharedKeyCredential
      ).toString();
      
      // Construct the SAS URL
      const sasUrl = `${blobClient.url}?${sasToken}`;
      
      // Log a truncated version of the URL for debugging (hide most of the token)
      const truncatedUrl = sasUrl.substring(0, sasUrl.indexOf('sig=') + 10) + '...';
      console.log(`Generated SAS URL: ${truncatedUrl}`);
      
      return sasUrl;
    } catch (error) {
      console.error('Error generating SAS URL:', error);
      if (error instanceof Error) {
        throw new Error(`SAS URL generation failed: ${error.message}`);
      }
      throw new Error('SAS URL generation failed for unknown reason');
    }
  }

  /**
   * Get audio file details from Azure blob
   */
  async getAudioFileDetails(containerName: string, blobName: string): Promise<{
    duration: number;
    fileSize: number;
  }> {
    const containerClient = this.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    const properties = await blobClient.getProperties();
    
    // Download the blob to extract audio metadata
    const downloadResponse = await blobClient.download(0);
    const readableStream = downloadResponse.readableStreamBody as Readable;
    
    // Parse audio metadata
    let duration = 0;
    try {
      // Use parseBuffer for Node.js compatibility
      const chunks: Uint8Array[] = [];
      for await (const chunk of readableStream) {
        chunks.push(chunk as Uint8Array);
      }
      const buffer = Buffer.concat(chunks);
      
      const metadata = await mm.parseBuffer(buffer, {
        mimeType: properties.contentType || 'audio/mpeg',
        size: properties.contentLength
      });
      
      duration = metadata.format.duration || 0;
    } catch (error) {
      console.error(`Error parsing audio metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return {
      duration,
      fileSize: properties.contentLength || 0
    };
  }

  /**
   * Check if a blob exists in the container
   */
  async blobExists(containerName: string, blobName: string): Promise<boolean> {
    const containerClient = this.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    
    try {
      await blobClient.getProperties();
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get a blob client and basic information about a blob
   */
  async getBlobClient(containerName: string, blobName: string): Promise<{ name: string, url: string } | null> {
    try {
      const containerClient = this.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobName);
      
      // Check if the blob exists by trying to get its properties
      await blobClient.getProperties();
      
      // Return basic information about the blob
      return {
        name: blobName,
        url: blobClient.url
      };
    } catch (error) {
      console.error(`Error getting blob client for ${blobName}:`, error);
      return null;
    }
  }
  
  /**
   * List all containers in the storage account
   */
  async listContainers(): Promise<string[]> {
    try {
      console.log('Listing all containers in the storage account');
      
      // Get a reference to all containers
      const containerIterator = this.blobServiceClient.listContainers();
      
      // Extract container names
      const containers: string[] = [];
      for await (const container of containerIterator) {
        containers.push(container.name);
      }
      
      console.log(`Found ${containers.length} containers in the storage account`);
      return containers;
    } catch (error) {
      console.error('Error listing containers:', error);
      throw error;
    }
  }
  
  /**
   * Get properties of a specific blob
   */
  async getBlobProperties(containerName: string, blobName: string): Promise<any> {
    try {
      console.log(`Getting properties for blob "${blobName}" in container "${containerName}"`);
      
      // Get a reference to the blob
      const containerClient = this.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobName);
      
      // Get the blob's properties
      const properties = await blobClient.getProperties();
      
      // Return the properties and URL
      return {
        url: blobClient.url,
        name: blobName,
        properties: {
          contentType: properties.contentType,
          contentLength: properties.contentLength,
          createdOn: properties.createdOn,
          lastModified: properties.lastModified
        }
      };
    } catch (error) {
      console.error(`Error getting properties for blob "${blobName}" in container "${containerName}":`, error);
      return null;
    }
  }

  /**
   * Download an Excel file from Azure blob storage and parse its contents
   */
  async parseMetadataExcel(containerName: string, excelBlobName: string): Promise<any[]> {
    const containerClient = this.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(excelBlobName);
    
    try {
      // Download the Excel file
      const downloadResponse = await blobClient.download(0);
      const chunks: Uint8Array[] = [];
      
      // Read the data
      const readableStream = downloadResponse.readableStreamBody;
      if (!readableStream) {
        throw new Error('Could not read Excel file stream');
      }
      
      // Convert stream to buffer
      for await (const chunk of readableStream) {
        chunks.push(chunk as Uint8Array);
      }
      
      const buffer = Buffer.concat(chunks);
      
      // Parse Excel data
      const workbook = XLSX.read(buffer as Buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet);
      
      // Transform Excel data to our metadata format
      return (rows as any[]).map((row: Record<string, any>): any => {
        // Extract base metadata
        const baseMetadata = {
          filename: row.filename || row.Filename || row.FileName || row.file_name || '',
          originalFilename: row.originalFilename || row.OriginalFilename || row.original_filename || row.filename || row.Filename || '',
          language: (row.language || row.Language || 'english').toLowerCase(),
          version: row.version || row.Version || '1.0',
          call_date: row.call_date || row.CallDate || row.Date || new Date().toISOString().split('T')[0],
        };
        
        // Extract callMetrics with all the required properties
        const callMetrics: Record<string, any> = {
          // Standard required fields
          callDate: row.callDate || row.CallDate || new Date().toISOString().split('T')[0],
          callId: row.callId || row.CallId || row.Call_ID || 'unknown',
          callType: row.callType || row.CallType || row.Type || 'unknown',
          
          // Optional fields with defaults
          agentId: row.agentId || row.AgentId || row.Agent_ID || '',
          customerSatisfaction: parseFloat(row.csat || row.CSAT || row.satisfaction || '0') || 0,
          handleTime: parseInt(row.handleTime || row.HandleTime || row.handle_time || '0') || 0,
          
          // New fields from requirements
          auditRole: row.auditRole || row.AuditRole || '',
          OLMSID: row.OLMSID || row.olmsid || row.OlmsId || '',
          Name: row.Name || row.name || '',
          PBXID: row.PBXID || row.pbxid || row.PbxId || '',
          partnerName: row.partnerName || row.PartnerName || row.Partner_Name || '',
          customerMobile: row.customerMobile || row.CustomerMobile || row.customer_mobile || '',
          subType: row.subType || row.SubType || row.sub_type || '',
          subSubType: row.subSubType || row.SubSubType || row.sub_sub_type || '',
          VOC: row.VOC || row.voc || row.Voc || '',
          userRole: row.userRole || row.UserRole || row.user_role || '',
          advisorCategory: row.advisorCategory || row.AdvisorCategory || row.advisor_category || '',
          businessSegment: row.businessSegment || row.BusinessSegment || row.business_segment || '',
          LOB: row.LOB || row.lob || row.LineOfBusiness || '',
          formName: row.formName || row.FormName || row.form_name || '',
          
          // New fields from updated requirements
          callDuration: row.callDuration || row.CallDuration || row.call_duration || '',
          languageOfCall: row.languageOfCall || row.LanguageOfCall || row.language_of_call || row.language || ''
        };
        
        // Add any additional metrics that might be in the Excel
        Object.keys(row).forEach(key => {
          const lowerKey = key.toLowerCase();
          // Skip keys that we've already processed
          if (!['filename', 'originalfilename', 'language', 'version', 'call_date',
               'calldate', 'callid', 'calltype', 'agentid', 'csat',
               'satisfaction', 'handletime', 'auditrole', 'olmsid', 'name',
               'pbxid', 'partnername', 'customermobile', 'subtype', 'subsubtype',
               'voc', 'userrole', 'advisorcategory', 'businesssegment', 'lob',
               'formname', 'callduration', 'languageofcall'].includes(lowerKey)) {
            callMetrics[key] = row[key];
          }
        });
        
        return {
          ...baseMetadata,
          callMetrics
        };
      }).filter((item: any) => item.filename); // Filter out entries without filenames
    } catch (error) {
      console.error(`Error parsing Excel metadata from Azure: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Match audio files from Azure with metadata from Excel
   */
  async matchAudioFilesWithMetadata(
    containerName: string,
    metadataItems: any[]
  ): Promise<any[]> {
    const blobs = await this.listBlobs(containerName);
    const blobMap = new Map<string, BlobItem>();
    
    // Create a map of blob names for faster lookup
    blobs.forEach(blob => {
      blobMap.set(blob.name, blob);
    });
    
    // For each metadata item, find matching blob and enhance with audio details
    const enhancedMetadata: any[] = [];
    
    for (const metadata of metadataItems) {
      // Skip items without filename
      if (!metadata.filename) continue;
      
      const blob = blobMap.get(metadata.filename);
      
      if (blob) {
        try {
          // Get audio details (duration, file size)
          const audioDetails = await this.getAudioFileDetails(containerName, metadata.filename);
          
          // Enhance metadata with audio details
          enhancedMetadata.push({
            ...metadata,
            fileSize: audioDetails.fileSize,
            duration: audioDetails.duration
          });
        } catch (error) {
          console.error(`Error processing audio file ${metadata.filename}: ${error}`);
          // Still include the metadata even if we couldn't get audio details
          enhancedMetadata.push(metadata);
        }
      } else {
        console.warn(`Metadata references file ${metadata.filename} that doesn't exist in container ${containerName}`);
      }
    }
    
    return enhancedMetadata;
  }
}

export const initAzureStorageService = (): AzureStorageService | null => {
  try {
    // Check for required environment variables
    if (!process.env.AZURE_STORAGE_ACCOUNT_NAME || !process.env.AZURE_STORAGE_ACCOUNT_KEY) {
      console.error('Missing Azure Storage credentials. Set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY environment variables.');
      return null;
    }

    const service = new AzureStorageService(
      process.env.AZURE_STORAGE_ACCOUNT_NAME,
      process.env.AZURE_STORAGE_ACCOUNT_KEY
    );

    return service;
  } catch (error) {
    console.error('Failed to initialize Azure Storage Service:', error);
    return null;
  }
};