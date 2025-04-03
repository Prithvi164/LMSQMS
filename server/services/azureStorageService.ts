import { 
  BlobServiceClient, 
  StorageSharedKeyCredential, 
  ContainerClient,
  BlobItem 
} from '@azure/storage-blob';
import { parseFile } from 'music-metadata';
import { Readable } from 'stream';

// Service for interacting with Azure Blob Storage
export class AzureStorageService {
  private blobServiceClient: BlobServiceClient;
  
  constructor(
    private accountName: string,
    private accountKey: string
  ) {
    // Create credentials and client
    const sharedKeyCredential = new StorageSharedKeyCredential(
      accountName,
      accountKey
    );
    
    this.blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
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
  async listBlobs(containerName: string): Promise<BlobItem[]> {
    const containerClient = this.getContainerClient(containerName);
    const blobs: BlobItem[] = [];
    
    // List all blobs in the container
    for await (const blob of containerClient.listBlobsFlat()) {
      blobs.push(blob);
    }
    
    return blobs;
  }
  
  /**
   * Generate a SAS URL for a blob to allow direct access
   * SAS = Shared Access Signature
   */
  async generateBlobSasUrl(
    containerName: string,
    blobName: string,
    expiryTimeInMinutes: number = 60
  ): Promise<string> {
    const containerClient = this.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    
    // Get user delegation key
    const now = new Date();
    const expiryTime = new Date(now);
    expiryTime.setMinutes(now.getMinutes() + expiryTimeInMinutes);
    
    // Generate SAS URL
    const sasUrl = await blobClient.generateSasUrl({
      permissions: 'r', // Read permission
      expiresOn: expiryTime,
      contentType: 'audio/mpeg', // Default to MP3, but could be dynamic
    });
    
    return sasUrl;
  }
  
  /**
   * Get audio metadata from a blob
   */
  async getAudioMetadata(containerName: string, blobName: string): Promise<{
    duration: number;
    fileSize: number;
    format?: string;
  }> {
    const containerClient = this.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    
    // Get blob properties
    const properties = await blobClient.getProperties();
    
    // Download blob as a Buffer to extract metadata
    const downloadResponse = await blobClient.download(0);
    
    // Convert ReadableStream to Node.js Readable stream
    const readable = downloadResponse.readableStreamBody as unknown as Readable;
    
    try {
      // Parse metadata using music-metadata
      const metadata = await parseFile(readable);
      
      return {
        duration: Math.round(metadata.format.duration || 0),
        fileSize: properties.contentLength || 0,
        format: metadata.format.container || metadata.format.codec
      };
    } catch (error) {
      console.error('Error parsing audio metadata:', error);
      // Return basic info if metadata extraction fails
      return {
        duration: 0,
        fileSize: properties.contentLength || 0
      };
    }
  }
  
  /**
   * Check if a blob exists in the container
   */
  async blobExists(containerName: string, blobName: string): Promise<boolean> {
    const containerClient = this.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    
    return await blobClient.exists();
  }
}

// Initialize the service with connection details from environment variables
export const initAzureStorageService = () => {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  
  if (!accountName || !accountKey) {
    console.error('Azure Storage credentials not found in environment variables');
    return null;
  }
  
  return new AzureStorageService(accountName, accountKey);
};