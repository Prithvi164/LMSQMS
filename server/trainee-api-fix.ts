// This file contains a fixed version of the trainee deletion endpoint handler
import { Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { userBatchProcesses } from '@shared/schema';
import { DatabaseStorage } from './storage';

export type User = {
  id: number;
  organizationId: number;
};

export const handleTraineeDelete = async (
  req: Request & { user?: User }, 
  res: Response, 
  storage: DatabaseStorage
) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  try {
    const orgId = parseInt(req.params.orgId);
    const batchId = parseInt(req.params.batchId);
    const userId = parseInt(req.params.traineeId); // This is actually the user ID

    // Check if user belongs to the organization
    if (req.user.organizationId !== orgId) {
      return res.status(403).json({ message: "You can only manage trainees in your own organization" });
    }

    console.log('Finding trainee record for user:', userId, 'in batch:', batchId);
    
    // Find the user batch process record using userId and batchId
    const [userBatchProcess] = await db
      .select({ id: userBatchProcesses.id })
      .from(userBatchProcesses)
      .where(and(
        eq(userBatchProcesses.userId, userId),
        eq(userBatchProcesses.batchId, batchId)
      ));
    
    if (!userBatchProcess) {
      return res.status(404).json({ message: "Trainee not found in this batch" });
    }
    
    console.log('Found user batch process ID:', userBatchProcess.id, 'for user:', userId);
    
    // Use the correct ID to remove the trainee from batch
    await storage.removeTraineeFromBatch(userBatchProcess.id);

    console.log('Successfully removed trainee from batch');
    res.json({ message: "Trainee removed from batch successfully" });
  } catch (error: any) {
    console.error("Error removing trainee:", error);
    res.status(400).json({ message: error.message || "Failed to remove trainee" });
  }
};