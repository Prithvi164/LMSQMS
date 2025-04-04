import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket for Neon database - with patched WebSocket constructor
class PatchedWebSocketClass extends ws {
  constructor(url: string, protocols?: string | string[]) {
    super(url, protocols);
    
    // Fix for ErrorEvent issue - add custom error handling
    this.addEventListener('error', (event) => {
      console.error('WebSocket error:', event);
    });
  }
}

// Use our patched WebSocket class
neonConfig.webSocketConstructor = PatchedWebSocketClass as any;

// Connection retry settings
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

// Check for DATABASE_URL environment variable
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure the connection pool with improved settings for production
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,               // Maximum number of clients
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 5000, // How long to wait for a connection
});

// Add connection error handling - with safer error handling
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client:', err?.message || 'Unknown error');
  // Attempt to reconnect if in production
  if (process.env.NODE_ENV === 'production') {
    console.log('Attempting to reconnect to database...');
  }
});

// Connect to the database with retry logic
const connectWithRetry = async () => {
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      // Test the connection
      const client = await pool.connect();
      client.release();
      console.log('Successfully connected to database');
      return;
    } catch (err) {
      retries++;
      console.error(`Database connection attempt ${retries} failed:`, err);
      if (retries >= MAX_RETRIES) {
        throw new Error(`Could not connect to database after ${MAX_RETRIES} attempts`);
      }
      // Wait before trying again
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
};

// Initialize connection in production
if (process.env.NODE_ENV === 'production') {
  connectWithRetry().catch(err => {
    console.error('Initial database connection failed:', err);
    // We don't exit the process here, allowing the application to continue
    // even if initial connection fails (it may recover later)
  });
}

// Create Drizzle ORM instance
export const db = drizzle({ client: pool, schema });