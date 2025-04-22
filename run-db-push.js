// This script uses drizzle to push the schema to the database

import { exec } from 'child_process';

// Run drizzle-kit push command
exec('npm run db:push', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing command: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`Command stderr: ${stderr}`);
    return;
  }
  
  console.log(`Command output: ${stdout}`);
  console.log('Database schema updated successfully!');
});