import { db } from '../db';
import { organizationBatches, batchStatusEnum } from '@shared/schema';
import { eq, and, lt, ne, isNull } from 'drizzle-orm';
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
    'planned': 'inductionStartDate', // Special case for planned - it transitions based on start date
    'induction': 'inductionEndDate',
    'training': 'trainingEndDate',
    'certification': 'certificationEndDate',
    'ojt': 'ojtEndDate',
    'ojt_certification': 'ojtCertificationEndDate'
  };
  return phaseEndDateMap[phase] || '';
};

// Get the actual date field name for tracking when a phase started
const getActualStartDateField = (phase: string): string => {
  const actualStartDateMap: Record<string, string> = {
    'induction': 'actualInductionStartDate', 
    'training': 'actualTrainingStartDate',
    'certification': 'actualCertificationStartDate',
    'ojt': 'actualOjtStartDate',
    'ojt_certification': 'actualOjtCertificationStartDate'
  };
  return actualStartDateMap[phase] || '';
};

// Get the actual date field name for tracking when a phase ended
const getActualEndDateField = (phase: string): string => {
  const actualEndDateMap: Record<string, string> = {
    'induction': 'actualInductionEndDate', 
    'training': 'actualTrainingEndDate',
    'certification': 'actualCertificationEndDate',
    'ojt': 'actualOjtEndDate',
    'ojt_certification': 'actualOjtCertificationEndDate'
  };
  return actualEndDateMap[phase] || '';
};

export const updateBatchStatuses = async () => {
  try {
    console.log('Starting batch status update check...');
    const today = startOfDay(new Date());

    // 1. Check planned batches that should be moved to induction
    const plannedBatches = await db.query.organizationBatches.findMany({
      where: and(
        eq(organizationBatches.status, 'planned'),
        lt(organizationBatches.inductionStartDate, today)
      )
    });

    console.log(`Found ${plannedBatches.length} planned batches that need to start induction`);
    
    for (const batch of plannedBatches) {
      console.log(`Transitioning batch ${batch.id} - ${batch.name} from planned to induction phase`);
      await db
        .update(organizationBatches)
        .set({ 
          status: 'induction',
          actualInductionStartDate: today,
          updatedAt: new Date()
        })
        .where(eq(organizationBatches.id, batch.id));
    }

    // 2. Check all active non-planned batches that may need to transition based on end dates
    const activeBatches = await db.query.organizationBatches.findMany({
      where: and(
        ne(organizationBatches.status, 'planned'),
        ne(organizationBatches.status, 'completed')
      )
    });

    console.log(`Found ${activeBatches.length} active batches to check for phase transitions`);

    for (const batch of activeBatches) {
      console.log(`Checking batch ${batch.id} - ${batch.name} (${batch.status})`);
      const currentPhase = batch.status;
      const endDateField = getPhaseEndDateField(currentPhase);
      
      if (!endDateField) {
        console.log(`No end date field found for phase ${currentPhase}, skipping`);
        continue;
      }

      const phaseEndDate = batch[endDateField as keyof typeof batch] as Date | string | null;
      if (!phaseEndDate) {
        console.log(`No end date found for phase ${currentPhase}, skipping`);
        continue;
      }

      const endDate = phaseEndDate instanceof Date ? phaseEndDate : new Date(phaseEndDate);
      if (today >= endDate) {
        const nextPhase = getNextPhase(currentPhase);
        if (nextPhase) {
          console.log(`Updating batch ${batch.id} status from ${currentPhase} to ${nextPhase}`);
          
          // Set the actual end date for the current phase
          const actualEndDateField = getActualEndDateField(currentPhase);
          
          // Set the actual start date for the next phase (unless it's completed)
          const actualStartDateField = getActualStartDateField(nextPhase);
          
          const updateData: any = { 
            status: nextPhase,
            updatedAt: new Date()
          };
          
          // Record the actual end date of the current phase
          if (actualEndDateField) {
            updateData[actualEndDateField] = today;
          }
          
          // Record the actual start date of the next phase (unless it's completed)
          if (nextPhase !== 'completed' && actualStartDateField) {
            updateData[actualStartDateField] = today;
          } else if (nextPhase === 'completed') {
            // For completion, set the actual completion date
            updateData.actualCompletionDate = today;
          }
          
          await db
            .update(organizationBatches)
            .set(updateData)
            .where(eq(organizationBatches.id, batch.id));
        }
      }
    }
    console.log('Batch status update check completed');
  } catch (error) {
    console.error('Error updating batch statuses:', error);
  }
};
