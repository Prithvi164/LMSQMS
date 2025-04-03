import { BlobServiceClient, BlockBlobClient, BlobUploadCommonResponse } from '@azure/storage-blob';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { db } from '../db';
import { organizations } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Interface defining a cloud storage provider
interface CloudStorageProvider {
  isConfigured(): Promise<boolean>;
  uploadFile(file: Buffer | Readable, fileName: string, contentType: string): Promise<{url: string, etag: string}>;
  deleteFile(fileUrl: string): Promise<void>;
  listFiles(prefix?: string): Promise<Array<{
    name: string;
    url: string;
    contentType: string;
    createdOn: Date;
    lastModified: Date;
    size: number;
  }>>;
  generatePresignedUrl(fileUrl: string, expiryMinutes?: number): Promise<string>;
}

// Azure Blob Storage Provider implementation
class AzureBlobStorageProvider implements CloudStorageProvider {
  private connectionString: string;
  private containerName: string;
  private blobServiceClient: BlobServiceClient;
  private containerClient: any;

  constructor(config: any) {
    this.connectionString = config.connectionString;
    this.containerName = config.container || 'audio-files';
    this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
    this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
  }

  async isConfigured(): Promise<boolean> {
    try {
      if (!this.connectionString) return false;
      
      // Try to get properties of the container to verify it exists and is accessible
      await this.containerClient.getProperties();
      return true;
    } catch (error) {
      console.error('Azure Storage configuration check failed:', error);
      return false;
    }
  }

  private getBlobClient(blobName: string): BlockBlobClient {
    return this.containerClient.getBlockBlobClient(blobName);
  }

  async uploadFile(
    file: Buffer | Readable,
    fileName: string, 
    contentType: string
  ): Promise<{url: string, etag: string}> {
    try {
      // Create a unique blob name to avoid overwriting
      const uniqueBlobName = `${Date.now()}-${fileName}`;
      const blobClient = this.getBlobClient(uniqueBlobName);

      // Set appropriate content type
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

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract blob name from URL
      const url = new URL(fileUrl);
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

  async listFiles(prefix?: string): Promise<Array<{
    name: string;
    url: string;
    contentType: string;
    createdOn: Date;
    lastModified: Date;
    size: number;
  }>> {
    try {
      const blobs = [];
      
      // List blobs in the container
      for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
        const blobClient = this.containerClient.getBlobClient(blob.name);
        
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
      console.error('Error listing files in Azure Blob Storage:', error);
      throw error;
    }
  }

  async generatePresignedUrl(fileUrl: string, expiryMinutes: number = 60): Promise<string> {
    // For Azure, we would generate a SAS token here
    // But for simplicity, we'll just return the URL for now
    return fileUrl;
  }
}

// AWS S3 Storage Provider implementation
class AwsS3StorageProvider implements CloudStorageProvider {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;
  private baseUrl: string;

  constructor(config: any) {
    this.region = config.region || 'us-east-1';
    this.bucketName = config.bucket || 'audio-files';
    
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.accessKey || '',
        secretAccessKey: config.secretKey || ''
      }
    });
    
    this.baseUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;
  }

  async isConfigured(): Promise<boolean> {
    try {
      // Try to list objects to verify bucket is accessible
      await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1
      }));
      return true;
    } catch (error) {
      console.error('AWS S3 configuration check failed:', error);
      return false;
    }
  }

  async uploadFile(
    file: Buffer | Readable,
    fileName: string,
    contentType: string
  ): Promise<{url: string, etag: string}> {
    try {
      // Create a unique object key to avoid overwriting
      const uniqueKey = `${Date.now()}-${fileName}`;
      
      // Convert stream to buffer if needed
      const fileBuffer = Buffer.isBuffer(file) ? file : await this.streamToBuffer(file as Readable);
      
      // Upload the file
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: uniqueKey,
        Body: fileBuffer,
        ContentType: contentType
      });
      
      const response = await this.s3Client.send(uploadCommand);
      
      return {
        url: `${this.baseUrl}/${uniqueKey}`,
        etag: response.ETag || ''
      };
    } catch (error) {
      console.error('Error uploading file to AWS S3:', error);
      throw error;
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract the object key from the URL
      const url = new URL(fileUrl);
      const objectKey = url.pathname.substring(1); // Remove leading '/'
      
      // Delete the object
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey
      });
      
      await this.s3Client.send(deleteCommand);
    } catch (error) {
      console.error('Error deleting file from AWS S3:', error);
      throw error;
    }
  }

  async listFiles(prefix?: string): Promise<Array<{
    name: string;
    url: string;
    contentType: string;
    createdOn: Date;
    lastModified: Date;
    size: number;
  }>> {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix
      });
      
      const response = await this.s3Client.send(listCommand);
      
      const files = [];
      
      if (response.Contents) {
        for (const object of response.Contents) {
          const contentType = await this.getContentType(object.Key || '');
          
          files.push({
            name: object.Key || '',
            url: `${this.baseUrl}/${object.Key}`,
            contentType: contentType || 'application/octet-stream',
            createdOn: new Date(), // S3 doesn't provide creation date
            lastModified: object.LastModified || new Date(),
            size: object.Size || 0
          });
        }
      }
      
      return files;
    } catch (error) {
      console.error('Error listing files in AWS S3:', error);
      throw error;
    }
  }

  async generatePresignedUrl(fileUrl: string, expiryMinutes: number = 60): Promise<string> {
    try {
      // Extract the object key from the URL
      const url = new URL(fileUrl);
      const objectKey = url.pathname.substring(1); // Remove leading '/'
      
      // Create a GetObject command
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey
      });
      
      // Generate a pre-signed URL
      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiryMinutes * 60 // Convert minutes to seconds
      });
      
      return presignedUrl;
    } catch (error) {
      console.error('Error generating pre-signed URL for AWS S3:', error);
      throw error;
    }
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
  
  private async getContentType(objectKey: string): Promise<string | undefined> {
    try {
      const headCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey
      });
      
      const response = await this.s3Client.send(headCommand);
      return response.ContentType;
    } catch (error) {
      console.error(`Error getting content type for object ${objectKey}:`, error);
      return undefined;
    }
  }
}

