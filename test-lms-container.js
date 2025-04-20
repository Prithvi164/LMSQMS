// Use ES modules syntax
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';

// Get Azure Storage credentials from environment variables and trim any whitespace
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim();

console.log('Testing container creation with Azure SDK');
console.log(`Account Name: ${accountName}`);
console.log(`Account Key: ${accountKey ? accountKey.substring(0, 5) + '...' : 'null'}`);

// Generate a test container name
const containerName = `test-container-${Date.now()}`;

// Skip the HTTP API test and go directly to the SDK test
async function createContainerDirect() {
  try {
    console.log('Creating container using Azure SDK directly...');
    // Create a shared key credential
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    
    // Create the BlobServiceClient
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );
    
    // Get container client
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Create the container
    console.log(`Creating container "${containerName}" via Azure SDK`);
    const createContainerResponse = await containerClient.create();
    
    console.log(`Container created successfully. RequestId: ${createContainerResponse.requestId}`);
    console.log(`Container URL: ${containerClient.url}`);
    
    return { success: true, containerName, directSdk: true };
  } catch (error) {
    console.error('Error creating container with SDK:', error.message);
    return { success: false, error: error.message, directSdk: true };
  }
}

testCreateContainer()
  .then(result => {
    console.log('\nFinal result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });