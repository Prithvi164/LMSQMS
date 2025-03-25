import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the routes.ts file
const routesPath = path.join('server', 'routes.ts');
let routesContent = fs.readFileSync(routesPath, 'utf8');

// Define fixed delete endpoint implementation
const fixedDeleteEndpoint = `  // Add trainee delete endpoint (fixed)
  app.delete("/api/organizations/:orgId/batches/:batchId/trainees/:traineeId", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    try {
      const orgId = parseInt(req.params.orgId);
      const batchId = parseInt(req.params.batchId);
      const userId = parseInt(req.params.traineeId);

      // Check if user belongs to the organization
      if (req.user.organizationId !== orgId) {
        return res.status(403).json({ message: "You can only manage trainees in your own organization" });
      }

      console.log('Removing trainee (user):', userId, 'from batch:', batchId);

      try {
        // First find the user_batch_process record
        const userBatchRecord = await db
          .select()
          .from(userBatchProcesses)
          .where(
            and(
              eq(userBatchProcesses.userId, userId),
              eq(userBatchProcesses.batchId, batchId)
            )
          );

        if (!userBatchRecord || userBatchRecord.length === 0) {
          return res.status(404).json({ message: "Trainee not found in this batch" });
        }

        // Remove from userBatchProcesses table
        await db
          .delete(userBatchProcesses)
          .where(
            and(
              eq(userBatchProcesses.userId, userId),
              eq(userBatchProcesses.batchId, batchId)
            )
          );
        console.log('Removed from userBatchProcesses table');

        // Remove from userProcesses table
        await db
          .delete(userProcesses)
          .where(eq(userProcesses.userId, userId));
        console.log('Removed from userProcesses table');

        // Remove from users table
        await db
          .delete(users)
          .where(eq(users.id, userId));
        console.log('Removed from users table');

        console.log('Successfully removed trainee from all tables');
        res.json({ message: "Trainee removed successfully" });
      } catch (dbError) {
        console.error("Database error removing trainee:", dbError);
        res.status(500).json({ message: "Failed to remove trainee due to database error" });
      }
    } catch (error) {
      console.error("Error removing trainee:", error);
      res.status(400).json({ message: error.message || "Failed to remove trainee" });
    }
  });`;

// Find all occurrences of the delete endpoint pattern
const deleteEndpointPattern = /\/\/ Add trainee delete endpoint[\s\S]*?app\.delete\("\/api\/organizations\/:orgId\/batches\/:batchId\/trainees\/:traineeId"[\s\S]*?}\);/g;

// Get all matches
const matches = routesContent.match(deleteEndpointPattern);
if (matches) {
  console.log(`Found ${matches.length} occurrences of the delete endpoint`);
  
  // Replace the first occurrence with our fixed version and remove the others
  routesContent = routesContent.replace(deleteEndpointPattern, fixedDeleteEndpoint);
  
  let remainingMatches;
  do {
    remainingMatches = routesContent.match(deleteEndpointPattern);
    if (remainingMatches) {
      console.log(`Removing another occurrence`);
      routesContent = routesContent.replace(deleteEndpointPattern, '');
    }
  } while (remainingMatches && remainingMatches.length > 0);
  
  // Write the fixed content back to the file
  fs.writeFileSync(routesPath, routesContent);
  console.log('Fix applied successfully');
} else {
  console.log('No delete endpoints found');
}