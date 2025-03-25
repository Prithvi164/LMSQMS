// This file provides a temporary fix for the trainee deletion bug
import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { userBatchProcesses } from '@shared/schema';

export async function findUserBatchProcessId(userId: number, batchId: number): Promise<number | null> {
  try {
    console.log(`Finding user batch process for user ${userId} in batch ${batchId}`);
    
    const [record] = await db
      .select({ id: userBatchProcesses.id })
      .from(userBatchProcesses)
      .where(and(
        eq(userBatchProcesses.userId, userId),
        eq(userBatchProcesses.batchId, batchId)
      ));
    
    if (!record) {
      console.log(`No user batch process found for user ${userId} in batch ${batchId}`);
      return null;
    }
    
    console.log(`Found user batch process ID: ${record.id}`);
    return record.id;
  } catch (error) {
    console.error('Error finding user batch process:', error);
    return null;
  }
}