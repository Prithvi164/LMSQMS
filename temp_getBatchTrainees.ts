  async getBatchTrainees(batchId: number): Promise<UserBatchProcess[]> {
    try {
      console.log(`Fetching trainees for batch ${batchId}`);

      // Count only from user_batch_process table without joining with users
      const trainees = await db
        .select({
          id: userBatchProcesses.id,
          userId: userBatchProcesses.userId,
          batchId: userBatchProcesses.batchId,
          processId: userBatchProcesses.processId,
          status: userBatchProcesses.status,
          joinedAt: userBatchProcesses.joinedAt,
          completedAt: userBatchProcesses.completedAt,
          createdAt: userBatchProcesses.createdAt,
          updatedAt: userBatchProcesses.updatedAt
        })
        .from(userBatchProcesses)
        .where(eq(userBatchProcesses.batchId, batchId)) as UserBatchProcess[];

      console.log(`[BATCH TRAINEES] Found ${trainees.length} entries for batch ${batchId}`);
      return trainees;
    } catch (error) {
      console.error('Error fetching batch trainees:', error);
      throw error;
    }
  }