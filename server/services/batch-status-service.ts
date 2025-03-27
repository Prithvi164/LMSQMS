import { db } from '../db';
import { organizationBatches, batchStatusEnum } from '@shared/schema';
import { eq, and, lt } from 'drizzle-orm';
import { startOfDay } from 'date-fns';

// Function to get the next phase based on current phase
const getNextPhase = (currentPhase: string): typeof batchStatusEnum.enumValues[number] | null => {
  const phases: Array<typeof batchStatusEnum.enumValues[number]> = [
    'planned',
    'induction',
    'training',
    'certification',
    'ojt',
    'ojt_certification',
    'completed'
  ];
  
  const currentIndex = phases.indexOf(currentPhase as typeof batchStatusEnum.enumValues[number]);
  if (currentIndex === -1 || currentIndex === phases.length - 1) return null;
  return phases[currentIndex + 1];
};

// Get the end date field name for a given phase
const getPhaseEndDateField = (phase: string): string => {
  const phaseEndDateMap: Record<string, string> = {
    'induction': 'inductionEndDate',
    'training': 'trainingEndDate',
    'certification': 'certificationEndDate',
    'ojt': 'ojtEndDate',
    'ojt_certification': 'ojtCertificationEndDate'
  };
  return phaseEndDateMap[phase] || '';
};

export const updateBatchStatuses = async () => {
  try {
    console.log('Starting batch status update check...');
    const today = startOfDay(new Date());

    // Get all active batches (not completed)
    const activeBatches = await db.query.organizationBatches.findMany({
      where: and(
        eq(organizationBatches.status, 'planned'),
        lt(organizationBatches.startDate, today)
      )
    });

    for (const batch of activeBatches) {
      console.log(`Checking batch ${batch.id} - ${batch.name}`);
      const currentPhase = batch.status;
      const endDateField = getPhaseEndDateField(currentPhase);
      
      if (!endDateField) continue;

      const phaseEndDate = batch[endDateField as keyof typeof batch] as string | null;
      if (!phaseEndDate) continue;

      const endDate = new Date(phaseEndDate);
      if (today > endDate) {
        const nextPhase = getNextPhase(currentPhase);
        if (nextPhase) {
          console.log(`Updating batch ${batch.id} status from ${currentPhase} to ${nextPhase}`);
          await db
            .update(organizationBatches)
            .set({ 
              status: nextPhase,
              updatedAt: new Date()
            })
            .where(eq(organizationBatches.id, batch.id));
        }
      }
    }
    console.log('Batch status update check completed');
  } catch (error) {
    console.error('Error updating batch statuses:', error);
  }
};
