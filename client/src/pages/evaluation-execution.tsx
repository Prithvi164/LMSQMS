import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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

// Type definitions for API responses
interface Batch {
  id: number;
  name: string;
}

interface Trainee {
  userId: number;
  status: string;
  user: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    category: string;
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
  traineeId: z.number().min(1, "Trainee is required"),
  templateId: z.number().min(1, "Evaluation template is required"),
});

export default function EvaluationExecutionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      batchId: 0,
      traineeId: 0,
      templateId: 0,
    },
  });

  // Create evaluation mutation
  const createEvaluationMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const response = await fetch(`/api/organizations/${user?.organizationId}/evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          evaluatorId: user?.id,
          organizationId: user?.organizationId,
          evaluatedAt: new Date().toISOString(),
          totalScore: 0
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create evaluation");
      }

      return response.json();
    },
    onSuccess: (evaluation) => {
      toast({
        title: "Success",
        description: "Evaluation created successfully",
      });
      // Use window.location.href for navigation after toast is shown
      setTimeout(() => {
        window.location.href = `/evaluations/${evaluation.id}`;
      }, 1500);
    },
    onError: (error: Error) => {
      setIsSubmitting(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user?.organizationId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Organization ID is required",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createEvaluationMutation.mutateAsync(values);
    } catch (error) {
      console.error("Error in form submission:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

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
                        form.setValue('traineeId', 0, { shouldValidate: true });
                      }}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isBatchesLoading ? "Loading batches..." : "Select a batch"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isBatchesLoading ? (
                          <SelectItem value="_loading" disabled>Loading batches...</SelectItem>
                        ) : batches.length === 0 ? (
                          <SelectItem value="_empty" disabled>No batches available</SelectItem>
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
                      value={field.value?.toString()}
                      disabled={!selectedBatchId || isTraineesLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isTraineesLoading ? "Loading trainees..." : "Select a trainee"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isTraineesLoading ? (
                          <SelectItem value="_loading" disabled>Loading trainees...</SelectItem>
                        ) : trainees.length === 0 ? (
                          <SelectItem value="_empty" disabled>No trainees in this batch</SelectItem>
                        ) : (
                          trainees.map((trainee) => (
                            <SelectItem
                              key={trainee.userId}
                              value={trainee.user.id.toString()}
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
                          <SelectItem value="_loading" disabled>Loading templates...</SelectItem>
                        ) : templates.length === 0 ? (
                          <SelectItem value="_empty" disabled>No templates available</SelectItem>
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
                disabled={isSubmitting || createEvaluationMutation.isPending}
              >
                {isSubmitting ? "Creating..." : "Start Evaluation"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}