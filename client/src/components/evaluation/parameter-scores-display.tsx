import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type ScoreParameter = {
  id?: number;
  name?: string;
  description?: string;
  weight?: number;
  maxScore?: number;
  pillarId?: number;
  question?: string;
};

type Score = {
  id: number;
  parameterId: number;
  score: any; // Could be number or string based on the scoring system
  comment: string | null;
  noReason: string | null;
  parameter?: ScoreParameter;
};

type GroupedScore = {
  pillar?: {
    id: number;
    name: string;
    description?: string;
    weight?: number;
  };
  scores: Score[];
};

interface ParameterScoresDisplayProps {
  groupedScores: GroupedScore[];
  maxHeight?: string;
}

/**
 * Component to display evaluation parameter scores in a consistent format
 * Used in both evaluation-feedback and conduct-evaluation sections
 */
export function ParameterScoresDisplay({ groupedScores, maxHeight = "400px" }: ParameterScoresDisplayProps) {
  // Function to determine badge class based on score
  const getScoreBadgeClass = (score: any): string => {
    if (
      (typeof score === 'number' && score >= 4) || 
      score === "Excellent" || 
      score === "Yes" || 
      score === "1"
    ) {
      return 'bg-green-50 text-green-700 border-green-200';
    } else if (
      (typeof score === 'number' && score <= 1) || 
      score === "Poor" || 
      score === "No" || 
      score === "0"
    ) {
      return 'bg-red-50 text-red-700 border-red-200';
    } else {
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Parameter Scores</h3>
      
      <Separator className="my-4" />
      
      <ScrollArea className={`h-[${maxHeight}] pr-4`}>
        {!groupedScores || groupedScores.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No detailed scores available</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {groupedScores.map((group, groupIndex) => (
              <AccordionItem key={groupIndex} value={`pillar-${group.pillar?.id || groupIndex}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex justify-between items-center w-full pr-4">
                    <span className="font-medium">
                      {group.pillar?.name || `Section ${groupIndex + 1}`}
                    </span>
                    {group.pillar && group.pillar.weight && (
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
                            <h4 className="font-medium">{score.parameter?.question || score.parameter?.name || 'Parameter'}</h4>
                            {score.parameter?.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {score.parameter.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {score.parameter && score.parameter.weight && (
                              <span className="text-xs bg-muted-foreground/20 px-2 py-1 rounded">
                                Weight: {score.parameter.weight}%
                              </span>
                            )}
                            <Badge 
                              variant="outline" 
                              className={getScoreBadgeClass(score.score)}
                            >
                              {typeof score.score === 'number' && score.parameter?.maxScore 
                                ? `${score.score}/${score.parameter.maxScore}` 
                                : score.score}
                            </Badge>
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
        )}
      </ScrollArea>
    </div>
  );
}