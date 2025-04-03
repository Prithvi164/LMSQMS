import cloudStorage from './server/services/cloudStorage';

// Organization ID with Azure configured
const ORGANIZATION_ID = 39;

async function runSimpleTest() {
  try {
    console.log(`Testing cloud storage for organization ${ORGANIZATION_ID}...`);
    
    // Check if configured
    const isConfigured = await cloudStorage.isConfigured(ORGANIZATION_ID);
    console.log(`Is cloud storage configured? ${isConfigured}`);
    
    // Test file upload if configured
    if (isConfigured) {
      // Create test file
      const testContent = 'This is a simple test file';
      const buffer = Buffer.from(testContent);
      
      // Upload file
      console.log(`Uploading test file...`);
      const result = await cloudStorage.uploadFile(
        ORGANIZATION_ID,
        buffer,
        'simple-test.txt',
        'text/plain'
      );
      
      console.log(`File uploaded successfully!`);
      console.log(`URL: ${result.url}`);
      
      // List files
      console.log(`\nListing files:`);
      const files = await cloudStorage.listFiles(ORGANIZATION_ID);
      console.log(`Found ${files.length} files`);
      for (const file of files) {
        console.log(`- ${file.name} (${file.size} bytes, ${file.contentType})`);
      }
      
      // Clean up - delete test file
      console.log(`\nDeleting test file...`);
      await cloudStorage.deleteFile(ORGANIZATION_ID, result.url);
      console.log(`Test file deleted`);
    }
    
    console.log(`\nTest completed!`);
  } catch (error) {
    console.error('Error during test:', error);
  }
}

runSimpleTest();