import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Form schema for pillars
const pillarSchema = z.object({
  name: z.string().min(1, "Pillar name is required"),
  description: z.string().optional(),
  weightage: z.number().min(0).max(100, "Weightage must be between 0 and 100"),
});

// Form schema for parameters
const parameterSchema = z.object({
  name: z.string().min(1, "Parameter name is required"),
  description: z.string().optional(),
  guidelines: z.string().optional(),
  ratingType: z.enum(["yes_no_na", "numeric", "custom"]),
  weightage: z.number().min(0).max(100),
  isFatal: z.boolean().default(false),
  requiresComment: z.boolean().default(false),
  customRatingOptions: z.array(z.string()).optional(),
});

type FormBuilderProps = {
  templateId: number;
};

export function FormBuilder({ templateId }: FormBuilderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activePillarId, setActivePillarId] = useState<number | null>(null);
  const [selectedParameter, setSelectedParameter] = useState<number | null>(null);

  // Fetch template details
  const { data: template } = useQuery({
    queryKey: [`/api/evaluation-templates/${templateId}`],
    enabled: !!templateId,
  });

  const pillarForm = useForm<z.infer<typeof pillarSchema>>({
    resolver: zodResolver(pillarSchema),
    defaultValues: {
      weightage: 0,
    },
  });

  const parameterForm = useForm<z.infer<typeof parameterSchema>>({
    resolver: zodResolver(parameterSchema),
    defaultValues: {
      ratingType: "yes_no_na",
      weightage: 0,
      isFatal: false,
      requiresComment: false,
    },
  });

  const createPillarMutation = useMutation({
    mutationFn: async (data: z.infer<typeof pillarSchema>) => {
      const response = await fetch(`/api/evaluation-templates/${templateId}/pillars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          templateId,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create pillar");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/evaluation-templates/${templateId}`],
      });
      toast({
        title: "Success",
        description: "Pillar created successfully",
      });
      pillarForm.reset();
      setActivePillarId(data.id);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const createParameterMutation = useMutation({
    mutationFn: async (data: z.infer<typeof parameterSchema>) => {
      if (!activePillarId) throw new Error("No pillar selected");

      const response = await fetch(`/api/evaluation-pillars/${activePillarId}/parameters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          pillarId: activePillarId,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create parameter");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/evaluation-templates/${templateId}`],
      });
      toast({
        title: "Success",
        description: "Parameter created successfully",
      });
      parameterForm.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const onPillarSubmit = (values: z.infer<typeof pillarSchema>) => {
    createPillarMutation.mutate(values);
  };

  const onParameterSubmit = (values: z.infer<typeof parameterSchema>) => {
    createParameterMutation.mutate(values);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add Pillar Form */}
        <Card>
          <CardHeader>
            <CardTitle>Add Evaluation Pillar</CardTitle>
            <CardDescription>Create a new category for evaluation</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...pillarForm}>
              <form onSubmit={pillarForm.handleSubmit(onPillarSubmit)} className="space-y-4">
                <FormField
                  control={pillarForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pillar Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Customer Service Skills" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={pillarForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Describe this evaluation pillar" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={pillarForm.control}
                  name="weightage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weightage (%)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          max="100"
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createPillarMutation.isPending}
                >
                  {createPillarMutation.isPending ? "Creating..." : "Add Pillar"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Add Parameter Form */}
        <Card>
          <CardHeader>
            <CardTitle>Add Evaluation Parameter</CardTitle>
            <CardDescription>Add specific criteria to evaluate</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...parameterForm}>
              <form onSubmit={parameterForm.handleSubmit(onParameterSubmit)} className="space-y-4">
                <FormField
                  control={parameterForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parameter Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Greeting Standard" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={parameterForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Describe this parameter" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={parameterForm.control}
                  name="guidelines"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Evaluation Guidelines</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Instructions for evaluators" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={parameterForm.control}
                  name="ratingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rating Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select rating type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="yes_no_na">Yes/No/NA</SelectItem>
                          <SelectItem value="numeric">Numeric (1-5)</SelectItem>
                          <SelectItem value="custom">Custom Options</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={parameterForm.control}
                  name="weightage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weightage (%)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          max="100"
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-4">
                  <FormField
                    control={parameterForm.control}
                    name="isFatal"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Fatal Error</FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={parameterForm.control}
                    name="requiresComment"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Requires Comment</FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createParameterMutation.isPending || !activePillarId}
                >
                  {createParameterMutation.isPending
                    ? "Creating..."
                    : !activePillarId
                    ? "Select a Pillar First"
                    : "Add Parameter"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Display existing pillars and parameters */}
      {template?.pillars && template.pillars.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Current Form Structure</h2>
          {template.pillars.map((pillar: any) => (
            <Card
              key={pillar.id}
              className={`${
                activePillarId === pillar.id ? "ring-2 ring-primary" : ""
              } cursor-pointer hover:bg-accent/5 transition-colors`}
              onClick={() => setActivePillarId(pillar.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{pillar.name}</CardTitle>
                  <Badge>{pillar.weightage}%</Badge>
                </div>
                {pillar.description && (
                  <p className="text-sm text-muted-foreground">{pillar.description}</p>
                )}
              </CardHeader>
              <CardContent>
                {pillar.parameters && pillar.parameters.length > 0 ? (
                  <div className="space-y-2">
                    {pillar.parameters.map((param: any) => (
                      <div
                        key={param.id}
                        className={`p-3 bg-muted rounded-lg flex items-center justify-between ${
                          selectedParameter === param.id ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedParameter(param.id);
                        }}
                      >
                        <div>
                          <p className="font-medium">{param.name}</p>
                          {param.description && (
                            <p className="text-sm text-muted-foreground">
                              {param.description}
                            </p>
                          )}
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline">{param.ratingType}</Badge>
                            <Badge variant="outline">{param.weightage}%</Badge>
                            {param.isFatal && (
                              <Badge variant="destructive">Fatal</Badge>
                            )}
                            {param.requiresComment && (
                              <Badge variant="secondary">Requires Comment</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No parameters added yet. Click "Add Parameter" to get started.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}