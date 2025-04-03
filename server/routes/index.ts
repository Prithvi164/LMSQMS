import { Express } from 'express';
import cloudStorageRoutes from './cloud-storage';

export function registerRoutes(app: Express): void {
  // Register all route modules here
  app.use(cloudStorageRoutes);
  
  console.log('All routes registered successfully');
}