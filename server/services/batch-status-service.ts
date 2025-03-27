import { db } from '../db';
import { organizationBatches, batchStatusEnum, batchHistory, users } from '@shared/schema';
import { eq, and, lt, isNull, not } from 'drizzle-orm';
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

// Get the start date field name for a given phase
const getPhaseStartDateField = (phase: string): string => {
  const phaseStartDateMap: Record<string, string> = {
    'induction': 'inductionStartDate',
    'training': 'trainingStartDate',
    'certification': 'certificationStartDate',
    'ojt': 'ojtStartDate',
    'ojt_certification': 'ojtCertificationStartDate'
  };
  return phaseStartDateMap[phase] || '';
};

// Get the actual start date field name for a given phase
const getActualPhaseStartDateField = (phase: string): string => {
  const actualPhaseStartDateMap: Record<string, string> = {
    'induction': 'actualInductionStartDate',
    'training': 'actualTrainingStartDate',
    'certification': 'actualCertificationStartDate',
    'ojt': 'actualOjtStartDate',
    'ojt_certification': 'actualOjtCertificationStartDate',
    'completed': 'actualHandoverToOpsDate'
  };
  return actualPhaseStartDateMap[phase] || '';
};

// Get the actual end date field name for a given phase
const getActualPhaseEndDateField = (phase: string): string => {
  const actualPhaseEndDateMap: Record<string, string> = {
    'induction': 'actualInductionEndDate',
    'training': 'actualTrainingEndDate',
    'certification': 'actualCertificationEndDate',
    'ojt': 'actualOjtEndDate',
    'ojt_certification': 'actualOjtCertificationEndDate'
  };
  return actualPhaseEndDateMap[phase] || '';
};

// Add a record to batch history
const addBatchHistoryRecord = async (
  batchId: number, 
  eventType: 'phase_change' | 'status_update' | 'milestone' | 'note',
  description: string,
  previousValue: string | null,
  newValue: string | null,
  organizationId: number
) => {
  try {
    // First find an admin user for this organization
    const adminUser = await db.query.users.findFirst({
      where: and(
        eq(users.organizationId, organizationId),
        eq(users.role, 'admin')
      )
    });
    
    // If no admin user found, try to find any user
    let userId;
    if (adminUser) {
      userId = adminUser.id;
    } else {
      const anyUser = await db.query.users.findFirst({
        where: eq(users.organizationId, organizationId)
      });
      userId = anyUser?.id;
    }
    
    // Only proceed if we found a valid user
    if (userId) {
      await db.insert(batchHistory).values({
        batchId,
        eventType,
        description,
        previousValue: previousValue || undefined,
        newValue: newValue || undefined,
        date: new Date(), // Using Date object directly
        userId,
        organizationId
      });
    } else {
      console.log('Skipping batch history record - no valid user found for organization', organizationId);
    }
  } catch (error) {
    console.error('Error adding batch history record:', error);
  }
};

export const updateBatchStatuses = async () => {
  try {
    console.log('Starting batch status update check...');
    const today = startOfDay(new Date());

    // Get all batches that are not completed
    const activeBatches = await db.query.organizationBatches.findMany({
      where: and(
        not(eq(organizationBatches.status, 'completed')),
        lt(organizationBatches.startDate, today)
      )
    });

    for (const batch of activeBatches) {
      console.log(`Checking batch ${batch.id} - ${batch.name}`);
      const currentPhase = batch.status;
      
      // For batches in the 'planned' status, we check if it's time to start induction
      if (currentPhase === 'planned') {
        const inductionStartDate = batch.inductionStartDate;
        if (inductionStartDate) {
          const startDate = new Date(inductionStartDate);
          if (today >= startDate) {
            // Time to move to induction phase
            const nextPhase = 'induction';
            const actualStartField = getActualPhaseStartDateField(nextPhase);
            
            console.log(`Updating batch ${batch.id} status from ${currentPhase} to ${nextPhase}`);
            await db
              .update(organizationBatches)
              .set({ 
                status: nextPhase,
                [actualStartField]: today,
                updatedAt: new Date()
              })
              .where(eq(organizationBatches.id, batch.id));
              
            // Add history record
            await addBatchHistoryRecord(
              batch.id,
              'phase_change',
              `Batch phase changed from ${currentPhase} to ${nextPhase}`,
              currentPhase,
              nextPhase,
              batch.organizationId
            );
          }
        }
        continue;
      }
      
      // For batches in an active phase, check if it's time to move to the next phase
      const endDateField = getPhaseEndDateField(currentPhase);
      if (!endDateField) continue;

      const phaseEndDate = batch[endDateField as keyof typeof batch] as string | null;
      if (!phaseEndDate) continue;

      const endDate = new Date(phaseEndDate);
      if (today >= endDate) {
        const nextPhase = getNextPhase(currentPhase);
        if (nextPhase) {
          // Record the actual end date for the current phase
          const actualEndField = getActualPhaseEndDateField(currentPhase);
          
          // Record the actual start date for the next phase
          const actualStartField = getActualPhaseStartDateField(nextPhase);
          
          console.log(`Updating batch ${batch.id} status from ${currentPhase} to ${nextPhase}`);
          
          const updateData: Record<string, any> = { 
            status: nextPhase,
            updatedAt: new Date()
          };
          
          // Add actual end date for current phase
          if (actualEndField) {
            updateData[actualEndField] = today;
          }
          
          // Add actual start date for next phase
          if (actualStartField) {
            updateData[actualStartField] = today;
          }
          
          await db
            .update(organizationBatches)
            .set(updateData)
            .where(eq(organizationBatches.id, batch.id));
            
          // Add history record
          await addBatchHistoryRecord(
            batch.id,
            'phase_change',
            `Batch phase changed from ${currentPhase} to ${nextPhase}`,
            currentPhase,
            nextPhase,
            batch.organizationId
          );
        }
      }
    }

    // Also check for batches that are already in active phases but don't have their actual start dates recorded
    // This covers batches that were manually moved between phases
    const batchesWithMissingActualDates = await db.query.organizationBatches.findMany({
      where: and(
        eq(organizationBatches.status, 'induction'),
        isNull(organizationBatches.actualInductionStartDate)
      )
    });

    for (const batch of batchesWithMissingActualDates) {
      const currentPhase = batch.status;
      const actualStartField = getActualPhaseStartDateField(currentPhase);
      
      if (actualStartField) {
        console.log(`Recording actual start date for batch ${batch.id} in phase ${currentPhase}`);
        await db
          .update(organizationBatches)
          .set({ 
            [actualStartField]: today,
            updatedAt: new Date()
          })
          .where(eq(organizationBatches.id, batch.id));
      }
    }
    
    console.log('Batch status update check completed');
  } catch (error) {
    console.error('Error updating batch statuses:', error);
  }
};
