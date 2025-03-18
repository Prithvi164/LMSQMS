import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

// Define types
type Batch = {
  id: number;
  name: string;
  status: string;
};

type Trainee = {
  id: number;
  fullName: string;
  employeeId: string;
  email: string;
};

export default function ConductEvaluation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [selectedTrainee, setSelectedTrainee] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<number, any>>({});

  // Fetch active batches
  const { data: batches, isLoading: isBatchesLoading } = useQuery<Batch[]>({
    queryKey: ['/api/batches'],
    enabled: !!user,
  });

  // Fetch active templates
  const { data: templates, isLoading: isTemplatesLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
    select: (data) => data.filter((t: any) => t.status === "active"),
  });

  // Fetch trainees for selected batch
  const { data: trainees, isLoading: isTraineesLoading } = useQuery<Trainee[]>({
    queryKey: ['/api/batches', selectedBatch, 'trainees'],
    enabled: !!selectedBatch && !!user,
  });

  // Get selected template details
  const { data: selectedTemplateDetails } = useQuery({
    queryKey: [`/api/evaluation-templates/${selectedTemplate}`],
    enabled: !!selectedTemplate,
  });

  // Submit evaluation mutation
  const submitEvaluationMutation = useMutation({
    mutationFn: async (evaluation: any) => {
      const response = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evaluation),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit evaluation");
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
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Handle scoring and submission
  const handleScoreChange = (parameterId: number, value: any) => {
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

  const calculateScore = () => {
    if (!selectedTemplateDetails) return 0;

    let totalScore = 0;
    let totalWeight = 0;

    selectedTemplateDetails.pillars.forEach((pillar: any) => {
      pillar.parameters.forEach((param: any) => {
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

    return totalWeight > 0 ? (totalScore / totalWeight).toFixed(2) : 0;
  };

  const handleSubmit = () => {
    if (!selectedTemplate || !selectedTrainee || !selectedBatch) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select batch, template and trainee",
      });
      return;
    }

    const evaluation = {
      templateId: selectedTemplate,
      traineeId: selectedTrainee,
      batchId: selectedBatch,
      evaluatorId: user?.id,
      scores: Object.entries(scores).map(([parameterId, value]) => ({
        parameterId: parseInt(parameterId),
        ...value,
      })),
      finalScore: calculateScore(),
    };

    submitEvaluationMutation.mutate(evaluation);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Conduct Evaluation</h1>
        <div className="flex gap-4">
          {/* Batch Selection */}
          <div className="w-[200px]">
            <Select 
              onValueChange={(value) => {
                setSelectedBatch(parseInt(value));
                setSelectedTrainee(null); // Reset trainee when batch changes
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={isBatchesLoading ? "Loading batches..." : "Select Batch"} />
              </SelectTrigger>
              <SelectContent>
                {batches?.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id.toString()}>
                    {batch.name}
                  </SelectItem>
                ))}
                {isBatchesLoading && (
                  <SelectItem value="loading" disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </SelectItem>
                )}
                {!isBatchesLoading && (!batches || batches.length === 0) && (
                  <SelectItem value="none" disabled>
                    No active batches found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Trainee Selection */}
          <div className="w-[200px]">
            <Select 
              onValueChange={(value) => setSelectedTrainee(parseInt(value))}
              disabled={!selectedBatch}
            >
              <SelectTrigger>
                <SelectValue 
                  placeholder={
                    !selectedBatch 
                      ? "Select Batch First" 
                      : isTraineesLoading 
                        ? "Loading trainees..." 
                        : "Select Trainee"
                  } 
                />
              </SelectTrigger>
              <SelectContent>
                {trainees?.map((trainee) => (
                  <SelectItem key={trainee.id} value={trainee.id.toString()}>
                    {trainee.fullName}
                  </SelectItem>
                ))}
                {isTraineesLoading && (
                  <SelectItem value="loading" disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </SelectItem>
                )}
                {!isTraineesLoading && (!trainees || trainees.length === 0) && (
                  <SelectItem value="none" disabled>
                    No trainees found in this batch
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection */}
          <div className="w-[200px]">
            <Select 
              onValueChange={(value) => setSelectedTemplate(parseInt(value))}
              disabled={!selectedTrainee}
            >
              <SelectTrigger>
                <SelectValue 
                  placeholder={
                    !selectedTrainee 
                      ? "Select Trainee First" 
                      : isTemplatesLoading 
                        ? "Loading templates..." 
                        : "Select Template"
                  } 
                />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((template: any) => (
                  <SelectItem key={template.id} value={template.id.toString()}>
                    {template.name}
                  </SelectItem>
                ))}
                {isTemplatesLoading && (
                  <SelectItem value="loading" disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </SelectItem>
                )}
                {!isTemplatesLoading && (!templates || templates.length === 0) && (
                  <SelectItem value="none" disabled>
                    No active templates found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {selectedTemplateDetails && (
        <div className="space-y-6">
          {selectedTemplateDetails.pillars.map((pillar: any) => (
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
                  {pillar.parameters.map((param: any) => (
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
                              onChange={(e) =>
                                handleScoreChange(param.id, e.target.value)
                              }
                            />
                          ) : (
                            <Select
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