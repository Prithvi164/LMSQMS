import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  EvaluationTemplate, 
  EvaluationResult,
  InsertEvaluationResult 
} from "@shared/schema";

interface User {
  id: number;
  fullName: string;
  employeeId: string;
  email: string;
}

interface ScoreEntry {
  score: string;
  comment?: string;
  noReason?: string;
}

export default function ConductEvaluation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [selectedTrainee, setSelectedTrainee] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<number, ScoreEntry>>({});

  // Fetch active templates
  const { data: templates } = useQuery<EvaluationTemplate[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
    select: (data) => data.filter((t) => t.status === "active"),
  });

  // Fetch trainees
  const { data: trainees } = useQuery<User[]>({
    queryKey: ['/api/trainees-for-evaluation'],
    enabled: !!user,
  });

  // Get selected template details
  const { data: selectedTemplateDetails } = useQuery<EvaluationTemplate>({
    queryKey: [`/api/evaluation-templates/${selectedTemplate}`],
    enabled: !!selectedTemplate,
  });

  // Submit evaluation mutation
  const submitEvaluationMutation = useMutation({
    mutationFn: async (evaluation: InsertEvaluationResult) => {
      const response = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...evaluation,
          organizationId: user?.organizationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit evaluation");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/evaluations`],
      });
      toast({
        title: "Success",
        description: "Evaluation submitted successfully",
      });
      setScores({});
      setSelectedTemplate(null);
      setSelectedTrainee(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleScoreChange = (parameterId: number, value: string) => {
    setScores((prev) => ({
      ...prev,
      [parameterId]: {
        ...prev[parameterId],
        score: value,
      },
    }));
  };

  const handleCommentChange = (parameterId: number, comment: string) => {
    setScores((prev) => ({
      ...prev,
      [parameterId]: {
        ...prev[parameterId],
        comment,
      },
    }));
  };

  const handleNoReasonSelect = (parameterId: number, reason: string) => {
    setScores((prev) => ({
      ...prev,
      [parameterId]: {
        ...prev[parameterId],
        noReason: reason,
      },
    }));
  };

  const calculateScore = () => {
    if (!selectedTemplateDetails?.pillars) return 0;

    let totalScore = 0;
    let totalWeight = 0;

    selectedTemplateDetails.pillars.forEach((pillar) => {
      pillar.parameters.forEach((param) => {
        if (param.weightageEnabled && scores[param.id]?.score) {
          const paramScore =
            param.ratingType === "yes_no_na"
              ? scores[param.id].score === "yes"
                ? 100
                : 0
              : parseFloat(scores[param.id].score);

          totalScore += param.weightage * paramScore;
          totalWeight += param.weightage;
        }
      });
    });

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  };

  const handleSubmit = () => {
    if (!selectedTemplate || !selectedTrainee) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select both template and trainee",
      });
      return;
    }

    // Format scores for submission
    const formattedScores = Object.entries(scores).map(([parameterId, value]) => ({
      parameterId: parseInt(parameterId),
      score: value.score,
      comment: value.comment,
      noReason: value.noReason,
    }));

    // Create evaluation object
    const evaluation = {
      templateId: selectedTemplate,
      traineeId: selectedTrainee,
      evaluatorId: user?.id,
      scores: formattedScores,
      finalScore: calculateScore(),
    };

    submitEvaluationMutation.mutate(evaluation);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Conduct Evaluation</h1>
        <div className="flex gap-4">
          <div className="w-[200px]">
            <Select
              value={selectedTrainee?.toString()}
              onValueChange={(value) => setSelectedTrainee(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Trainee" />
              </SelectTrigger>
              <SelectContent>
                {trainees?.map((trainee) => (
                  <SelectItem key={trainee.id} value={trainee.id.toString()}>
                    {trainee.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[200px]">
            <Select
              value={selectedTemplate?.toString()}
              onValueChange={(value) => setSelectedTemplate(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Template" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.id.toString()}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {selectedTemplateDetails && (
        <div className="space-y-6">
          {selectedTemplateDetails.pillars?.map((pillar) => (
            <Card key={pillar.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{pillar.name}</span>
                  <Badge variant="outline">{pillar.weightage}%</Badge>
                </CardTitle>
                <CardDescription>{pillar.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {pillar.parameters?.map((param) => (
                    <Card key={param.id}>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-base">
                            {param.name}
                            {param.isFatal && (
                              <Badge variant="destructive" className="ml-2">
                                Fatal
                              </Badge>
                            )}
                          </CardTitle>
                          {param.weightageEnabled && (
                            <Badge variant="outline">{param.weightage}%</Badge>
                          )}
                        </div>
                        <CardDescription>{param.description}</CardDescription>
                        {param.guidelines && (
                          <div className="mt-2 text-sm bg-muted p-2 rounded">
                            <strong>Guidelines:</strong> {param.guidelines}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {param.ratingType === "yes_no_na" ? (
                            <div className="space-y-4">
                              <Select
                                value={scores[param.id]?.score}
                                onValueChange={(value) =>
                                  handleScoreChange(param.id, value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Rating" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                  <SelectItem value="na">N/A</SelectItem>
                                </SelectContent>
                              </Select>

                              {scores[param.id]?.score === "no" &&
                                param.noReasons && (
                                  <Select
                                    value={scores[param.id]?.noReason}
                                    onValueChange={(value) =>
                                      handleNoReasonSelect(param.id, value)
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select Reason" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {param.noReasons.map(
                                        (reason: string, idx: number) => (
                                          <SelectItem
                                            key={idx}
                                            value={reason}
                                          >
                                            {reason}
                                          </SelectItem>
                                        )
                                      )}
                                    </SelectContent>
                                  </Select>
                                )}
                            </div>
                          ) : param.ratingType === "numeric" ? (
                            <Input
                              type="number"
                              min="1"
                              max="5"
                              placeholder="Score (1-5)"
                              value={scores[param.id]?.score || ""}
                              onChange={(e) =>
                                handleScoreChange(param.id, e.target.value)
                              }
                            />
                          ) : (
                            <Select
                              value={scores[param.id]?.score}
                              onValueChange={(value) =>
                                handleScoreChange(param.id, value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Rating" />
                              </SelectTrigger>
                              <SelectContent>
                                {param.customRatingOptions?.map(
                                  (option: string, idx: number) => (
                                    <SelectItem key={idx} value={option}>
                                      {option}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          )}

                          {(param.requiresComment ||
                            scores[param.id]?.score === "no") && (
                            <Textarea
                              placeholder="Add comments..."
                              value={scores[param.id]?.comment || ""}
                              onChange={(e) =>
                                handleCommentChange(param.id, e.target.value)
                              }
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>Final Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{calculateScore()}%</div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={submitEvaluationMutation.isPending}
            >
              {submitEvaluationMutation.isPending
                ? "Submitting..."
                : "Submit Evaluation"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}