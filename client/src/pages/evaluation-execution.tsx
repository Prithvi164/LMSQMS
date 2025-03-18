import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { evaluationApi } from "@/lib/api";
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

  // Fetch active batches
  const { data: batches = [], isLoading: isBatchesLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });

  // Fetch trainees for selected batch
  const { data: trainees = [], isLoading: isTraineesLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${selectedBatchId}/trainees`],
    enabled: !!selectedBatchId && !!user?.organizationId,
  });

  // Fetch evaluation templates
  const { data: templates = [], isLoading: isTemplatesLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
    enabled: !!user?.organizationId,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      batchId: undefined,
      traineeId: undefined,
      templateId: undefined,
    },
  });

  // Create evaluation mutation
  const createEvaluationMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user?.organizationId) {
        throw new Error('Organization ID is required');
      }
      return evaluationApi.initiateEvaluation({
        ...values,
        organizationId: user.organizationId
      });
    },
    onSuccess: (evaluation) => {
      toast({
        title: "Success",
        description: "Evaluation created successfully",
      });
      // Navigate to evaluation form
      window.location.href = `/evaluations/${evaluation.id}`;
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createEvaluationMutation.mutate(values);
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
                        form.setValue('traineeId', undefined);
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
                          <SelectItem value="_loading">Loading trainees...</SelectItem>
                        ) : trainees.length === 0 ? (
                          <SelectItem value="_empty">No trainees in this batch</SelectItem>
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
                {createEvaluationMutation.isPending ? "Creating..." : "Start Evaluation"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}