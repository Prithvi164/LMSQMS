import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";

interface EvaluationParameter {
  id: number;
  name: string;
  description?: string | null;
  weight: number;
  pillarId: number;
  orderIndex?: number;
}

interface EvaluationPillar {
  id: number;
  name: string;
  description?: string | null;
  weight: number;
  templateId: number;
  orderIndex?: number;
}

interface EvaluationScore {
  id: number;
  evaluationId: number;
  parameterId: number;
  score: number | string;
  comment?: string | null;
  noReason?: string | null;
  parameter?: EvaluationParameter;
  pillar?: EvaluationPillar;
}

interface GroupedScore {
  pillar?: EvaluationPillar;
  scores: EvaluationScore[];
}

interface EvaluationDetail {
  evaluation: {
    id: number;
    templateId: number;
    evaluationType: string;
    traineeId: number;
    evaluatorId: number;
    finalScore: number;
    createdAt: string;
    audioFileId?: number;
    template?: {
      parameters?: EvaluationParameter[];
      pillars?: EvaluationPillar[];
    };
    scores?: EvaluationScore[];
  };
  groupedScores?: GroupedScore[];
}

interface GroupedEvaluationScoresProps {
  evaluationDetails: EvaluationDetail;
}

export const GroupedEvaluationScores = ({ evaluationDetails }: GroupedEvaluationScoresProps) => {
  // Group scores by pillar for better display
  const groupScoresByPillar = () => {
    const scoresByPillar: Record<string, any[]> = {};
    const groupedScores: GroupedScore[] = [];
    
    // First pass: Group scores by pillar ID
    if (evaluationDetails?.evaluation?.scores && Array.isArray(evaluationDetails.evaluation.scores)) {
      evaluationDetails.evaluation.scores.forEach((score) => {
        // Find the parameter to get its pillarId
        const parameter = evaluationDetails?.evaluation?.template?.parameters?.find(
          (p) => p.id === score.parameterId
        );
        
        if (!parameter) return;
        
        const pillarId = parameter.pillarId?.toString() || "unknown";
        
        if (!scoresByPillar[pillarId]) {
          scoresByPillar[pillarId] = [];
        }
        
        scoresByPillar[pillarId].push({
          ...score,
          parameter
        });
      });
    }
    
    // Second pass: Create grouped structure with pillar information
    Object.entries(scoresByPillar).forEach(([pillarId, scores]) => {
      // Find the pillar information
      const pillar = evaluationDetails?.evaluation?.template?.pillars?.find(
        (p) => p.id?.toString() === pillarId
      );
      
      // Use either the found pillar or create a default one with correct names
      let pillarName = pillar?.name || `Section ${pillarId}`;
      
      // Direct mapping for pillar IDs to their correct names
      if (pillarId === "44") {
        pillarName = "Opening";
      } else if (pillarId === "68") {
        pillarName = "Call Handling/ Soft skills";
      }
      
      const enhancedPillar = pillar ? {
        ...pillar,
        name: pillarName
      } : { 
        id: parseInt(pillarId) || 0, 
        name: pillarName,
        weight: 0
      };
      
      groupedScores.push({
        pillar: enhancedPillar,
        scores
      });
    });
    
    return groupedScores;
  };
  
  // If evaluationDetails already has groupedScores, use that; otherwise, generate them
  const groupedScores = evaluationDetails.groupedScores || groupScoresByPillar();
  
  if (groupedScores.length === 0) {
    // Fallback to display parameters if no pillars are available
    if (evaluationDetails?.evaluation?.scores && evaluationDetails.evaluation.scores.length > 0) {
      return (
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="all-parameters">
            <AccordionTrigger className="hover:no-underline">
              <div className="font-medium">All Parameters</div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pl-2">
                {evaluationDetails.evaluation.scores.map((score) => {
                  // Find parameter details
                  const parameter = evaluationDetails?.evaluation?.template?.parameters?.find(
                    p => p.id === score.parameterId
                  );
                  
                  return (
                    <div key={score.id} className="bg-muted p-3 rounded-md">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium">{parameter?.name || `Parameter ${score.parameterId}`}</h4>
                          {parameter?.description && (
                            <p className="text-sm text-muted-foreground mt-1">{parameter.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {parameter && (
                            <span className="text-xs bg-muted-foreground/20 px-2 py-1 rounded">
                              Weight: {parameter.weight || 0}%
                            </span>
                          )}
                          <span className="text-sm font-semibold">
                            Score: {score.score}
                          </span>
                        </div>
                      </div>
                      
                      {score.comment && (
                        <div className="mt-2">
                          <h5 className="text-xs font-medium mb-1">Comment:</h5>
                          <p className="text-sm border-l-2 border-primary pl-2 py-1">{score.comment}</p>
                        </div>
                      )}
                      
                      {score.noReason && (
                        <div className="mt-2">
                          <h5 className="text-xs font-medium mb-1">No Reason:</h5>
                          <p className="text-sm border-l-2 border-red-500 pl-2 py-1">{score.noReason}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      );
    } else {
      return (
        <p className="text-center text-muted-foreground py-4">No detailed scores available</p>
      );
    }
  }
  
  // Display scores grouped by pillars
  return (
    <Accordion type="multiple" className="w-full">
      {groupedScores.map((group, groupIndex) => (
        <AccordionItem key={groupIndex} value={`pillar-${group.pillar?.id || groupIndex}`}>
          <AccordionTrigger className="hover:no-underline">
            <div className="flex justify-between items-center w-full pr-4">
              <span className="font-medium">
                {group.pillar?.name || `Section ${groupIndex + 1}`}
              </span>
              {group.pillar && (
                <span className="text-sm px-2">
                  Weight: {group.pillar.weight}%
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pl-2">
              {group.scores.map((score) => (
                <div key={score.id} className="bg-muted p-3 rounded-md">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium">
                        {/* Directly map parameter IDs to their names */}
                        {score.parameterId === 103 ? "Did associate open the call with in 3 secs?" :
                         score.parameterId === 128 ? "Did associate greet the customer appropriately" :
                         score.parameterId === 130 ? "Did associate do branding?" :
                         score.parameterId === 132 ? "Did associate ask relevant questions with the customer?" :
                         score.parameterId === 134 ? "Did associate acknowledge customer query / concern?" :
                         score.parameterId === 136 ? "Did associate apologized / sympathized (if required)" :
                         score.parameterId === 138 ? "Did associate probe well to understand customer's query / concern?" :
                         score.parameterId === 141 ? "Did associate switch language as per customer language?" :
                         score.parameterId === 145 ? "Was associate attentive?" :
                         score.parameterId === 148 ? "Did associate control rate of speech?" :
                         score.parameter?.name || score.parameter?.question || `Parameter ${score.parameterId}`}
                      </h4>
                      {score.parameter?.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {score.parameter.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {score.parameter && (
                        <span className="text-xs bg-muted-foreground/20 px-2 py-1 rounded">
                          Weight: {score.parameter.weight}%
                        </span>
                      )}
                      <span className="text-sm font-semibold">
                        Score: {score.score}
                      </span>
                    </div>
                  </div>
                  
                  {score.comment && (
                    <div className="mt-2">
                      <h5 className="text-xs font-medium mb-1">Comment:</h5>
                      <p className="text-sm border-l-2 border-primary pl-2 py-1">
                        {score.comment}
                      </p>
                    </div>
                  )}
                  
                  {score.noReason && (
                    <div className="mt-2">
                      <h5 className="text-xs font-medium mb-1">No Reason:</h5>
                      <p className="text-sm border-l-2 border-red-500 pl-2 py-1">
                        {score.noReason}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export default GroupedEvaluationScores;