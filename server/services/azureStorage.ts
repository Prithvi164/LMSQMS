import { BlobServiceClient, BlockBlobClient, BlobUploadCommonResponse } from '@azure/storage-blob';
import { Readable } from 'stream';
import { db } from '../db';
import { organizations } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Fallback configuration from environment variables
// These will be used only if no organization-specific credentials are provided
const DEFAULT_AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const DEFAULT_AZURE_STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'audio-files';

/**
 * Azure Blob Storage service for handling file operations with organization-specific credentials
 */
class AzureStorageService {
  // Cache for BlobServiceClient instances to avoid recreating them for each operation
  private clientCache: Map<number, { 
    blobServiceClient: BlobServiceClient, 
    containerClient: any,
    containerName: string
  }> = new Map();

  constructor() {
    // We'll initialize clients on-demand for each organization
  }

  /**
   * Get organization's Azure Storage credentials
   */
  private async getOrganizationStorageConfig(organizationId: number): Promise<{
    connectionString: string,
    containerName: string,
    enabled: boolean
  }> {
    try {
      const [org] = await db
        .select({
          azureStorageConnectionString: organizations.azureStorageConnectionString,
          azureStorageContainerName: organizations.azureStorageContainerName,
          azureStorageEnabled: organizations.azureStorageEnabled
        })
        .from(organizations)
        .where(eq(organizations.id, organizationId));

      if (!org) {
        throw new Error(`Organization with ID ${organizationId} not found`);
      }

      return {
        connectionString: org.azureStorageConnectionString || DEFAULT_AZURE_STORAGE_CONNECTION_STRING,
        containerName: org.azureStorageContainerName || DEFAULT_AZURE_STORAGE_CONTAINER_NAME,
        enabled: org.azureStorageEnabled || false
      };
    } catch (error) {
      console.error('Error fetching organization Azure Storage config:', error);
      // Fallback to default settings
      return {
        connectionString: DEFAULT_AZURE_STORAGE_CONNECTION_STRING,
        containerName: DEFAULT_AZURE_STORAGE_CONTAINER_NAME,
        enabled: false
      };
    }
  }

  /**
   * Initialize and cache Azure Storage clients for an organization
   */
  private async getOrganizationClients(organizationId: number): Promise<{
    blobServiceClient: BlobServiceClient,
    containerClient: any,
    containerName: string
  }> {
    // Check if we already have cached clients for this organization
    if (this.clientCache.has(organizationId)) {
      return this.clientCache.get(organizationId)!;
    }

    // Get organization's Azure Storage config
    const config = await this.getOrganizationStorageConfig(organizationId);
    
    if (!config.enabled || !config.connectionString) {
      throw new Error(`Azure Storage is not enabled for organization ${organizationId}`);
    }

    try {
      // Create BlobServiceClient
      const blobServiceClient = BlobServiceClient.fromConnectionString(config.connectionString);
      
      // Get container client
      const containerClient = blobServiceClient.getContainerClient(config.containerName);
      
      // Cache the clients
      const clients = {
        blobServiceClient,
        containerClient,
        containerName: config.containerName
      };
      
      this.clientCache.set(organizationId, clients);
      
      return clients;
    } catch (error) {
      console.error(`Failed to initialize Azure Storage clients for organization ${organizationId}:`, error);
      throw new Error(`Failed to connect to Azure Storage: ${error.message}`);
    }
  }

  /**
   * Check if Azure Storage is properly configured for an organization
   */
  async isConfigured(organizationId: number): Promise<boolean> {
    try {
      const config = await this.getOrganizationStorageConfig(organizationId);
      return config.enabled && !!config.connectionString;
    } catch (error) {
      console.error(`Error checking Azure Storage configuration for organization ${organizationId}:`, error);
      return false;
    }
  }

  /**
   * Get a BlockBlobClient for a specific blob
   */
  private async getBlobClient(organizationId: number, blobName: string): Promise<BlockBlobClient> {
    const { containerClient } = await this.getOrganizationClients(organizationId);
    return containerClient.getBlockBlobClient(blobName);
  }

