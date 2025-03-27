import { db } from '../db';
import { organizationBatches, batchStatusEnum } from '@shared/schema';
import { eq, and, lt, isNull } from 'drizzle-orm';
import { startOfDay, format } from 'date-fns';

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

// Get the actual start date field name for a phase
const getActualStartDateField = (phase: string): string => {
  const phaseStartDateMap: Record<string, string> = {
    'planned': 'actualStartDate',
    'induction': 'actualInductionStartDate',
    'training': 'actualTrainingStartDate',
    'certification': 'actualCertificationStartDate',
    'ojt': 'actualOjtStartDate',
    'ojt_certification': 'actualOjtCertificationStartDate'
  };
  return phaseStartDateMap[phase] || '';
};

// Get the actual end date field name for a phase
const getActualEndDateField = (phase: string): string => {
  const phaseEndDateMap: Record<string, string> = {
    'planned': 'actualStartDate', // When planned ends, batch actually starts
    'induction': 'actualInductionEndDate',
    'training': 'actualTrainingEndDate',
    'certification': 'actualCertificationEndDate',
    'ojt': 'actualOjtEndDate',
    'ojt_certification': 'actualOjtCertificationEndDate',
    'completed': 'actualEndDate'
  };
  return phaseEndDateMap[phase] || '';
};

export const updateBatchStatuses = async () => {
  try {
    console.log('Starting batch status update check...');
    const today = startOfDay(new Date());
    const todayFormatted = format(today, 'yyyy-MM-dd');

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
          
          // Set current phase's actual end date if not already set
          const actualEndDateField = getActualEndDateField(currentPhase);
          const actualEndDateValue = batch[actualEndDateField as keyof typeof batch];
          
          // Set next phase's actual start date if not already set
          const nextPhaseActualStartField = getActualStartDateField(nextPhase);
          const nextPhaseActualStartValue = batch[nextPhaseActualStartField as keyof typeof batch];
          
          const updateData: Record<string, any> = {
            status: nextPhase,
            updatedAt: new Date()
          };
          
          // Only set the actual end date for the current phase if it's not already set
          if (actualEndDateField && !actualEndDateValue) {
            updateData[actualEndDateField] = todayFormatted;
          }
          
          // Only set the actual start date for the next phase if it's not already set
          if (nextPhaseActualStartField && !nextPhaseActualStartValue) {
            updateData[nextPhaseActualStartField] = todayFormatted;
          }
          
          await db
            .update(organizationBatches)
            .set(updateData)
            .where(eq(organizationBatches.id, batch.id));
            
          console.log(`Updated batch ${batch.id} with actual dates:`, updateData);
        }
      }
    }
    
    // Handle transitions for active batches in other phases
    await handleActivePhaseTransitions();
    
    console.log('Batch status update check completed');
  } catch (error) {
    console.error('Error updating batch statuses:', error);
  }
};

// Handles transitions for batches in phases other than "planned"
async function handleActivePhaseTransitions() {
  try {
    console.log('Checking active batches for phase transitions...');
    const today = startOfDay(new Date());
    const todayFormatted = format(today, 'yyyy-MM-dd');
    
    // Get all active batches (not in planned or completed status)
    const activePhases = ['induction', 'training', 'certification', 'ojt', 'ojt_certification'];
    
    for (const phase of activePhases) {
      const batches = await db.query.organizationBatches.findMany({
        where: eq(organizationBatches.status, phase),
      });
      
      for (const batch of batches) {
        const endDateField = getPhaseEndDateField(phase);
        if (!endDateField) continue;
        
        const phaseEndDate = batch[endDateField as keyof typeof batch] as string | null;
        if (!phaseEndDate) continue;
        
        const endDate = new Date(phaseEndDate);
        if (today > endDate) {
          const nextPhase = getNextPhase(phase);
          if (nextPhase) {
            console.log(`Transitioning batch ${batch.id} from ${phase} to ${nextPhase}`);
            
            // Set current phase's actual end date if not already set
            const actualEndDateField = getActualEndDateField(phase);
            const actualEndDateValue = batch[actualEndDateField as keyof typeof batch];
            
            // Set next phase's actual start date if not already set
            const nextPhaseActualStartField = getActualStartDateField(nextPhase);
            const nextPhaseActualStartValue = batch[nextPhaseActualStartField as keyof typeof batch];
            
            const updateData: Record<string, any> = {
              status: nextPhase,
              updatedAt: new Date()
            };
            
            // Only set the actual end date for the current phase if it's not already set
            if (actualEndDateField && !actualEndDateValue) {
              updateData[actualEndDateField] = todayFormatted;
            }
            
            // Only set the actual start date for the next phase if it's not already set
            if (nextPhaseActualStartField && !nextPhaseActualStartValue) {
              updateData[nextPhaseActualStartField] = todayFormatted;
            }
            
            // Special case: if transitioning to completed, set the actual end date
            if (nextPhase === 'completed') {
              updateData['actualEndDate'] = todayFormatted;
              
              // Set the handover to ops date if not already set
              if (!batch.actualHandoverToOpsDate) {
                updateData['actualHandoverToOpsDate'] = todayFormatted;
              }
            }
            
            await db
              .update(organizationBatches)
              .set(updateData)
              .where(eq(organizationBatches.id, batch.id));
              
            console.log(`Updated batch ${batch.id} with actual dates:`, updateData);
          }
        }
      }
    }
    
    console.log('Active batch transitions completed');
  } catch (error) {
    console.error('Error handling active phase transitions:', error);
  }
}
