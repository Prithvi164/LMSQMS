const fs = require('fs');
const path = require('path');

// Read the routes.ts file
const routesPath = path.join('server', 'routes.ts');
let routesContent = fs.readFileSync(routesPath, 'utf8');

// Read our fix
const fixContent = require('./delete-trainee-fix').deleteTraineeEndpoint;

// Find all occurrences of the delete endpoint pattern
const deleteEndpointPattern = /\/\/ Add trainee delete endpoint[\s\S]*?app\.delete\("\/api\/organizations\/:orgId\/batches\/:batchId\/trainees\/:traineeId"[\s\S]*?}\);/g;

// Count occurrences
const matches = routesContent.match(deleteEndpointPattern);
if (matches) {
  console.log(`Found ${matches.length} occurrences of the delete endpoint`);
  
  // Replace the first occurrence with our fixed version
  routesContent = routesContent.replace(deleteEndpointPattern, fixContent);
  
  // Remove all other occurrences
  let remaining = routesContent;
  let remainingMatches = remaining.match(deleteEndpointPattern);
  
  while (remainingMatches && remainingMatches.length > 0) {
    console.log(`Removing another occurrence`);
    remaining = remaining.replace(deleteEndpointPattern, '');
    remainingMatches = remaining.match(deleteEndpointPattern);
  }
  
  // Write the fixed content back to the file
  fs.writeFileSync(routesPath, remaining, 'utf8');
  console.log('Fix applied successfully');
} else {
  console.log('No delete endpoints found');
}