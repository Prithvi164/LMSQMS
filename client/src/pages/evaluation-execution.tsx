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
import {
  Form,
  FormControl,
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";

// Type definitions for API responses
interface Batch {
  id: number;
  name: string;
}

interface Trainee {
  id: number;  // This is the user_batch_process.id
  userId: number;
  user: {
    id: number;
    fullName: string;
    email: string;
    employeeId: string;
    phoneNumber: string;
    dateOfJoining: string;
  };
}

interface Template {
  id: number;
  name: string;
  description?: string;
}

// Form schema for starting an evaluation
const formSchema = z.object({
  batchId: z.number().min(1, "Batch is required"),
  traineeId: z.number().min(1, "Trainee is required").nullable(),
  templateId: z.number().min(1, "Evaluation template is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function EvaluationExecutionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  // Fetch active batches
  const { data: batches = [], isLoading: isBatchesLoading } = useQuery<Batch[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });

  // Fetch trainees for selected batch
  const { data: trainees = [], isLoading: isTraineesLoading } = useQuery<Trainee[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${selectedBatchId}/trainees`],
    enabled: !!selectedBatchId && !!user?.organizationId,
  });

  // Fetch evaluation templates
  const { data: templates = [], isLoading: isTemplatesLoading } = useQuery<Template[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
    enabled: !!user?.organizationId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      batchId: undefined,
      traineeId: null,
      templateId: undefined,
    },
  });

  // Create evaluation mutation
  const createEvaluationMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      console.log('Starting evaluation with values:', values);

      // Find the trainee object for the selected traineeId
      const selectedTrainee = trainees.find(trainee => trainee.id === values.traineeId);
      if (!selectedTrainee) {
        throw new Error('Selected trainee not found');
      }

      const payload = {
        batchId: values.batchId,
        traineeId: selectedTrainee.id, // Using the user_batch_process.id
        templateId: values.templateId,
        evaluatorId: user?.id,
      };

      console.log('Sending payload:', payload);

      const response = await fetch(`/api/organizations/${user?.organizationId}/evaluations/start`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error('Error response text:', text);
        throw new Error(`Failed to start evaluation (${response.status})`);
      }

      try {
        const data = await response.json();
        if (!data || !data.id) {
          throw new Error('Invalid response format');
        }
        return data;
      } catch (error) {
        console.error('Response parsing error:', error);
        throw new Error('Failed to parse server response');
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Evaluation started successfully",
      });
      // Navigate to evaluation form
      window.location.href = `/evaluations/${data.id}`;
    },
    onError: (error: Error) => {
      console.error('Evaluation creation error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    console.log('Form submitted with values:', values);
    createEvaluationMutation.mutate(values);
  };

  if (isTemplatesLoading || isBatchesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Start New Evaluation</CardTitle>
          <CardDescription>
            Select a trainee and evaluation template to begin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="batchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Batch</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        const batchId = parseInt(value);
                        field.onChange(batchId);
                        setSelectedBatchId(batchId);
                        // Reset trainee selection when batch changes
                        form.setValue('traineeId', null);
                      }}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a batch" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isBatchesLoading ? (
                          <SelectItem value="_loading">Loading batches...</SelectItem>
                        ) : batches.length === 0 ? (
                          <SelectItem value="_empty">No batches available</SelectItem>
                        ) : (
                          batches.map((batch) => (
                            <SelectItem
                              key={batch.id}
                              value={batch.id.toString()}
                            >
                              {batch.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="traineeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Trainee</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString() || ""}
                      disabled={!selectedBatchId || isTraineesLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isTraineesLoading ? "Loading trainees..." : "Select a trainee"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isTraineesLoading ? (
                          <SelectItem value="_loading">Loading trainees...</SelectItem>
                        ) : trainees.length === 0 ? (
                          <SelectItem value="_empty">No trainees in this batch</SelectItem>
                        ) : (
                          trainees.map((trainee) => (
                            <SelectItem
                              key={trainee.id}
                              value={trainee.id.toString()}
                            >
                              {trainee.user.fullName}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="templateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Evaluation Template</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isTemplatesLoading ? "Loading templates..." : "Select a template"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isTemplatesLoading ? (
                          <SelectItem value="_loading">Loading templates...</SelectItem>
                        ) : templates.length === 0 ? (
                          <SelectItem value="_empty">No templates available</SelectItem>
                        ) : (
                          templates.map((template) => (
                            <SelectItem
                              key={template.id}
                              value={template.id.toString()}
                            >
                              {template.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full"
                disabled={createEvaluationMutation.isPending}
              >
                {createEvaluationMutation.isPending ? "Starting..." : "Start Evaluation"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}