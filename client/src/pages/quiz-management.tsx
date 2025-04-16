import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import type { Question, QuizTemplate, OrganizationBatch } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Copy,
  Edit,
  Loader2,
  PlusCircle,
  Pencil,
  Trash2,
  EyeOff,
  Eye,
  ShieldAlert,
  AlertTriangle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Define interfaces first
interface Process {
  id: number;
  name: string;
  description?: string;
  status: string;
}

interface QuestionWithProcess extends Question {
  process?: Process;
  active: boolean;
}

type QuestionFormValues = z.infer<typeof questionFormSchema>;
type QuizTemplateFormValues = z.infer<typeof quizTemplateSchema>;
type FilterFormValues = z.infer<typeof filterFormSchema>;
type TemplateFilterFormValues = z.infer<typeof templateFilterFormSchema>;

interface QuizTemplateDetailsSectionProps {
  template: QuizTemplate;
  processes: Process[];
  batches: OrganizationBatch[];
}

// Define schemas
const questionFormSchema = z.object({
  id: z.number().optional(),
  question: z.string().min(1, { message: "Question is required" }),
  type: z.enum(["multiple_choice", "true_false", "short_answer"]),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1, { message: "Correct answer is required" }),
  explanation: z.string().optional(),
  processId: z.number().nullable(),
  category: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  active: z.boolean().default(true),
});

const quizTemplateSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, { message: "Template name is required" }),
  description: z.string().optional(),
  processId: z.number().nullable(),
  passingScore: z.number().min(0).max(100, { message: "Passing score must be between 0-100" }),
  timeLimit: z.number().min(1, { message: "Time limit is required" }),
  questionCount: z.number().min(1, { message: "Number of questions is required" }),
  categoryDistribution: z.array(
    z.object({
      category: z.string(),
      percentage: z.number().min(0).max(100)
    })
  ).optional(),
  difficultyDistribution: z.array(
    z.object({
      difficulty: z.enum(["easy", "medium", "hard"]),
      percentage: z.number().min(0).max(100)
    })
  ).optional(),
  batchId: z.number().nullable(),
  active: z.boolean().default(true),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  quizType: z.enum(["internal", "final"]).default("internal"),
});

const filterFormSchema = z.object({
  processId: z.string().optional(),
});

const templateFilterFormSchema = z.object({
  processId: z.string().optional(),
});

