// This file contains a temporary fix for finding userBatchProcessId
import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { userBatchProcesses } from '@shared/schema';

export async function findUserBatchProcessId(userId: number, batchId: number): Promise<number | null> {
  try {
    // Find the user batch process record using userId and batchId
    const [userBatchProcess] = await db
      .select({ id: userBatchProcesses.id })
      .from(userBatchProcesses)
      .where(and(
        eq(userBatchProcesses.userId, userId),
        eq(userBatchProcesses.batchId, batchId)
      ));
    
    if (!userBatchProcess) {
      console.error(`No user_batch_process found for userId: ${userId}, batchId: ${batchId}`);
      return null;
    }
    
    console.log(`Found user_batch_process.id: ${userBatchProcess.id} for userId: ${userId}, batchId: ${batchId}`);
    return userBatchProcess.id;
  } catch (error) {
    console.error('Error in findUserBatchProcessId:', error);
    return null;
  }
}