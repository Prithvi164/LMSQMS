import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PreviewForm } from "@/components/evaluation/preview-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export default function ConductEvaluation() {
  const { templateId } = useParams<{ templateId: string }>();
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedTrainee, setSelectedTrainee] = useState<string>("");

  // Fetch template data
  const { data: template, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ['/api/evaluation-templates', templateId],
    enabled: !!templateId,
  });

  // Fetch batches where this template's process is used
  const { data: batches, isLoading: isLoadingBatches } = useQuery({
    queryKey: ['/api/batches', templateId],
    enabled: !!templateId,
  });

  // Fetch trainees for selected batch
  const { data: trainees, isLoading: isLoadingTrainees } = useQuery({
    queryKey: ['/api/batches', selectedBatch, 'trainees'],
    enabled: !!selectedBatch,
  });

  if (isLoadingTemplate || isLoadingBatches) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-[200px]" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[150px]" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!template) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Template not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Conduct Evaluation</h1>

      <Card>
        <CardHeader>
          <CardTitle>Select Batch and Trainee</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Batch Selection */}
          <div className="space-y-2">
            <Label>Select Batch</Label>
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger>
                <SelectValue placeholder="Select a batch" />
              </SelectTrigger>
              <SelectContent>
                {batches?.map((batch: any) => (
                  <SelectItem key={batch.id} value={batch.id.toString()}>
                    {batch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trainee Selection */}
          {selectedBatch && (
            <div className="space-y-2">
              <Label>Select Trainee</Label>
              {isLoadingTrainees ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedTrainee} onValueChange={setSelectedTrainee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a trainee" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainees?.map((trainee: any) => (
                      <SelectItem key={trainee.id} value={trainee.id.toString()}>
                        {trainee.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Warning if no batches available */}
          {batches?.length === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No active batches found for this evaluation template.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Only show evaluation form when both batch and trainee are selected */}
      {selectedBatch && selectedTrainee && (
        <PreviewForm 
          template={template} 
          batchId={selectedBatch} 
          traineeId={selectedTrainee} 
        />
      )}
    </div>
  );
}