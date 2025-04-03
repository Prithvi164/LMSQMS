import { BlobServiceClient, StorageSharedKeyCredential, ContainerClient, BlobItem, BlobSASPermissions, generateBlobSASQueryParameters } from '@azure/storage-blob';
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
    callDate: string;    // Call date in readable format
    callId: string;      // Unique call identifier
    callType: string;    // Type of call (e.g., inbound, outbound)
    agentId?: string;    // Agent identifier
    customerSatisfaction?: number; // Customer satisfaction score
    handleTime?: number; // Handle time in seconds
    [key: string]: any;  // Additional metrics
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
      console.warn('Azure Storage credentials not provided. Azure-related features will not be available.');
      // Initialize with placeholder to prevent errors, but functionality will be limited
      this.blobServiceClient = BlobServiceClient.fromConnectionString('DefaultEndpointsProtocol=https;AccountName=placeholder;AccountKey=placeholder;EndpointSuffix=core.windows.net');
      return;
    }

    try {
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
    } catch (error) {
      console.error('Error connecting to Azure Storage:', error);
      // Initialize with placeholder to prevent errors, but functionality will be limited
      this.blobServiceClient = BlobServiceClient.fromConnectionString('DefaultEndpointsProtocol=https;AccountName=placeholder;AccountKey=placeholder;EndpointSuffix=core.windows.net');
    }
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
    expiryMinutes: number = 60 // Default to 1 hour
  ): Promise<string> {
    const containerClient = this.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    if (!this.accountName || !this.accountKey) {
      console.error('Azure Storage credentials not provided. Cannot generate SAS URL.');
      return '';
    }

    // Calculate expiry date
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + expiryMinutes);

    // Set permissions for the SAS URL
    const sasOptions = {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'), // Read only
      expiresOn: expiryTime,
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
    return `${blobClient.url}?${sasToken}`;
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
      const chunks: Buffer[] = [];
      for await (const chunk of readableStream) {
        chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);
      
      const metadata = await mm.parseBuffer(buffer, {
        mimeType: properties.contentType || 'audio/mpeg',
        size: properties.contentLength
      });
      
      duration = metadata.format.duration || 0;
    } catch (error) {
      console.error(`Error parsing audio metadata: ${error}`);
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
   * Download an Excel file from Azure blob storage and parse its contents
   */
  async parseMetadataExcel(containerName: string, excelBlobName: string): Promise<AudioFileMetadata[]> {
    const containerClient = this.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(excelBlobName);
    
    try {
      // Download the Excel file
      const downloadResponse = await blobClient.download(0);
      const chunks: Buffer[] = [];
      
      // Read the data
      const readableStream = downloadResponse.readableStreamBody;
      if (!readableStream) {
        throw new Error('Could not read Excel file stream');
      }
      
      // Convert stream to buffer
      for await (const chunk of readableStream) {
        chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
      }
      
      const buffer = Buffer.concat(chunks);
      
      // Parse Excel data
      const workbook = XLSX.read(buffer, {type: 'buffer'});
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet);
      
      // Transform Excel data to our metadata format
      return rows.map((row: any) => {
        return {
          filename: row.filename || row.Filename || row.FileName || row.file_name || '',
          originalFilename: row.originalFilename || row.OriginalFilename || row.original_filename || row.filename || row.Filename || '',
          language: (row.language || row.Language || 'english').toLowerCase(),
          version: row.version || row.Version || '1.0',
          call_date: row.call_date || row.CallDate || row.Date || new Date().toISOString().split('T')[0],
          callMetrics: {
            callDate: row.callDate || row.CallDate || new Date().toISOString().split('T')[0],
            callId: row.callId || row.CallId || row.Call_ID || 'unknown',
            callType: row.callType || row.CallType || row.Type || 'unknown',
            agentId: row.agentId || row.AgentId || row.Agent_ID || '',
            customerSatisfaction: parseFloat(row.csat || row.CSAT || row.satisfaction || '0') || 0,
            handleTime: parseInt(row.handleTime || row.HandleTime || row.handle_time || '0') || 0,
            // Add any additional metrics that might be in the Excel
            ...Object.keys(row).reduce((acc: Record<string, any>, key: string) => {
              if (!['filename', 'originalFilename', 'language', 'version', 'call_date', 
                   'callDate', 'callId', 'callType', 'agentId', 'csat', 'CSAT', 
                   'satisfaction', 'handleTime', 'HandleTime', 'handle_time'].includes(key)) {
                acc[key] = row[key];
              }
              return acc;
            }, {})
          }
        };
      }).filter((item: AudioFileMetadata) => item.filename); // Filter out entries without filenames
    } catch (error) {
      console.error(`Error parsing Excel metadata from Azure: ${error}`);
      return [];
    }
  }

  /**
   * Match audio files from Azure with metadata from Excel
   */
  async matchAudioFilesWithMetadata(
    containerName: string,
    metadataItems: AudioFileMetadata[]
  ): Promise<AudioFileMetadata[]> {
    const blobs = await this.listBlobs(containerName);
    const blobMap = new Map<string, BlobItem>();
    
    // Create a map of blob names for faster lookup
    blobs.forEach(blob => {
      blobMap.set(blob.name, blob);
    });
    
    // For each metadata item, find matching blob and enhance with audio details
    const enhancedMetadata: AudioFileMetadata[] = [];
    
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
      console.warn('Missing Azure Storage credentials. Set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY environment variables. Azure-related features will be disabled.');
      return null;
    }

    // Create service with a timeout promise to avoid hanging
    console.log('Initializing Azure Storage service...');
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