import { formatISTDateOnly, toUTCStorage } from '../utils/timezone';
import { storage } from '../storage';

// Function to validate and start a batch
export async function validateAndStartBatch(req: any, res: any) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  try {
    const batchId = parseInt(req.params.batchId);
    if (!batchId) {
      return res.status(400).json({ message: "Invalid batch ID" });
    }

    // Get the batch
    const batch = await storage.getBatch(batchId);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Check if batch can be started
    if (batch.status !== 'planned') {
      return res.status(400).json({ 
        message: "Only planned batches can be started" 
      });
    }
    
    // Check if the batch's start date has arrived
    const batchStartDate = new Date(batch.startDate);
    batchStartDate.setHours(0, 0, 0, 0); // Set to beginning of day
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day for fair comparison
    
    if (batchStartDate > today) {
      return res.status(400).json({
        message: `Batch cannot be started before its scheduled start date (${formatISTDateOnly(batch.startDate)})`
      });
    }

    // Get trainees count for this batch
    const trainees = await storage.getBatchTrainees(batchId);
    // Safely get trainee count by checking if the category property exists on the trainee object
    const traineeCount = trainees.filter(trainee => trainee && typeof trainee === 'object' && 'category' in trainee && trainee.category === 'trainee').length;

    if (traineeCount === 0) {
      return res.status(400).json({
        message: "Cannot start batch without any trainees. Please add at least one trainee before starting the batch."
      });
    }

    // Store dates in UTC format while preserving IST midnight
    const currentDate = new Date();
    const updatedBatch = await storage.updateBatch(batchId, {
      status: 'induction',
      startDate: toUTCStorage(currentDate.toISOString())
    });

    console.log('Successfully started batch:', {
      ...updatedBatch,
      startDate: formatISTDateOnly(updatedBatch.startDate)
    });

    return res.json(updatedBatch);

  } catch (error: any) {
    console.error("Error starting batch:", error);
    return res.status(500).json({ message: error.message || "Failed to start batch" });
  }
}