// Local filesystem storage provider for development/testing
class LocalStorageProvider implements CloudStorageProvider {
  private storagePath: string;
  private baseUrl: string;

  constructor(config: any = {}) {
    this.storagePath = config.folder || path.join(process.cwd(), 'uploads');
    this.baseUrl = config.baseUrl || '/uploads';
    
    // Ensure the storage directory exists
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  async isConfigured(): Promise<boolean> {
    try {
      // Check if directory is writable
      await fsPromises.access(this.storagePath, fs.constants.W_OK);
      return true;
    } catch (error) {
      console.error('Local storage configuration check failed:', error);
      return false;
    }
  }

  async uploadFile(
    file: Buffer | Readable,
    fileName: string,
    contentType: string
  ): Promise<{url: string, etag: string}> {
    try {
      // Create a unique filename
      const uniqueFileName = `${Date.now()}-${fileName}`;
      const filePath = path.join(this.storagePath, uniqueFileName);
      
      // Write the file
      if (Buffer.isBuffer(file)) {
        await fsPromises.writeFile(filePath, file);
      } else {
        const writeStream = fs.createWriteStream(filePath);
        file.pipe(writeStream);
        
        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });
      }
      
      // Create metadata file with content type
      const metadataPath = `${filePath}.meta`;
      await fsPromises.writeFile(metadataPath, JSON.stringify({ contentType }));
      
      return {
        url: `${this.baseUrl}/${uniqueFileName}`,
        etag: uniqueFileName // Use filename as etag
      };
    } catch (error) {
      console.error('Error uploading file to local storage:', error);
      throw error;
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract filename from URL
      const fileName = path.basename(fileUrl);
      const filePath = path.join(this.storagePath, fileName);
      const metadataPath = `${filePath}.meta`;
      
      // Delete file and metadata
      await fsPromises.unlink(filePath);
      
      try {
        await fsPromises.unlink(metadataPath);
      } catch (error) {
        // Ignore error if metadata file doesn't exist
      }
    } catch (error) {
      console.error('Error deleting file from local storage:', error);
      throw error;
    }
  }

  async listFiles(prefix?: string): Promise<Array<{
    name: string;
    url: string;
    contentType: string;
    createdOn: Date;
    lastModified: Date;
    size: number;
  }>> {
    try {
      const files = await fsPromises.readdir(this.storagePath);
      
      const result = [];
      
      for (const fileName of files) {
        // Skip metadata files
        if (fileName.endsWith('.meta')) continue;
        
        // Apply prefix filter if provided
        if (prefix && !fileName.startsWith(prefix)) continue;
        
        const filePath = path.join(this.storagePath, fileName);
        const metadataPath = `${filePath}.meta`;
        
        // Get file stats
        const stats = await fsPromises.stat(filePath);
        
        // Get content type from metadata if available
        let contentType = 'application/octet-stream';
        try {
          const metadataContent = await fsPromises.readFile(metadataPath, 'utf8');
          const metadata = JSON.parse(metadataContent);
          contentType = metadata.contentType || contentType;
        } catch (error) {
          // Ignore error if metadata file doesn't exist
        }
        
        result.push({
          name: fileName,
          url: `${this.baseUrl}/${fileName}`,
          contentType,
          createdOn: stats.birthtime,
          lastModified: stats.mtime,
          size: stats.size
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error listing files in local storage:', error);
      throw error;
    }
  }

  async generatePresignedUrl(fileUrl: string, expiryMinutes?: number): Promise<string> {
    // For local storage, just return the URL
    return fileUrl;
  }
}

// Main cloud storage service that handles organization-specific providers
class CloudStorageService {
  private providerCache: Map<number, CloudStorageProvider> = new Map();

  /**
   * Get organization's cloud storage configuration
   */
  private async getOrganizationStorageConfig(organizationId: number): Promise<{
    provider: string;
    config: any;
    enabled: boolean;
  }> {
    try {
      const [org] = await db
        .select({
          cloudStorageEnabled: organizations.cloudStorageEnabled,
          cloudStorageProvider: organizations.cloudStorageProvider,
          cloudStorageConfig: organizations.cloudStorageConfig
        })
        .from(organizations)
        .where(eq(organizations.id, organizationId));

      if (!org) {
        throw new Error(`Organization with ID ${organizationId} not found`);
      }

      return {
        provider: org.cloudStorageProvider,
        config: org.cloudStorageConfig || {},
        enabled: org.cloudStorageEnabled
      };
    } catch (error) {
      console.error('Error fetching organization cloud storage config:', error);
      return {
        provider: 'local',
        config: {},
        enabled: false
      };
    }
  }

  /**
   * Get storage provider for an organization
   */
  private async getProviderForOrganization(organizationId: number): Promise<CloudStorageProvider> {
    // Check if we already have a cached provider
    if (this.providerCache.has(organizationId)) {
      return this.providerCache.get(organizationId)!;
    }

    // Get organization's storage configuration
    const { provider, config, enabled } = await this.getOrganizationStorageConfig(organizationId);

    if (!enabled) {
      throw new Error(`Cloud storage is not enabled for organization ${organizationId}`);
    }

    let storageProvider: CloudStorageProvider;

    // Create the appropriate provider based on configuration
    switch (provider) {
      case 'azure':
        storageProvider = new AzureBlobStorageProvider(config);
        break;
      case 'aws':
        storageProvider = new AwsS3StorageProvider(config);
        break;
      case 'local':
      default:
        storageProvider = new LocalStorageProvider(config);
        break;
    }

    // Cache the provider
    this.providerCache.set(organizationId, storageProvider);

    return storageProvider;
  }

  /**
   * Check if cloud storage is properly configured for an organization
   */
  async isConfigured(organizationId: number): Promise<boolean> {
    try {
      const { enabled } = await this.getOrganizationStorageConfig(organizationId);
      
      if (!enabled) {
        return false;
      }
      
      const provider = await this.getProviderForOrganization(organizationId);
      return await provider.isConfigured();
    } catch (error) {
      console.error(`Error checking cloud storage configuration for organization ${organizationId}:`, error);
      return false;
    }
  }

  /**
   * Upload a file to storage
   * @param organizationId The organization ID
   * @param file File buffer or stream to upload
   * @param fileName Name to use for the file
   * @param contentType MIME type of the file
   * @returns URL of the uploaded file
   */
  async uploadFile(
    organizationId: number,
    file: Buffer | Readable,
    fileName: string,
    contentType: string
  ): Promise<{url: string, etag: string}> {
    const provider = await this.getProviderForOrganization(organizationId);
    return provider.uploadFile(file, fileName, contentType);
  }

  /**
   * Delete a file from storage
   * @param organizationId The organization ID
   * @param fileUrl Full URL of the file to delete
   */
  async deleteFile(organizationId: number, fileUrl: string): Promise<void> {
    const provider = await this.getProviderForOrganization(organizationId);
    return provider.deleteFile(fileUrl);
  }

  /**
   * List all files in storage
   * @param organizationId The organization ID
   * @param prefix Optional prefix to filter files
   * @returns Array of file information
   */
  async listFiles(organizationId: number, prefix?: string): Promise<Array<{
    name: string;
    url: string;
    contentType: string;
    createdOn: Date;
    lastModified: Date;
    size: number;
  }>> {
    const provider = await this.getProviderForOrganization(organizationId);
    return provider.listFiles(prefix);
  }

  /**
   * Generate a pre-signed URL for time-limited access
   * @param organizationId The organization ID
   * @param fileUrl Full URL of the file
   * @param expiryMinutes Minutes until the URL expires
   * @returns Pre-signed URL with temporary access
   */
  async generatePresignedUrl(organizationId: number, fileUrl: string, expiryMinutes: number = 60): Promise<string> {
    const provider = await this.getProviderForOrganization(organizationId);
    return provider.generatePresignedUrl(fileUrl, expiryMinutes);
  }
}

// Create a singleton instance
const cloudStorage = new CloudStorageService();

export default cloudStorage;