import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the routes.ts file
const routesPath = path.join(__dirname, 'server', 'routes.ts');
let content = fs.readFileSync(routesPath, 'utf8');

// The pattern to match
const pattern = /const traineeData = {[\s\S]+?batchId: batchId[\s\S]+?await storage\.createUser\(traineeData\);[\s\S]+?successCount\+\+;/g;

// The replacement
const replacement = `const traineeData = {
            username: row.username,
            fullName: row.fullName,
            email: row.email,
            employeeId: row.employeeId,
            phoneNumber: row.phoneNumber,
            dateOfJoining: row.dateOfJoining,
            dateOfBirth: row.dateOfBirth,
            education: row.education,
            password: await hashPassword(row.password),
            role: role,
            category: "trainee", // Always set category as trainee
            processId: batch.processId,
            lineOfBusinessId: batch.lineOfBusinessId,
            locationId: batch.locationId,
            managerId: batch.trainerId,
            organizationId: orgId
          };

          // Create user
          const user = await storage.createUser(traineeData);
          
          // Create batch process assignment
          await storage.assignUserToBatch({
            userId: user.id,
            batchId,
            processId: batch.processId,
            status: 'active',
            joinedAt: new Date()
          });
          
          // Create user process record
          await storage.createUserProcess({
            userId: user.id,
            processId: batch.processId,
            organizationId: orgId,
            lineOfBusinessId: batch.lineOfBusinessId,
            locationId: batch.locationId,
            status: 'active',
            assignedAt: new Date()
          });
          
          successCount++;`;

// Replace all occurrences
const modified = content.replace(pattern, replacement);

// Write back to the file
fs.writeFileSync(routesPath, modified);

console.log('Patched trainee upload endpoints');