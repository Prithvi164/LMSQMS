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

// Configure pool with better defaults and error handling
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 5000, // Timeout after 5 seconds when connecting
  maxUses: 7500, // Close connection after it has been used this many times
});

// Add error handler for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Add connection validation
pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.error('Database client error:', err);
  });
});

// Initialize Drizzle with the configured pool
export const db = drizzle({ client: pool, schema });

// Function to test database connection
export async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to database');
    client.release();
    return true;
  } catch (error) {
    console.error('Error connecting to database:', error);
    return false;
  }
}