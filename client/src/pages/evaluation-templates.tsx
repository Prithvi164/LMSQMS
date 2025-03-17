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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { InsertEvaluationTemplate } from "@shared/schema";

// Form schema for creating a template
const formSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  processId: z.number().min(1, "Process is required"),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
});

export default function EvaluationTemplatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Fetch available processes
  const { data: processes = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/processes`],
    enabled: !!user?.organizationId,
  });

  // Fetch evaluation templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
    enabled: !!user?.organizationId,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: "draft",
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: InsertEvaluationTemplate) => {
      const response = await fetch("/api/evaluation-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create template");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
      });
      toast({
        title: "Success",
        description: "Evaluation template created successfully",
      });
      setIsCreateDialogOpen(false);
      form.reset();
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
    if (!user?.organizationId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Organization ID is required",
      });
      return;
    }

    createTemplateMutation.mutate({
      ...values,
      organizationId: user.organizationId,
      createdBy: user.id,
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Evaluation Templates</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create New Template</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Evaluation Template</DialogTitle>
              <DialogDescription>
                Create a template for evaluating trainee performance.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter template name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Describe the evaluation template"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="processId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Process</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select process" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {processes.map((process: any) => (
                            <SelectItem key={process.id} value={process.id.toString()}>
                              {process.name}
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createTemplateMutation.isPending}
                >
                  {createTemplateMutation.isPending
                    ? "Creating..."
                    : "Create Template"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <p>Loading templates...</p>
        ) : templates.length === 0 ? (
          <p>No templates available. Create your first template to get started.</p>
        ) : (
          templates.map((template: any) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle>{template.name}</CardTitle>
                <CardDescription>{template.description}</CardDescription>
                <Badge
                  variant={
                    template.status === "active"
                      ? "default"
                      : template.status === "draft"
                      ? "secondary"
                      : "destructive"
                  }
                  className="mt-2"
                >
                  {template.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Edit Template</Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}