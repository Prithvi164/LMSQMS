import { CronJob } from 'cron';
import { updateBatchStatuses } from '../services/batch-status-service';

// Run the job every hour
const batchStatusJob = new CronJob(
  '0 * * * *',  // Runs at the start of every hour
  async () => {
    console.log('Running batch status update cron job');
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
