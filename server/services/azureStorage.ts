import { BlobServiceClient, BlockBlobClient, BlobUploadCommonResponse } from '@azure/storage-blob';
import { Readable } from 'stream';

// Configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const AZURE_STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'audio-files';

/**
 * Azure Blob Storage service for handling file operations
 */
class AzureStorageService {
  private blobServiceClient: BlobServiceClient;
  private containerClient: any;

  constructor() {
    // Check if Azure storage is configured
    if (!AZURE_STORAGE_CONNECTION_STRING) {
      console.warn('Azure Storage connection string is not configured.');
    }

    this.blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    
    try {
      this.containerClient = this.blobServiceClient.getContainerClient(AZURE_STORAGE_CONTAINER_NAME);
    } catch (error) {
      console.error('Failed to connect to Azure Storage container:', error);
    }
  }

  /**
   * Check if Azure Storage is properly configured
   */
  isConfigured(): boolean {
    return !!AZURE_STORAGE_CONNECTION_STRING && !!this.containerClient;
  }

  /**
   * Get a BlockBlobClient for a specific blob
   */
  private getBlobClient(blobName: string): BlockBlobClient {
    return this.containerClient.getBlockBlobClient(blobName);
  }

  /**
   * Upload a file to Azure Blob Storage
   * @param file File buffer or stream to upload
   * @param fileName Name to use for the blob
   * @param contentType MIME type of the file
   * @returns URL of the uploaded blob
   */
  async uploadFile(
    file: Buffer | Readable,
    fileName: string,
    contentType: string
  ): Promise<{url: string, etag: string}> {
    if (!this.isConfigured()) {
      throw new Error('Azure Storage is not properly configured');
    }

    try {
      // Create a unique blob name to avoid overwriting existing blobs
      const uniqueBlobName = `${Date.now()}-${fileName}`;
      const blobClient = this.getBlobClient(uniqueBlobName);

      // Set the appropriate content type
      const options = {
        blobHTTPHeaders: {
          blobContentType: contentType
        }
      };

      // Upload the file
      const uploadResponse: BlobUploadCommonResponse = await blobClient.upload(
        file,
        Buffer.isBuffer(file) ? file.length : undefined,
        options
      );

      return {
        url: blobClient.url,
        etag: uploadResponse.etag
      };
    } catch (error) {
      console.error('Error uploading file to Azure Blob Storage:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Azure Blob Storage
   * @param blobUrl Full URL of the blob to delete
   */
  async deleteFile(blobUrl: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Azure Storage is not properly configured');
    }

    try {
      // Extract the blob name from the URL
      const url = new URL(blobUrl);
      const pathSegments = url.pathname.split('/');
      const blobName = pathSegments[pathSegments.length - 1];

      // Delete the blob
      const blobClient = this.getBlobClient(blobName);
      await blobClient.delete();
    } catch (error) {
      console.error('Error deleting file from Azure Blob Storage:', error);
      throw error;
    }
  }

  /**
   * Generate a Shared Access Signature (SAS) URL for time-limited access
   * @param blobUrl Full URL of the blob
   * @param expiryMinutes Minutes until the SAS URL expires
   * @returns SAS URL with temporary access
   */
  async generateSasUrl(blobUrl: string, expiryMinutes: number = 60): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Azure Storage is not properly configured');
    }

    try {
      // Extract the blob name from the URL
      const url = new URL(blobUrl);
      const pathSegments = url.pathname.split('/');
      const blobName = pathSegments[pathSegments.length - 1];

      // Get a reference to the blob
      const blobClient = this.getBlobClient(blobName);
      
      // Return the URL - we'll implement SAS generation later if needed
      return blobClient.url;
    } catch (error) {
      console.error('Error generating SAS URL:', error);
      throw error;
    }
  }
}

// Create a singleton instance
const azureStorage = new AzureStorageService();

export default azureStorage;