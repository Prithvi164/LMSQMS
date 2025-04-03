import cloudStorage from './server/services/cloudStorage';
import { Readable } from 'stream';
import fs from 'fs';
import { db } from './server/db';
import { organizations } from './shared/schema';
import { eq } from 'drizzle-orm';

// Test organization ID - We'll use the existing organization with ID 39
const ORGANIZATION_ID = 39;

// Add setup function to configure Azure storage for testing
async function setupAzureStorage() {
  console.log('Setting up Azure storage configuration...');
  try {
    // Check if environment variables are set
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
    
    if (!connectionString) {
      console.error('AZURE_STORAGE_CONNECTION_STRING environment variable is not set');
      return false;
    }
    
    if (!containerName) {
      console.error('AZURE_STORAGE_CONTAINER_NAME environment variable is not set');
      return false;
    }
    
    // Update the organization with Azure storage config
    await db.update(organizations)
      .set({
        cloudStorageEnabled: true,
        cloudStorageProvider: 'azure',
        cloudStorageConfig: {
          connectionString: connectionString,
          container: containerName
        }
      })
      .where(eq(organizations.id, ORGANIZATION_ID));
    
    console.log('Azure storage configuration set up successfully');
    return true;
  } catch (error) {
    console.error('Error setting up Azure storage:', error);
    return false;
  }
}

async function testCloudStorage() {
  console.log('Testing Cloud Storage Connection...');
  
  try {
    // 1. Check if Cloud Storage is configured
    console.log('\n1. Checking if Cloud Storage is configured...');
    const isConfigured = await cloudStorage.isConfigured(ORGANIZATION_ID);
    console.log(`Cloud Storage is configured: ${isConfigured}`);
    
    if (!isConfigured) {
      console.log('Cloud Storage is not configured. Check organization settings or environment variables.');
      return;
    }
    
    // 2. Test file upload
    console.log('\n2. Testing file upload...');
    // Create a test file buffer
    const testFileContent = 'This is a test file for Cloud Storage';
    const testBuffer = Buffer.from(testFileContent);
    
    // Upload the test file
    const uploadResult = await cloudStorage.uploadFile(
      ORGANIZATION_ID,
      testBuffer,
      'test-file.txt',
      'text/plain'
    );
    
    console.log('File uploaded successfully');
    console.log('File URL:', uploadResult.url);
    console.log('ETag:', uploadResult.etag);
    
    // 3. Test listing files
    console.log('\n3. Testing file listing...');
    const files = await cloudStorage.listFiles(ORGANIZATION_ID);
    console.log(`Found ${files.length} files:`);
    files.forEach((file, index) => {
      console.log(`${index + 1}. ${file.name} (${file.contentType}) - Size: ${file.size} bytes`);
    });
    
    // 4. Test generating a pre-signed URL
    console.log('\n4. Testing pre-signed URL generation...');
    const presignedUrl = await cloudStorage.generatePresignedUrl(ORGANIZATION_ID, uploadResult.url, 15);
    console.log('Generated pre-signed URL (valid for 15 minutes):', presignedUrl);
    
    // 5. Test file deletion (only delete the test file we just uploaded)
    console.log('\n5. Testing file deletion...');
    await cloudStorage.deleteFile(ORGANIZATION_ID, uploadResult.url);
    console.log('Test file deleted successfully');
    
    // 6. Verify file is gone
    console.log('\n6. Verifying file deletion...');
    const filesAfterDelete = await cloudStorage.listFiles(ORGANIZATION_ID);
    const fileStillExists = filesAfterDelete.some(file => file.url === uploadResult.url);
    console.log(`File still exists: ${fileStillExists}`);
    
    console.log('\nCloud Storage testing completed successfully!');
  } catch (error) {
    console.error('Error testing Cloud Storage:', error);
  }
}

// Main function to run the setup and test
async function runTest() {
  // First, set up Azure Storage configuration
  const setupSuccess = await setupAzureStorage();
  
  if (!setupSuccess) {
    console.error('Failed to set up Azure Storage configuration. Aborting test.');
    return;
  }
  
  // Then run the test
  await testCloudStorage();
}

// Execute the test
runTest().catch(err => {
  console.error('Unhandled error during Cloud Storage test:', err);
});