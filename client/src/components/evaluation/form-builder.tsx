import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
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
import { Trash2, Plus, ChevronDown, ChevronUp, Eye, Check, Edit2, GripVertical } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PreviewForm } from "./preview-form";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

// Form schemas
const pillarSchema = z.object({
  name: z.string().min(1, "Pillar name is required"),
  description: z.string().optional(),
  weightage: z.number().min(0).max(100, "Weightage must be between 0 and 100"),
});

const parameterSchema = z.object({
  name: z.string().min(1, "Parameter name is required"),
  description: z.string().optional(),
  guidelines: z.string().optional(),
  ratingType: z.enum(["yes_no_na", "numeric", "custom"]),
  weightage: z.number().min(0).max(100),
  isFatal: z.boolean().default(false),
  requiresComment: z.boolean().default(false),
  noReasons: z.array(z.string()).optional(),
  customRatingOptions: z.array(z.string()).optional(),
});

type FormBuilderProps = {
  templateId: number;
};

function SortableItem({ id, children, className }: { id: number; children: React.ReactNode; className?: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={className}>
      <div {...attributes} {...listeners} className="cursor-grab">
        {children}
      </div>
    </div>
  );
}

export function FormBuilder({ templateId }: FormBuilderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activePillarId, setActivePillarId] = useState<number | null>(null);
  const [selectedParameter, setSelectedParameter] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [noReasons, setNoReasons] = useState<string[]>([]);
  const [newReason, setNewReason] = useState("");
  const [isEditingPillar, setIsEditingPillar] = useState(false);
  const [isEditingParameter, setIsEditingParameter] = useState(false);
  const [pillars, setPillars] = useState<any[]>([]);

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
      noReasons: [],
    },
  });

  // Effect to populate form when editing
  useEffect(() => {
    if (isEditingPillar && activePillarId && template?.pillars) {
      const pillar = template.pillars.find((p: any) => p.id === activePillarId);
      if (pillar) {
        pillarForm.reset({
          name: pillar.name,
          description: pillar.description,
          weightage: pillar.weightage,
        });
      }
    }
  }, [isEditingPillar, activePillarId, template]);

  useEffect(() => {
    if (isEditingParameter && selectedParameter && template?.pillars) {
      const parameter = template.pillars
        .flatMap((p: any) => p.parameters)
        .find((param: any) => param.id === selectedParameter);
      if (parameter) {
        parameterForm.reset({
          name: parameter.name,
          description: parameter.description,
          guidelines: parameter.guidelines,
          ratingType: parameter.ratingType,
          weightage: parameter.weightage,
          isFatal: parameter.isFatal,
          requiresComment: parameter.requiresComment,
        });
        setNoReasons(parameter.noReasons || []);
      }
    }
  }, [isEditingParameter, selectedParameter, template]);

  // Mutations
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

  const updatePillarMutation = useMutation({
    mutationFn: async (data: { id: number; pillar: z.infer<typeof pillarSchema> }) => {
      const response = await fetch(`/api/evaluation-pillars/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.pillar),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update pillar");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/evaluation-templates/${templateId}`],
      });
      toast({
        title: "Success",
        description: "Pillar updated successfully",
      });
      setIsEditingPillar(false);
      pillarForm.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const updateParameterMutation = useMutation({
    mutationFn: async (data: { id: number; parameter: z.infer<typeof parameterSchema> }) => {
      const response = await fetch(`/api/evaluation-parameters/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data.parameter,
          noReasons: noReasons,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update parameter");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/evaluation-templates/${templateId}`],
      });
      toast({
        title: "Success",
        description: "Parameter updated successfully",
      });
      setIsEditingParameter(false);
      parameterForm.reset();
      setNoReasons([]);
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
          noReasons: noReasons,
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
      setNoReasons([]);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deletePillarMutation = useMutation({
    mutationFn: async (pillarId: number) => {
      const response = await fetch(`/api/evaluation-pillars/${pillarId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete pillar");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/evaluation-templates/${templateId}`],
      });
      toast({
        title: "Success",
        description: "Pillar deleted successfully",
      });
      setActivePillarId(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteParameterMutation = useMutation({
    mutationFn: async (parameterId: number) => {
      const response = await fetch(`/api/evaluation-parameters/${parameterId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete parameter");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/evaluation-templates/${templateId}`],
      });
      toast({
        title: "Success",
        description: "Parameter deleted successfully",
      });
      setSelectedParameter(null);
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
    if (isEditingPillar && activePillarId) {
      updatePillarMutation.mutate({ id: activePillarId, pillar: values });
    } else {
      createPillarMutation.mutate(values);
    }
  };

  const onParameterSubmit = (values: z.infer<typeof parameterSchema>) => {
    if (isEditingParameter && selectedParameter) {
      updateParameterMutation.mutate({
        id: selectedParameter,
        parameter: { ...values, noReasons },
      });
    } else {
      createParameterMutation.mutate({
        ...values,
        noReasons,
      });
    }
  };

  const addReason = () => {
    if (newReason.trim()) {
      setNoReasons([...noReasons, newReason.trim()]);
      setNewReason("");
    }
  };

  const removeReason = (index: number) => {
    setNoReasons(noReasons.filter((_, i) => i !== index));
  };

  const finalizeForm = async () => {
    try {
      await fetch(`/api/evaluation-templates/${templateId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      toast({
        title: "Success",
        description: "Form finalized successfully",
      });

      // Refresh the template data
      queryClient.invalidateQueries({
        queryKey: [`/api/evaluation-templates/${templateId}`],
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to finalize form",
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (template?.pillars) {
      setPillars(template.pillars);
    }
  }, [template]);

  // Add handleDragEnd function
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pillars.findIndex((pillar) => pillar.id === active.id);
    const newIndex = pillars.findIndex((pillar) => pillar.id === over.id);

    const newPillars = arrayMove(pillars, oldIndex, newIndex);
    setPillars(newPillars);

    try {
      await fetch(`/api/evaluation-templates/${templateId}/reorder-pillars`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pillarIds: newPillars.map((p) => p.id),
        }),
      });

      queryClient.invalidateQueries({
        queryKey: [`/api/evaluation-templates/${templateId}`],
      });
    } catch (error) {
      console.error("Failed to reorder pillars:", error);
      setPillars(template?.pillars || []);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Form Builder</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
            className="flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            {previewMode ? "Exit Preview" : "Preview Form"}
          </Button>
          {previewMode && (
            <Button onClick={finalizeForm} className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              Create Form
            </Button>
          )}
        </div>
      </div>

      {previewMode ? (
        <Card>
          <CardHeader>
            <CardTitle>Form Preview</CardTitle>
            <CardDescription>Preview how the form will appear to evaluators</CardDescription>
          </CardHeader>
          <CardContent>
            <PreviewForm template={template} />
          </CardContent>
        </Card>
      ) : (
        <ResizablePanelGroup direction="horizontal">
          {/* Form Structure Panel */}
          <ResizablePanel defaultSize={25} minSize={20}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Form Structure</CardTitle>
                <CardDescription>Drag to reorder pillars and parameters</CardDescription>
              </CardHeader>
              <CardContent>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={pillars.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4">
                      {pillars.map((pillar) => (
                        <SortableItem key={pillar.id} id={pillar.id}>
                          <div
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              activePillarId === pillar.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                            }`}
                            onClick={() => setActivePillarId(pillar.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 cursor-grab" />
                                <span className="font-medium">{pillar.name}</span>
                                <Badge variant="outline">{pillar.weightage}%</Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingPillar(true);
                                    setActivePillarId(pillar.id);
                                  }}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deletePillarMutation.mutate(pillar.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Parameters under this pillar */}
                          {pillar.parameters && pillar.parameters.length > 0 && (
                            <div className="ml-4 space-y-2 mt-2">
                              <SortableContext
                                items={pillar.parameters.map((p: any) => p.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {pillar.parameters.map((param: any) => (
                                  <SortableItem key={param.id} id={param.id}>
                                    <div
                                      className={`p-2 rounded cursor-pointer transition-colors ${
                                        selectedParameter === param.id
                                          ? "bg-accent text-accent-foreground"
                                          : "hover:bg-accent/50"
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedParameter(param.id);
                                      }}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <GripVertical className="h-4 w-4 cursor-grab" />
                                          <span className="text-sm">{param.name}</span>
                                          <Badge variant="outline" className="text-xs">
                                            {param.weightage}%
                                          </Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setIsEditingParameter(true);
                                              setSelectedParameter(param.id);
                                            }}
                                          >
                                            <Edit2 className="h-4 w-4" />
                                          </Button>
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                }}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Parameter?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  This will permanently delete this parameter and its data. This action cannot be undone.
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                  onClick={() => {
                                                    deleteParameterMutation.mutate(param.id);
                                                  }}
                                                >
                                                  Delete
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        </div>
                                      </div>
                                    </div>
                                  </SortableItem>
                                ))}
                              </SortableContext>
                            </div>
                          )}
                        </SortableItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          </ResizablePanel>
          <ResizableHandle />
          {/* Form Builder Panel */}
          <ResizablePanel defaultSize={75}>
            {!previewMode ? (
              <div className="space-y-6">
                {/* Add/Edit Pillar Form */}
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {isEditingPillar ? "Edit Pillar" : "Add Evaluation Pillar"}
                    </CardTitle>
                    <CardDescription>
                      {isEditingPillar
                        ? "Modify the selected pillar"
                        : "Create a new category for evaluation"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...pillarForm}>
                      <form
                        onSubmit={pillarForm.handleSubmit(onPillarSubmit)}
                        className="space-y-4"
                      >
                        <FormField
                          control={pillarForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pillar Name</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="e.g., Customer Service Skills"
                                />
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
                                <Textarea
                                  {...field}
                                  placeholder="Describe this evaluation pillar"
                                />
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
                                  onChange={(e) =>
                                    field.onChange(parseInt(e.target.value))
                                  }
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
                          <Plus className="w-4 h-4 mr-2" />
                          {isEditingPillar
                            ? updatePillarMutation.isPending
                              ? "Updating..."
                              : "Update Pillar"
                            : createPillarMutation.isPending
                            ? "Creating..."
                            : "Add Pillar"}
                        </Button>
                        {isEditingPillar && (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setIsEditingPillar(false);
                              pillarForm.reset();
                            }}
                          >
                            Cancel Edit
                          </Button>
                        )}
                      </form>
                    </Form>
                  </CardContent>
                </Card>

                {/* Add/Edit Parameter Form */}
                {activePillarId && (
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        {isEditingParameter ? "Edit Parameter" : "Add Evaluation Parameter"}
                      </CardTitle>
                      <CardDescription>
                        {isEditingParameter
                          ? "Modify the selected parameter"
                          : "Add specific criteria to evaluate"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...parameterForm}>
                        <form
                          onSubmit={parameterForm.handleSubmit(onParameterSubmit)}
                          className="space-y-4"
                        >
                          <FormField
                            control={parameterForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Parameter Name</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="e.g., Greeting Standard"
                                  />
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
                                  <Textarea
                                    {...field}
                                    placeholder="Describe this parameter"
                                  />
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
                                  <Textarea
                                    {...field}
                                    placeholder="Instructions for evaluators"
                                  />
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
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
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

                          {/* No Reasons Section */}
                          {parameterForm.watch("ratingType") === "yes_no_na" && (
                            <div className="space-y-4 border rounded-lg p-4">
                              <h4 className="font-medium">Reasons for "No" Response</h4>
                              <div className="flex gap-2">
                                <Input
                                  value={newReason}
                                  onChange={(e) => setNewReason(e.target.value)}
                                  placeholder="Enter a reason"
                                />
                                <Button type="button" onClick={addReason}>
                                  Add
                                </Button>
                              </div>
                              {noReasons.length > 0 && (
                                <div className="space-y-2">
                                  {noReasons.map((reason, index) => (
                                    <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                                      <span>{reason}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeReason(index)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

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
                                    onChange={(e) =>
                                      field.onChange(parseInt(e.target.value))
                                    }
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
                            disabled={createParameterMutation.isPending}
                          >
                            {isEditingParameter
                              ? updateParameterMutation.isPending
                                ? "Updating..."
                                : "Update Parameter"
                              : createParameterMutation.isPending
                              ? "Creating..."
                              : "Add Parameter"}
                          </Button>
                          {isEditingParameter && (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                setIsEditingParameter(false);
                                parameterForm.reset();
                                setNoReasons([]);
                              }}
                            >
                              Cancel Edit
                            </Button>
                          )}
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Form Preview</CardTitle>
                  <CardDescription>
                    Preview how the form will appear to evaluators
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PreviewForm template={template} />
                </CardContent>
              </Card>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}