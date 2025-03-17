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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { InsertEvaluationForm } from "@shared/schema";

// Form schemas for each step
const segmentSchema = z.object({
  name: z.string().min(1, "Segment name is required"),
  description: z.string().optional(),
  weight: z.number().min(0).max(100, "Weight must be between 0 and 100"),
  parameters: z.array(z.object({
    name: z.string().min(1, "Parameter name is required"),
    description: z.string().optional(),
    weight: z.number().min(0).max(100),
    isFatal: z.boolean().default(false),
  })).min(1, "At least one parameter is required"),
});

const reasonSchema = z.object({
  category: z.string().min(1, "Category is required"),
  reason: z.string().min(1, "Reason is required"),
});

const formSchema = z.object({
  name: z.string().min(1, "Form name is required"),
  description: z.string().optional(),
  processId: z.number().min(1, "Process is required"),
  batchId: z.number().min(1, "Batch is required"),
  segments: z.array(segmentSchema).min(1, "At least one segment is required"),
  predefinedReasons: z.array(reasonSchema),
  isTemplate: z.boolean().default(false),
});

export default function EvaluationFormBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [segments, setSegments] = useState<z.infer<typeof segmentSchema>[]>([]);
  const [reasons, setReasons] = useState<z.infer<typeof reasonSchema>[]>([]);

  // Fetch available processes
  const { data: processes = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/processes`],
    enabled: !!user?.organizationId,
  });

  // Fetch batches based on selected process
  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      processId: 0,
      batchId: 0,
      segments: [],
      predefinedReasons: [],
      isTemplate: false,
    },
  });

  const createFormMutation = useMutation({
    mutationFn: async (data: InsertEvaluationForm) => {
      const response = await fetch("/api/evaluation-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create evaluation form");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/evaluation-forms`],
      });
      toast({
        title: "Success",
        description: "Evaluation form created successfully",
      });
      form.reset();
      setCurrentStep(0);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const steps = [
    {
      title: "Basic Information",
      description: "Select process and batch",
      fields: (
        <div className="space-y-4">
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
            name="batchId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  defaultValue={field.value?.toString()}
                  disabled={!form.watch("processId")}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {batches.map((batch: any) => (
                      <SelectItem key={batch.id} value={batch.id.toString()}>
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Form Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter form name" />
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
                  <Textarea {...field} placeholder="Enter form description" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      ),
    },
    {
      title: "Evaluation Segments",
      description: "Add segments and parameters",
      component: <SegmentBuilder segments={segments} onUpdate={setSegments} />,
    },
    {
      title: "Predefined Reasons",
      description: "Configure evaluation reasons",
      component: <ReasonBuilder reasons={reasons} onUpdate={setReasons} />,
    },
    {
      title: "Review & Save",
      description: "Review and save your form",
      component: (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="isTemplate"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <div>
                  <FormLabel>Save as Template</FormLabel>
                  <FormDescription>
                    Make this form available as a template for other QAs
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <Card>
            <CardHeader>
              <CardTitle>Form Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Segments</h4>
                  <ul className="list-disc list-inside mt-2">
                    {segments.map((segment, index) => (
                      <li key={index}>
                        {segment.name} ({segment.weight}%)
                        <ul className="list-circle list-inside ml-4">
                          {segment.parameters.map((param, pIndex) => (
                            <li key={pIndex}>
                              {param.name} ({param.weight}%)
                              {param.isFatal && (
                                <Badge variant="destructive" className="ml-2">
                                  Fatal
                                </Badge>
                              )}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium">Predefined Reasons</h4>
                  <ul className="list-disc list-inside mt-2">
                    {reasons.map((reason, index) => (
                      <li key={index}>
                        {reason.category}: {reason.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
  ];

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!user?.organizationId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Organization ID is required",
      });
      return;
    }

    createFormMutation.mutate({
      ...values,
      organizationId: user.organizationId,
      createdBy: user.id,
      segments: segments,
      predefinedReasons: reasons,
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Evaluation Form Builder</h1>
        <p className="text-muted-foreground">
          Create evaluation forms for quality assessment
        </p>
      </div>

      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`flex items-center ${
              index < steps.length - 1 ? "flex-1" : ""
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep >= index
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {index + 1}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-1 flex-1 mx-4 ${
                  currentStep > index ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{steps[currentStep].title}</CardTitle>
              <CardDescription>
                {steps[currentStep].description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {steps[currentStep].fields || steps[currentStep].component}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
            >
              Previous
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={createFormMutation.isPending}
              >
                {createFormMutation.isPending ? "Creating..." : "Create Form"}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}

function SegmentBuilder({
  segments,
  onUpdate,
}: {
  segments: z.infer<typeof segmentSchema>[];
  onUpdate: (segments: z.infer<typeof segmentSchema>[]) => void;
}) {
  const [currentSegment, setCurrentSegment] = useState<z.infer<typeof segmentSchema> | null>(null);

  const segmentForm = useForm<z.infer<typeof segmentSchema>>({
    resolver: zodResolver(segmentSchema),
    defaultValues: {
      name: "",
      weight: 0,
      parameters: [],
    },
  });

  const addSegment = (data: z.infer<typeof segmentSchema>) => {
    onUpdate([...segments, data]);
    segmentForm.reset();
    setCurrentSegment(null);
  };

  return (
    <div className="space-y-4">
      {segments.map((segment, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle className="flex justify-between">
              <span>{segment.name}</span>
              <Badge>{segment.weight}%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {segment.parameters.map((param, pIndex) => (
                <li key={pIndex} className="flex items-center justify-between">
                  <span>{param.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{param.weight}%</Badge>
                    {param.isFatal && (
                      <Badge variant="destructive">Fatal</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setCurrentSegment({})}
      >
        Add Segment
      </Button>

      {currentSegment && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Segment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={segmentForm.handleSubmit(addSegment)} className="space-y-4">
              <FormField
                control={segmentForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Segment Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter segment name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={segmentForm.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Add parameter fields dynamically */}
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReasonBuilder({
  reasons,
  onUpdate,
}: {
  reasons: z.infer<typeof reasonSchema>[];
  onUpdate: (reasons: z.infer<typeof reasonSchema>[]) => void;
}) {
  const reasonForm = useForm<z.infer<typeof reasonSchema>>({
    resolver: zodResolver(reasonSchema),
    defaultValues: {
      category: "",
      reason: "",
    },
  });

  const addReason = (data: z.infer<typeof reasonSchema>) => {
    onUpdate([...reasons, data]);
    reasonForm.reset();
  };

  return (
    <div className="space-y-4">
      {reasons.map((reason, index) => (
        <Card key={index}>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <Badge className="mb-1">{reason.category}</Badge>
              <p className="text-sm">{reason.reason}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdate(reasons.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Add New Reason</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={reasonForm.handleSubmit(addReason)} className="space-y-4">
            <FormField
              control={reasonForm.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter category" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={reasonForm.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter reason" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Add Reason</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
