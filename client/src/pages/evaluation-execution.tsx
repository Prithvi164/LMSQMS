import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const { data: batches = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });

  // Fetch trainees for selected batch
  const { data: trainees = [] } = useQuery({
    queryKey: [`/api/batches/${selectedBatchId}/trainees`],
    enabled: !!selectedBatchId,
  });

  // Fetch evaluation templates
  const { data: templates = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
    enabled: !!user?.organizationId,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const response = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          evaluatorId: user?.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start evaluation");
      }

      const evaluation = await response.json();
      
      // Navigate to evaluation form
      window.location.href = `/evaluations/${evaluation.id}`;

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
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
                        field.onChange(parseInt(value));
                        setSelectedBatchId(parseInt(value));
                      }}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a batch" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {batches.map((batch: any) => (
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
                      defaultValue={field.value?.toString()}
                      disabled={!selectedBatchId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a trainee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trainees.map((trainee: any) => (
                          <SelectItem
                            key={trainee.id}
                            value={trainee.id.toString()}
                          >
                            {trainee.name}
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
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templates.map((template: any) => (
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

              <Button type="submit" className="w-full">
                Start Evaluation
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
