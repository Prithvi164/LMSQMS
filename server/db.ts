import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Add connection verification function
export async function verifyDatabaseConnection(): Promise<{ 
  isConnected: boolean; 
  latency: number;
  message?: string;
}> {
  const start = Date.now();
  try {
    // Try a simple query to verify connection
    await pool.query('SELECT 1');
    return {
      isConnected: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      isConnected: false,
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}

// Add graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('Closing database pool...');
  await pool.end();
  console.log('Database pool closed.');
  process.exit(0);
});