  /**
   * Upload a file to Azure Blob Storage for a specific organization
   * @param organizationId The organization ID
   * @param file File buffer or stream to upload
   * @param fileName Name to use for the blob
   * @param contentType MIME type of the file
   * @returns URL of the uploaded blob
   */
  async uploadFile(
    organizationId: number,
    file: Buffer | Readable,
    fileName: string,
    contentType: string
  ): Promise<{url: string, etag: string}> {
    if (!await this.isConfigured(organizationId)) {
      throw new Error(`Azure Storage is not properly configured for organization ${organizationId}`);
    }

    try {
      // Create a unique blob name to avoid overwriting existing blobs
      const uniqueBlobName = `${Date.now()}-${fileName}`;
      const blobClient = await this.getBlobClient(organizationId, uniqueBlobName);

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
      console.error(`Error uploading file to Azure Blob Storage for organization ${organizationId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a file from Azure Blob Storage
   * @param organizationId The organization ID
   * @param blobUrl Full URL of the blob to delete
   */
  async deleteFile(organizationId: number, blobUrl: string): Promise<void> {
    if (!await this.isConfigured(organizationId)) {
      throw new Error(`Azure Storage is not properly configured for organization ${organizationId}`);
    }

    try {
      // Extract the blob name from the URL
      const url = new URL(blobUrl);
      const pathSegments = url.pathname.split('/');
      const blobName = pathSegments[pathSegments.length - 1];

      // Delete the blob
      const blobClient = await this.getBlobClient(organizationId, blobName);
      await blobClient.delete();
    } catch (error) {
      console.error(`Error deleting file from Azure Blob Storage for organization ${organizationId}:`, error);
      throw error;
    }
  }

  /**
   * List all blobs in a container for an organization
   * @param organizationId The organization ID
   * @param prefix Optional prefix to filter blobs
   * @returns Array of blob information
   */
  async listFiles(organizationId: number, prefix?: string): Promise<Array<{
    name: string;
    url: string;
    contentType: string;
    createdOn: Date;
    lastModified: Date;
    size: number;
  }>> {
    if (!await this.isConfigured(organizationId)) {
      throw new Error(`Azure Storage is not properly configured for organization ${organizationId}`);
    }

    try {
      const { containerClient } = await this.getOrganizationClients(organizationId);
      
      const blobs = [];
      
      // List blobs in the container
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        const blobClient = containerClient.getBlobClient(blob.name);
        
        const properties = await blobClient.getProperties();
        
        blobs.push({
          name: blob.name,
          url: blobClient.url,
          contentType: properties.contentType || 'application/octet-stream',
          createdOn: properties.createdOn,
          lastModified: properties.lastModified,
          size: properties.contentLength
        });
      }
      
      return blobs;
    } catch (error) {
      console.error(`Error listing files in Azure Blob Storage for organization ${organizationId}:`, error);
      throw error;
    }
  }

  /**
   * Generate a Shared Access Signature (SAS) URL for time-limited access
   * @param organizationId The organization ID
   * @param blobUrl Full URL of the blob
   * @param expiryMinutes Minutes until the SAS URL expires
   * @returns SAS URL with temporary access
   */
  async generateSasUrl(organizationId: number, blobUrl: string, expiryMinutes: number = 60): Promise<string> {
    if (!await this.isConfigured(organizationId)) {
      throw new Error(`Azure Storage is not properly configured for organization ${organizationId}`);
    }

    try {
      // Extract the blob name from the URL
      const url = new URL(blobUrl);
      const pathSegments = url.pathname.split('/');
      const blobName = pathSegments[pathSegments.length - 1];

      // Get a reference to the blob
      const blobClient = await this.getBlobClient(organizationId, blobName);
      
      // For now, just return the URL - SAS URL generation can be implemented later if needed
      return blobClient.url;
    } catch (error) {
      console.error(`Error generating SAS URL for organization ${organizationId}:`, error);
      throw error;
    }
  }
}

// Create a singleton instance
const azureStorage = new AzureStorageService();

export default azureStorage;