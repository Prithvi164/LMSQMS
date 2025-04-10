import { CronJob } from 'cron';
import { updateBatchStatuses, resetEmptyBatches } from '../services/batch-status-service';

// Run the job every minute for testing purposes
const batchStatusJob = new CronJob(
  '* * * * *',  // Runs every minute
  async () => {
    console.log('Running batch status update cron job');
    
    // First reset any empty batches that are incorrectly in active states
    await resetEmptyBatches();
    
    // Then run the regular batch status updates
    await updateBatchStatuses();
  },
  null, // onComplete
  false, // start
  'UTC'  // timezone
);

export const startBatchStatusCron = () => {
  console.log('Starting batch status cron job');
  batchStatusJob.start();
};
