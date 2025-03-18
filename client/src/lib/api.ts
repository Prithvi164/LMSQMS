// API utilities for evaluation management
export const evaluationApi = {
  // Start a new evaluation
  initiateEvaluation: async ({ 
    batchId, 
    traineeId, 
    templateId, 
    organizationId,
    evaluatorId 
  }: {
    batchId: number;
    traineeId: number;
    templateId: number;
    organizationId: number;
    evaluatorId: number;
  }) => {
    console.log('Initiating evaluation with data:', {
      batchId,
      traineeId,
      templateId,
      organizationId,
      evaluatorId
    });

    try {
      const response = await fetch(`/api/organizations/${organizationId}/evaluations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          batchId,
          traineeId,
          templateId,
          evaluatorId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Evaluation creation failed:', error);
        throw new Error(error.message || 'Failed to initiate evaluation');
      }

      const data = await response.json();
      console.log('Evaluation created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error in initiateEvaluation:', error);
      throw error;
    }
  },

  // Get an evaluation by ID
  getEvaluation: async (evaluationId: number) => {
    try {
      const response = await fetch(`/api/evaluations/${evaluationId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch evaluation');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching evaluation:', error);
      throw error;
    }
  },

  // Get evaluations for a trainee
  getTraineeEvaluations: async (traineeId: number, organizationId: number) => {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/trainees/${traineeId}/evaluations`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch trainee evaluations');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching trainee evaluations:', error);
      throw error;
    }
  }
};