
import { storage } from "./storage";

export interface HealthStatus {
  status: 'ok' | 'error';
  api: boolean;
  database: boolean;
  mode: string;
  timestamp: string;
  error?: string;
}

export async function checkHealth(): Promise<HealthStatus> {
  const result: HealthStatus = {
    status: 'ok',
    api: true,
    database: false,
    mode: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  };

  try {
    // Simple database check
    await storage.healthCheck();
    result.database = true;
  } catch (error: any) {
    result.status = 'error';
    result.database = false;
    result.error = `Database error: ${error.message}`;
  }

  return result;
}
