import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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

// Form schema for starting an evaluation
const formSchema = z.object({
  batchId: z.number().min(1, "Batch is required"),
  traineeId: z.number().min(1, "Trainee is required"),
  templateId: z.number().min(1, "Evaluation template is required"),
});

type FormValues = z.infer<typeof formSchema>;

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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      batchId: undefined,
      traineeId: undefined,
      templateId: undefined,
    },
  });

  // Create evaluation mutation
  const createEvaluationMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!user?.organizationId) {
        throw new Error("Organization ID is required");
      }

      const payload = {
        batchId: values.batchId,
        traineeId: values.traineeId,
        templateId: values.templateId,
        evaluatorId: user.id,
      };

      console.log("Starting evaluation with values:", values);

      try {
        // Add the /api/ prefix to the URL
        const response = await apiRequest(`/api/organizations/${user.organizationId}/evaluations/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response || typeof response.id !== "number") {
          throw new Error("Invalid response format");
        }

        return response;
      } catch (error) {
        console.error("Evaluation creation error:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to create evaluation");
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Evaluation started successfully",
      });
      window.location.href = `/evaluations/${data.id}`;
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to start evaluation",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    createEvaluationMutation.mutate(values);
  };

  if (isBatchesLoading || isTraineesLoading || isTemplatesLoading) {
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
                        form.setValue("traineeId", undefined);
                      }}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a batch" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {batches.map((batch) => (
                          <SelectItem
                            key={batch.id}
                            value={batch.id.toString()}
                          >
                            {batch.name}
                          </SelectItem>
                        ))}
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
                      disabled={!selectedBatchId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={!selectedBatchId ? "Select a batch first" : "Select a trainee"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trainees.map((trainee) => (
                          <SelectItem
                            key={trainee.id}
                            value={trainee.id.toString()}
                          >
                            {trainee.user.fullName}
                          </SelectItem>
                        ))}
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
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem
                            key={template.id}
                            value={template.id.toString()}
                          >
                            {template.name}
                          </SelectItem>
                        ))}
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