import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { InsertEvaluationSession, InsertEvaluationResult } from "@shared/schema";

export default function ConductEvaluationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [evaluationInProgress, setEvaluationInProgress] = useState(false);

  // Fetch active templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates/active`],
    enabled: !!user?.organizationId,
  });

  // Fetch trainees
  const { data: trainees = [], isLoading: traineesLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/trainees`],
    enabled: !!user?.organizationId,
  });

  const startEvaluationMutation = useMutation({
    mutationFn: async (data: InsertEvaluationSession) => {
      const response = await fetch("/api/evaluation-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to start evaluation");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/evaluation-sessions`],
      });
      toast({
        title: "Success",
        description: "Evaluation session started successfully",
      });
      setEvaluationInProgress(true);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const submitEvaluationMutation = useMutation({
    mutationFn: async ({
      sessionId,
      results,
    }: {
      sessionId: number;
      results: InsertEvaluationResult[];
    }) => {
      const response = await fetch(`/api/evaluation-sessions/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit evaluation");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/evaluation-sessions`],
      });
      toast({
        title: "Success",
        description: "Evaluation submitted successfully",
      });
      setEvaluationInProgress(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleStartEvaluation = (template: any, traineeId: number) => {
    if (!user?.organizationId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Organization ID is required",
      });
      return;
    }

    startEvaluationMutation.mutate({
      templateId: template.id,
      evaluatorId: user.id,
      traineeId,
      organizationId: user.organizationId,
      status: "in_progress",
      startedAt: new Date(),
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Conduct Evaluation</h1>
        <p className="text-muted-foreground">
          Select a template and trainee to start an evaluation
        </p>
      </div>

      {!evaluationInProgress ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templatesLoading ? (
            <p>Loading templates...</p>
          ) : templates.length === 0 ? (
            <p>No active templates available.</p>
          ) : (
            templates.map((template: any) => (
              <Card
                key={template.id}
                className={`cursor-pointer ${
                  selectedTemplate?.id === template.id ? "border-primary" : ""
                }`}
                onClick={() => setSelectedTemplate(template)}
              >
                <CardHeader>
                  <CardTitle>{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedTemplate?.id === template.id && (
                      <div>
                        <FormField
                          name="traineeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Select Trainee</FormLabel>
                              <Select
                                onValueChange={(value) =>
                                  handleStartEvaluation(template, parseInt(value))
                                }
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose trainee" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {trainees.map((trainee: any) => (
                                    <SelectItem
                                      key={trainee.id}
                                      value={trainee.id.toString()}
                                    >
                                      {trainee.fullName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Evaluation in Progress</h2>
          {/* Evaluation form will be implemented here */}
        </div>
      )}
    </div>
  );
}
