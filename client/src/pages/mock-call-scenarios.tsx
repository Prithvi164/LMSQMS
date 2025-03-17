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
import { InsertMockCallScenario } from "@shared/schema";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  difficulty: z.enum(["basic", "intermediate", "advanced"]),
  customerProfile: z.object({
    name: z.string().min(1, "Customer name is required"),
    background: z.string().min(1, "Background information is required"),
    personality: z.string().min(1, "Personality traits are required"),
    concerns: z.array(z.string()).min(1, "At least one concern is required"),
  }),
  expectedDialogue: z.object({
    greeting: z.string().min(1, "Greeting script is required"),
    keyPoints: z.array(z.string()).min(1, "At least one key point is required"),
    resolutions: z.array(z.string()).min(1, "At least one resolution is required"),
    closingStatements: z.array(z.string()).min(1, "At least one closing statement is required"),
  }),
  evaluationRubric: z.object({
    greetingScore: z.number().min(0).max(100),
    problemIdentificationScore: z.number().min(0).max(100),
    solutionScore: z.number().min(0).max(100),
    communicationScore: z.number().min(0).max(100),
    closingScore: z.number().min(0).max(100),
  }),
});

export default function MockCallScenariosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      difficulty: "basic",
      evaluationRubric: {
        greetingScore: 20,
        problemIdentificationScore: 20,
        solutionScore: 20,
        communicationScore: 20,
        closingScore: 20,
      },
    },
  });

  const { data: scenarios = [], isLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/mock-call-scenarios`],
    enabled: !!user?.organizationId,
  });

  const createScenarioMutation = useMutation({
    mutationFn: async (data: InsertMockCallScenario) => {
      const response = await fetch("/api/mock-call-scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to create scenario");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/mock-call-scenarios`],
      });
      toast({
        title: "Success",
        description: "Mock call scenario created successfully",
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

    createScenarioMutation.mutate({
      ...values,
      organizationId: user.organizationId,
      processId: 1, // TODO: Add process selection
      createdBy: user.id,
    });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "basic":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "intermediate":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "advanced":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      default:
        return "";
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Mock Call Scenarios</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create New Scenario</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Mock Call Scenario</DialogTitle>
              <DialogDescription>
                Define a new scenario for call center training and certification.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter scenario title" />
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
                          placeholder="Describe the scenario"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Difficulty Level</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select difficulty" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="intermediate">
                            Intermediate
                          </SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Add more form fields for customer profile, expected dialogue, etc. */}
                <Button type="submit" className="w-full">
                  Create Scenario
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {scenarios.map((scenario: any) => (
          <Card key={scenario.id}>
            <CardHeader>
              <CardTitle>{scenario.title}</CardTitle>
              <CardDescription>{scenario.description}</CardDescription>
              <Badge
                className={`${getDifficultyColor(
                  scenario.difficulty
                )} capitalize mt-2`}
              >
                {scenario.difficulty}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <strong>Customer Profile:</strong>
                  <p className="text-sm text-muted-foreground">
                    {scenario.customerProfile.name}
                  </p>
                </div>
                <div>
                  <strong>Key Points:</strong>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {scenario.expectedDialogue.keyPoints.map(
                      (point: string, index: number) => (
                        <li key={index}>{point}</li>
                      )
                    )}
                  </ul>
                </div>
                <Button className="w-full mt-4">Start Mock Call</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