// Main component for Quiz Management
export function QuizManagement() {
  // Basic initialization
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState("questions");
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null);
  const [selectedTemplateProcessId, setSelectedTemplateProcessId] = useState<number | null>(null);

  // State for modal dialogs
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isQuestionPreviewOpen, setIsQuestionPreviewOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<QuizTemplate | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<number | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);

  // Forms for filtering
  const filterForm = useForm<FilterFormValues>({
    defaultValues: {
      processId: '',
    }
  });

  const templateFilterForm = useForm<TemplateFilterFormValues>({
    defaultValues: {
      processId: '',
    }
  });

  // Watch for changes to processId in filter forms
  const watchProcessId = filterForm.watch('processId');
  const watchTemplateProcessId = templateFilterForm.watch('processId');
 
  // Effect to update selected process IDs when filter forms change
  if (watchProcessId !== '' && Number(watchProcessId) !== selectedProcessId) {
    setSelectedProcessId(Number(watchProcessId));
  }
  
  if (watchTemplateProcessId !== '' && Number(watchTemplateProcessId) !== selectedTemplateProcessId) {
    setSelectedTemplateProcessId(Number(watchTemplateProcessId));
  }

  // Data Queries
  const { data: processes = [] } = useQuery({
    queryKey: ['/api/processes'],
  });

  const { data: batches = [] } = useQuery<OrganizationBatch[]>({
    queryKey: ['/api/organization-batches'],
  });

  // Query for questions with process filter
  const { data: questions = [], isLoading: questionsLoading } = useQuery<QuestionWithProcess[]>({
    queryKey: ['/api/questions', selectedProcessId],
    queryFn: async () => {
      try {
        const url = new URL('/api/questions', window.location.origin);
        url.searchParams.append('includeInactive', 'true');
        
        if (selectedProcessId) {
          url.searchParams.append('processId', selectedProcessId.toString());
          console.log('[Quiz Management] Fetching questions with URL:', url.toString());
          console.log('[Quiz Management] Selected Process ID:', selectedProcessId);
        } else {
          console.log('[Quiz Management] Fetching all questions (no process filter)');
        }
        
        const response = await fetch(url, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to fetch questions');
        }

        const data = await response.json();
        console.log('[Quiz Management] API Response:', {
          selectedProcess: selectedProcessId,
          questionCount: data.length,
          questions: data.map((q: any) => ({ id: q.id, processId: q.processId }))
        });
        return data;
      } catch (error) {
        console.error('[Quiz Management] Error fetching questions:', error);
        throw error;
      }
    },
  });

  // Query for quiz templates with process filter
  const { data: quizTemplates = [], isLoading: templatesLoading } = useQuery<QuizTemplate[]>({
    queryKey: ['/api/quiz-templates', selectedTemplateProcessId],
    queryFn: async () => {
      try {
        const url = new URL('/api/quiz-templates', window.location.origin);
        
        if (selectedTemplateProcessId) {
          url.searchParams.append('processId', selectedTemplateProcessId.toString());
        }
        
        const response = await fetch(url, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to fetch quiz templates');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching quiz templates:', error);
        throw error;
      }
    },
  });

  // Mutation for updating/creating questions
  const updateQuestionMutation = useMutation({
    mutationFn: async (data: Partial<Question>) => {
      return apiRequest({
        url: data.id ? `/api/questions/${data.id}` : '/api/questions',
        method: data.id ? 'PATCH' : 'POST',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
      toast({
        title: "Success",
        description: "Question saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to save question: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting questions
  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest({
        url: `/api/questions/${id}`,
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
      toast({
        title: "Success",
        description: "Question deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to delete question: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for toggling question active state
  const toggleQuestionActiveMutation = useMutation({
    mutationFn: async ({ id, currentState }: { id: number; currentState: boolean }) => {
      return apiRequest({
        url: `/api/questions/${id}`,
        method: 'PATCH',
        data: { active: !currentState },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
      toast({
        title: "Success",
        description: "Question status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to update question status: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting quiz templates
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest({
        url: `/api/quiz-templates/${id}`,
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quiz-templates'] });
      toast({
        title: "Success",
        description: "Quiz template deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to delete quiz template: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for updating/creating quiz templates
  const updateTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest({
        url: data.id ? `/api/quiz-templates/${data.id}` : '/api/quiz-templates',
        method: data.id ? 'PATCH' : 'POST',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quiz-templates'] });
      toast({
        title: "Success",
        description: "Quiz template saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to save quiz template: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handlers
  const onSubmitQuestion = async (data: QuestionFormValues) => {
    try {
      // Convert string options to array if it's a multiple choice question
      let formattedData = { ...data };
      
      if (data.type === "multiple_choice" && typeof data.options === "string") {
        formattedData.options = (data.options as unknown as string)
          .split("\n")
          .map(option => option.trim())
          .filter(option => option.length > 0);
      }
      
      console.log('[Quiz Management] Submitting question:', formattedData);
      
      // Handle question submission
      await updateQuestionMutation.mutateAsync({
        ...formattedData,
        processId: formattedData.processId || null,
        organizationId: 1, // Default organization ID
      });
      
      // Reset editing state
      setEditingQuestion(null);
    } catch (error) {
      console.error('[Quiz Management] Error submitting question:', error);
    }
  };

  const onSubmitTemplate = async (data: QuizTemplateFormValues) => {
    try {
      // Format the batchId (convert "none" to null)
      const formattedData = {
        ...data,
        organizationId: 1, // Default organization ID
        batchId: data.batchId === "none" ? null : data.batchId,
      };
      
      console.log('[Quiz Management] Submitting template:', formattedData);
      
      // Handle template submission
      await updateTemplateMutation.mutateAsync(formattedData);
      
      // Reset editing state
      setEditingTemplate(null);
    } catch (error) {
      console.error('[Quiz Management] Error submitting template:', error);
    }
  };

  // Preview random questions for a template
  const previewRandomQuestions = async (data: QuizTemplateFormValues) => {
    try {
      // Format the request data
      const requestData = {
        ...data,
        batchId: data.batchId === "none" ? null : data.batchId,
        preview: true, // Indicate this is a preview request
      };
      
      // Get random questions based on template criteria
      const response = await apiRequest({
        url: '/api/quiz-templates/preview-questions',
        method: 'POST',
        data: requestData,
      });
      
      // Update preview state
      setPreviewQuestions(response?.questions || []);
      setIsQuestionPreviewOpen(true);
    } catch (error) {
      console.error('[Quiz Management] Error previewing random questions:', error);
      toast({
        title: "Error",
        description: "Failed to preview random questions",
        variant: "destructive",
      });
    }
  };

  // Handler for editing a question
  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setIsQuestionDialogOpen(true);
  };

  // Handler for editing a template
  const handleEditTemplate = (template: QuizTemplate) => {
    // Convert null batchId to "none" for the form
    const templateWithFormattedBatchId = {
      ...template,
      batchId: template.batchId === null ? "none" : template.batchId,
    };
    
    setEditingTemplate(templateWithFormattedBatchId as any);
    setIsTemplateDialogOpen(true);
  };

  // QuestionForm Component Definition
  function QuestionForm({ 
    question, 
    processes, 
    onSubmit, 
    onCancel 
  }: { 
    question: Question | null; 
    processes: Process[]; 
    onSubmit: (data: QuestionFormValues) => void; 
    onCancel: () => void;
  }) {
    const [questionType, setQuestionType] = useState(question?.type || "multiple_choice");
    
    const form = useForm<QuestionFormValues>({
      resolver: zodResolver(questionFormSchema),
      defaultValues: {
        id: question?.id,
        question: question?.question || "",
        type: question?.type || "multiple_choice",
        options: question?.options || [],
        correctAnswer: question?.correctAnswer || "",
        explanation: question?.explanation || "",
        processId: question?.processId || null,
        category: question?.category || "",
        difficulty: question?.difficulty || "medium",
        active: question?.active !== false,
      },
    });

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Question input */}
          <FormField
            control={form.control}
            name="question"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Question</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter the question text"
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Question type selector */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Question Type</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    setQuestionType(value as "multiple_choice" | "true_false" | "short_answer");
                  }}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select question type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="true_false">True/False</SelectItem>
                    <SelectItem value="short_answer">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Options for multiple choice */}
          {questionType === "multiple_choice" && (
            <FormField
              control={form.control}
              name="options"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Options (one per line)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter each option on a new line"
                      className="min-h-[100px]"
                      value={Array.isArray(field.value) ? field.value.join("\n") : field.value}
                      onChange={(e) => {
                        const options = e.target.value.split("\n").map(opt => opt.trim()).filter(opt => opt.length > 0);
                        field.onChange(options);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter each option on a new line. These will be displayed as choices.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Correct answer field */}
          <FormField
            control={form.control}
            name="correctAnswer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correct Answer</FormLabel>
                {questionType === "multiple_choice" ? (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select the correct option" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.isArray(form.watch("options")) &&
                        form.watch("options").map((option, index) => (
                          <SelectItem key={index} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : questionType === "true_false" ? (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select True or False" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <FormControl>
                    <Input
                      placeholder="Enter the correct answer"
                      {...field}
                    />
                  </FormControl>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Explanation field */}
          <FormField
            control={form.control}
            name="explanation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Explanation (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter an explanation for the correct answer"
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  This will be shown to learners after they answer the question.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Process selector */}
          <FormField
            control={form.control}
            name="processId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Process</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === "" ? null : Number(value))}
                  defaultValue={field.value ? field.value.toString() : ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a process" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="null">None</SelectItem>
                    {processes.map((process: any) => (
                      <SelectItem key={process.id} value={process.id.toString()}>
                        {process.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Associate this question with a specific process.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category field */}
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category (Optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Customer Service, Technical"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Categorize this question for better organization.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Difficulty selector */}
          <FormField
            control={form.control}
            name="difficulty"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Difficulty</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Active toggle */}
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Active</FormLabel>
                  <FormDescription>
                    Only active questions can be included in quizzes.
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

          {/* Form actions */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {question ? "Update Question" : "Create Question"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Quiz Management</h1>
        <p className="text-muted-foreground">Create and manage quiz questions and templates</p>
      </div>

      <Tabs defaultValue="questions" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="questions">Question Bank</TabsTrigger>
          <TabsTrigger value="templates">Quiz Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="questions">
          <Card className="p-4">
            <div className="flex flex-col gap-4">
              {/* Process Filter Form */}
              <Form {...filterForm}>
                <form className="flex items-center gap-4">
                  <div className="flex-1">
                    <FormField
                      control={filterForm.control}
                      name="processId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Filter by Process</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a process" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">All Processes</SelectItem>
                              {processes.map((process: any) => (
                                <SelectItem key={process.id} value={process.id.toString()}>
                                  {process.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>

                  {hasPermission('manage_quiz') && (
                    <div className="flex items-end">
                      <Button
                        onClick={() => {
                          setEditingQuestion(null);
                          setIsQuestionDialogOpen(true);
                        }}
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Question
                      </Button>
                    </div>
                  )}
                </form>
              </Form>

              {/* Question Dialog */}
              <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingQuestion ? "Edit Question" : "Add New Question"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingQuestion
                        ? "Update the question details below."
                        : "Create a new question for quizzes."}
                    </DialogDescription>
                  </DialogHeader>

                  <QuestionForm
                    question={editingQuestion}
                    processes={processes}
                    onSubmit={(data: any) => {
                      onSubmitQuestion(data);
                      setIsQuestionDialogOpen(false);
                    }}
                    onCancel={() => setIsQuestionDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>

              {/* Delete Question Confirmation */}
              <AlertDialog 
                open={deletingQuestionId !== null} 
                onOpenChange={(isOpen) => !isOpen && setDeletingQuestionId(null)}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the question.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (deletingQuestionId) {
                          deleteQuestionMutation.mutate(deletingQuestionId);
                          setDeletingQuestionId(null);
                        }
                      }}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {questionsLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading questions...</span>
                </div>
              ) : questions?.length === 0 ? (
                <p>No questions found for the selected process.</p>
              ) : (
                <div className="space-y-8">
                  {/* Active Questions Section */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h2 className="text-xl font-semibold">Active Questions</h2>
                      <Badge variant="outline" className="px-3 py-1">
                        {questions.filter(q => q.active).length} Questions
                      </Badge>
                    </div>
                    
                    {questions.filter(q => q.active).length === 0 ? (
                      <Card className="p-4">
                        <p className="text-center text-muted-foreground">No active questions found.</p>
                      </Card>
                    ) : (
                      <div className="grid gap-4">
                        {questions.filter(q => q.active).map((question: QuestionWithProcess) => (
                          <Card key={question.id} className="p-4 border-l-4 border-l-green-500">
                            <div className="flex justify-between items-start mb-2">
                              <div className="space-y-1">
                                <h3 className="font-medium text-lg">{question.question}</h3>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {question.processId && (
                                    <Badge variant="outline">
                                      Process: {processes.find((p: any) => p.id === question.processId)?.name || 'Unknown Process'}
                                    </Badge>
                                  )}
                                  <Badge variant="default">Active</Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {hasPermission('manage_quiz') ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditQuestion(question)}
                                  >
                                    <Pencil className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    className="opacity-50"
                                  >
                                    <ShieldAlert className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                )}

                                {hasPermission('manage_quiz') && (
                                  <Button
                                    variant={question.active ? "outline" : "secondary"}
                                    size="sm"
                                    onClick={() => toggleQuestionActiveMutation.mutate({ 
                                      id: question.id, 
                                      currentState: question.active 
                                    })}
                                    disabled={toggleQuestionActiveMutation.isPending}
                                  >
                                    {toggleQuestionActiveMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : question.active ? (
                                      <EyeOff className="h-4 w-4 mr-1" />
                                    ) : (
                                      <Eye className="h-4 w-4 mr-1" />
                                    )}
                                    {question.active ? "Deactivate" : "Activate"}
                                  </Button>
                                )}
                                
                                {hasPermission('manage_quiz') ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600"
                                    onClick={() => setDeletingQuestionId(question.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    className="opacity-50"
                                  >
                                    <ShieldAlert className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              {question.type === 'multiple_choice' && (
                                <div className="ml-4 space-y-1">
                                  {question.options.map((option, index) => (
                                    <div
                                      key={index}
                                      className={`flex items-center gap-2 p-2 rounded-md ${
                                        option === question.correctAnswer
                                          ? 'bg-green-100 dark:bg-green-900/20'
                                          : ''
                                        }`}
                                    >
                                      <span className="w-6">{String.fromCharCode(65 + index)}.</span>
                                      <span>{option}</span>
                                      {option === question.correctAnswer && (
                                        <span className="text-sm text-green-600 dark:text-green-400 ml-2">
                                          (Correct)
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {question.type === 'true_false' && (
                                <div className="ml-4 space-y-1">
                                  <div className={`p-2 rounded-md ${
                                    'true' === question.correctAnswer ? 'bg-green-100 dark:bg-green-900/20' : ''
                                  }`}>
                                    True {question.correctAnswer === 'true' && '(Correct)'}
                                  </div>
                                  <div className={`p-2 rounded-md ${
                                    'false' === question.correctAnswer ? 'bg-green-100 dark:bg-green-900/20' : ''
                                  }`}>
                                    False {question.correctAnswer === 'false' && '(Correct)'}
                                  </div>
                                </div>
                              )}

                              {question.type === 'short_answer' && (
                                <div className="ml-4 p-2 bg-green-100 dark:bg-green-900/20 rounded-md">
                                  <span className="font-medium">Correct Answer: </span>
                                  {question.correctAnswer}
                                </div>
                              )}

                              {question.explanation && (
                                <div className="mt-2 p-3 bg-muted/50 rounded-md">
                                  <span className="font-medium">Explanation: </span>
                                  {question.explanation}
                                </div>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Inactive Questions Section */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h2 className="text-xl font-semibold">Inactive Questions</h2>
                      <Badge variant="outline" className="px-3 py-1">
                        {questions.filter(q => !q.active).length} Questions
                      </Badge>
                    </div>
                    
                    {questions.filter(q => !q.active).length === 0 ? (
                      <Card className="p-4">
                        <p className="text-center text-muted-foreground">No inactive questions found.</p>
                      </Card>
                    ) : (
                      <div className="grid gap-4">
                        {questions.filter(q => !q.active).map((question: QuestionWithProcess) => (
                          <Card key={question.id} className="p-4 border-l-4 border-l-red-500">
                            <div className="flex justify-between items-start mb-2">
                              <div className="space-y-1">
                                <h3 className="font-medium text-lg">{question.question}</h3>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {question.processId && (
                                    <Badge variant="outline">
                                      Process: {processes.find((p: any) => p.id === question.processId)?.name || 'Unknown Process'}
                                    </Badge>
                                  )}
                                  <Badge variant="destructive">Inactive</Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {hasPermission('manage_quiz') ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditQuestion(question)}
                                  >
                                    <Pencil className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    className="opacity-50"
                                  >
                                    <ShieldAlert className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                )}

                                {hasPermission('manage_quiz') && (
                                  <Button
                                    variant={question.active ? "outline" : "secondary"}
                                    size="sm"
                                    onClick={() => toggleQuestionActiveMutation.mutate({ 
                                      id: question.id, 
                                      currentState: question.active 
                                    })}
                                    disabled={toggleQuestionActiveMutation.isPending}
                                  >
                                    {toggleQuestionActiveMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : question.active ? (
                                      <EyeOff className="h-4 w-4 mr-1" />
                                    ) : (
                                      <Eye className="h-4 w-4 mr-1" />
                                    )}
                                    {question.active ? "Deactivate" : "Activate"}
                                  </Button>
                                )}
                                
                                {hasPermission('manage_quiz') ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600"
                                    onClick={() => setDeletingQuestionId(question.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    className="opacity-50"
                                  >
                                    <ShieldAlert className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              {question.type === 'multiple_choice' && (
                                <div className="ml-4 space-y-1">
                                  {question.options.map((option, index) => (
                                    <div
                                      key={index}
                                      className={`flex items-center gap-2 p-2 rounded-md ${
                                        option === question.correctAnswer
                                          ? 'bg-green-100 dark:bg-green-900/20'
                                          : ''
                                        }`}
                                    >
                                      <span className="w-6">{String.fromCharCode(65 + index)}.</span>
                                      <span>{option}</span>
                                      {option === question.correctAnswer && (
                                        <span className="text-sm text-green-600 dark:text-green-400 ml-2">
                                          (Correct)
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {question.type === 'true_false' && (
                                <div className="ml-4 space-y-1">
                                  <div className={`p-2 rounded-md ${
                                    'true' === question.correctAnswer ? 'bg-green-100 dark:bg-green-900/20' : ''
                                  }`}>
                                    True {question.correctAnswer === 'true' && '(Correct)'}
                                  </div>
                                  <div className={`p-2 rounded-md ${
                                    'false' === question.correctAnswer ? 'bg-green-100 dark:bg-green-900/20' : ''
                                  }`}>
                                    False {question.correctAnswer === 'false' && '(Correct)'}
                                  </div>
                                </div>
                              )}

                              {question.type === 'short_answer' && (
                                <div className="ml-4 p-2 bg-green-100 dark:bg-green-900/20 rounded-md">
                                  <span className="font-medium">Correct Answer: </span>
                                  {question.correctAnswer}
                                </div>
                              )}

                              {question.explanation && (
                                <div className="mt-2 p-3 bg-muted/50 rounded-md">
                                  <span className="font-medium">Explanation: </span>
                                  {question.explanation}
                                </div>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card className="p-4">
            <div className="flex flex-col gap-4">
              {/* Template content goes here */}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Question Form Component Definition */}
      {function QuestionForm({ 
        question, 
        processes, 
        onSubmit, 
        onCancel 
      }: { 
        question: Question | null; 
        processes: Process[]; 
        onSubmit: (data: QuestionFormValues) => void; 
        onCancel: () => void;
      }) {
        const [questionType, setQuestionType] = useState(question?.type || "multiple_choice");
        
        const form = useForm<QuestionFormValues>({
          resolver: zodResolver(questionFormSchema),
          defaultValues: {
            id: question?.id,
            question: question?.question || "",
            type: question?.type || "multiple_choice",
            options: question?.options || [],
            correctAnswer: question?.correctAnswer || "",
            explanation: question?.explanation || "",
            processId: question?.processId || null,
            category: question?.category || "",
            difficulty: question?.difficulty || "medium",
            active: question?.active !== false,
          },
        });

        return (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Question input */}
              <FormField
                control={form.control}
                name="question"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Question</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter the question text"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Question type selector */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Question Type</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        setQuestionType(value as "multiple_choice" | "true_false" | "short_answer");
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select question type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                        <SelectItem value="true_false">True/False</SelectItem>
                        <SelectItem value="short_answer">Short Answer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Options for multiple choice */}
              {questionType === "multiple_choice" && (
                <FormField
                  control={form.control}
                  name="options"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Options (one per line)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter each option on a new line"
                          className="min-h-[100px]"
                          value={Array.isArray(field.value) ? field.value.join("\n") : field.value}
                          onChange={(e) => {
                            const options = e.target.value.split("\n").map(opt => opt.trim()).filter(opt => opt.length > 0);
                            field.onChange(options);
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter each option on a new line. These will be displayed as choices.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Correct answer field */}
              <FormField
                control={form.control}
                name="correctAnswer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correct Answer</FormLabel>
                    {questionType === "multiple_choice" ? (
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select the correct option" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.isArray(form.watch("options")) &&
                            form.watch("options").map((option, index) => (
                              <SelectItem key={index} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    ) : questionType === "true_false" ? (
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select True or False" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="true">True</SelectItem>
                          <SelectItem value="false">False</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input
                          placeholder="Enter the correct answer"
                          {...field}
                        />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Explanation field */}
              <FormField
                control={form.control}
                name="explanation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Explanation (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter an explanation for the correct answer"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This will be shown to learners after they answer the question.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Process selector */}
              <FormField
                control={form.control}
                name="processId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Process</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "" ? null : Number(value))}
                      defaultValue={field.value ? field.value.toString() : ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a process" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="null">None</SelectItem>
                        {processes.map((process) => (
                          <SelectItem key={process.id} value={process.id.toString()}>
                            {process.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Associate this question with a specific process.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category field */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Customer Service, Technical"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Categorize this question for better organization.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Difficulty selector */}
              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select difficulty level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Active toggle */}
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Only active questions can be included in quizzes.
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

              {/* Form actions */}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button type="submit">
                  {question ? "Update Question" : "Create Question"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        );
      }}
    </div>
  );
}