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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Alert,
  AlertDescription,
  AlertTitle
} from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  Pencil, 
  Trash2, 
  Loader2, 
  PlayCircle, 
  Edit, 
  Eye, 
  ShieldAlert, 
  Clock, 
  FileQuestion, 
  CheckCircle2,
  CalendarDays,
  Briefcase,
  User,
  BarChart
} from "lucide-react";

// Process filter form schema
const filterFormSchema = z.object({
  processId: z.string().optional()
});

// Add templateFilterFormSchema
const templateFilterFormSchema = z.object({
  processId: z.string().default("all")
});

// Process type definitions
interface Process {
  id: number;
  name: string;
  description?: string;
  status: string;
}

interface QuestionWithProcess extends Question {
  process?: Process;
}

// Question form schema
const questionFormSchema = z.object({
  question: z.string().min(1, "Question is required"),
  type: z.enum(["multiple_choice", "true_false", "short_answer"]),
  options: z.array(z.string()).default([]),
  correctAnswer: z.string().min(1, "Correct answer is required"),
  explanation: z.string().optional(),
  difficultyLevel: z.number().int().min(1).max(5),
  category: z.string().min(1, "Category is required"),
  processId: z.number().min(1).optional()
});

// Quiz template schema
const quizTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  timeLimit: z.number().int().min(1, "Time limit is required"),
  questionCount: z.number().int().min(1, "Question count is required"),
  passingScore: z.number().int().min(0).max(100, "Passing score must be between 0 and 100"),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  oneTimeOnly: z.boolean().default(false),
  quizType: z.enum(["internal", "final"]).default("internal"),
  categoryDistribution: z.record(z.string(), z.number()).optional(),
  difficultyDistribution: z.record(z.string(), z.number()).optional(),
  processId: z.number().min(1, "Process is required"),
  batchId: z.union([z.number(), z.literal("none")]).optional(),
});

// Define all types after schemas
type QuestionFormValues = z.infer<typeof questionFormSchema>;
type QuizTemplateFormValues = z.infer<typeof quizTemplateSchema>;
type FilterFormValues = z.infer<typeof filterFormSchema>;
type TemplateFilterFormValues = z.infer<typeof templateFilterFormSchema>;

// Component to display quiz template details including process name, batch name, and trainer
interface QuizTemplateDetailsSectionProps {
  template: QuizTemplate;
  processes: Process[];
  batches: OrganizationBatch[];
}

export function QuizManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [isAddTemplateOpen, setIsAddTemplateOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<number | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<QuizTemplate | null>(null);
  const [deletingQuizId, setDeletingQuizId] = useState<number | null>(null);


  // Create a form for the process filter
  const filterForm = useForm<FilterFormValues>({
    resolver: zodResolver(filterFormSchema),
    defaultValues: {
      processId: "all"
    }
  });

  // Get selected process ID from form
  const selectedProcessId = filterForm.watch("processId") !== "all" ? parseInt(filterForm.watch("processId")) : null;

  // Update process query with proper typing
  const { data: processes = [], isLoading: processesLoading } = useQuery<Process[]>({
    queryKey: ['/api/processes'],
    enabled: !!user?.organizationId
  });
  
  // Add query for batches
  const { data: batches = [], isLoading: batchesLoading } = useQuery<OrganizationBatch[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId
  });

  // Update the questions query with detailed logging
  const { data: questions = [], isLoading: questionsLoading } = useQuery<QuestionWithProcess[]>({
    queryKey: ['/api/questions', selectedProcessId],
    queryFn: async () => {
      try {
        const url = new URL('/api/questions', window.location.origin);

        if (selectedProcessId) {
          url.searchParams.append('processId', selectedProcessId.toString());
          console.log('[Quiz Management] Fetching questions with URL:', url.toString());
          console.log('[Quiz Management] Selected Process ID:', selectedProcessId);
        } else {
          console.log('[Quiz Management] Fetching all questions (no process filter)');
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch questions');
        }

        const data = await response.json();
        console.log('[Quiz Management] API Response:', {
          selectedProcess: selectedProcessId,
          questionCount: data.length,
          questions: data.map(q => ({ id: q.id, processId: q.processId }))
        });

        return data;
      } catch (error) {
        console.error('[Quiz Management] Error fetching questions:', error);
        throw error;
      }
    },
    enabled: !!user?.organizationId,
  });

  const templateForm = useForm<QuizTemplateFormValues>({
    resolver: zodResolver(quizTemplateSchema),
    defaultValues: {
      timeLimit: 10,
      questionCount: 10,
      passingScore: 70,
      shuffleQuestions: false,
      shuffleOptions: false,
      oneTimeOnly: false,
      quizType: "internal"
    }
  });

  const questionForm = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      type: "multiple_choice",
      difficultyLevel: 1,
      options: ["", ""],
      category: "",
      processId: undefined
    }
  });

  // Add update mutation
  const updateQuestionMutation = useMutation({
    mutationFn: async (data: { id: number; question: Partial<Question> }) => {
      const response = await fetch(`/api/questions/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data.question),
      });
      if (!response.ok) {
        throw new Error('Failed to update question');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions', selectedProcessId] });
      toast({
        title: "Success",
        description: "Question updated successfully",
      });
      setEditingQuestion(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add delete mutation
  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/questions/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete question');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions', selectedProcessId] });
      toast({
        title: "Success",
        description: "Question deleted successfully",
      });
      setDeletingQuestionId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmitQuestion = async (data: QuestionFormValues) => {
    if (!user?.organizationId || !user?.id) {
      toast({
        title: "Error",
        description: "User or organization information not found",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingQuestion) {
        // Update existing question
        await updateQuestionMutation.mutateAsync({
          id: editingQuestion.id,
          question: {
            ...data,
            options: data.type === 'multiple_choice' ? data.options : [],
            organizationId: user.organizationId,
          },
        });
      } else {
        // Create new question (existing logic)
        const questionData = {
          ...data,
          options: data.type === 'multiple_choice' ? data.options : [],
          organizationId: user.organizationId,
          createdBy: user.id
        };

        const response = await fetch('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(questionData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to add question');
        }

        await queryClient.invalidateQueries({ queryKey: ['/api/questions', selectedProcessId] });

        toast({
          title: "Success",
          description: "Question added successfully",
        });
      }
      setIsAddQuestionOpen(false);
      setEditingQuestion(null);
      questionForm.reset();
    } catch (error) {
      console.error('Error saving question:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save question",
        variant: "destructive",
      });
    }
  };

  const onSubmitTemplate = async (data: QuizTemplateFormValues) => {
    if (!user?.organizationId || !user?.id) {
      toast({
        title: "Error",
        description: "User or organization information not found",
        variant: "destructive",
      });
      return;
    }

    try {
      // Process batch ID - we've already set an appropriate value in the dropdown
      // The server will convert "none" to null
      console.log(`Template batch ID: ${data.batchId || 'none'}`);
      
      if (editingTemplate) {
        // Update existing template
        await updateTemplateMutation.mutateAsync({
          id: editingTemplate.id,
          template: {
            ...data,
            organizationId: user.organizationId,
          },
        });
      } else {
        // Create new template
        const templateData = {
          ...data,
          organizationId: user.organizationId,
          createdBy: user.id,
          processId: data.processId
        };

        const response = await fetch('/api/quiz-templates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(templateData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to add template');
        }

        await queryClient.invalidateQueries({ queryKey: ['/api/quiz-templates'] });

        toast({
          title: "Success",
          description: "Quiz template added successfully",
        });
      }
      setIsAddTemplateOpen(false);
      setEditingTemplate(null);
      setPreviewQuestions([]);
      templateForm.reset();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save template",
        variant: "destructive",
      });
    }
  };

  // Update deleteTemplateMutation implementation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/quiz-templates/${id}`, {
        method: 'DELETE',
      });

      // Even if we get an error, if the template is gone, consider it a success
      if (!response.ok) {
        const errorData = await response.json();
        // If the error is "Quiz template not found", it means it was already deleted
        if (errorData.message === "Quiz template not found") {
          return true;
        }
        throw new Error(errorData.message || 'Failed to delete template');
      }
      return true;
    },
    onSuccess: () => {
      // Invalidate both filtered and unfiltered queries
      queryClient.invalidateQueries({
        queryKey: ['/api/quiz-templates']
      });
      toast({
        title: "Success",
        description: "Quiz template deleted successfully",
      });
      setDeletingTemplateId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setDeletingTemplateId(null);
      // Force a refetch to ensure UI is in sync
      queryClient.invalidateQueries({
        queryKey: ['/api/quiz-templates']
      });
    },
  });

  // Add update mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (data: { id: number; template: Partial<QuizTemplate> }) => {
      const response = await fetch(`/api/quiz-templates/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data.template),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update template');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all quiz template queries to ensure UI updates
      queryClient.invalidateQueries({
        queryKey: ['/api/quiz-templates']
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/quiz-templates', selectedTemplateProcessId !== 'all' ? parseInt(selectedTemplateProcessId) : null]
      });
      toast({
        title: "Success",
        description: "Quiz template updated successfully",
      });
      setEditingTemplate(null);
      setIsAddTemplateOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add delete quiz mutation after the updateTemplateMutation
  const deleteQuizMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/quizzes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete quiz');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/quizzes']
      });
      toast({
        title: "Success",
        description: "Quiz deleted successfully",
      });
      setDeletingQuizId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setDeletingQuizId(null);
    },
  });

  // Add state for tracking selected questions preview
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);

  // Add state for tracking unique categories from questions
  const categories = useMemo(() => {
    if (!questions) return new Set<string>();
    return new Set(questions.map(q => q.category));
  }, [questions]);

  const difficulties = [1, 2, 3, 4, 5];

  // Add function to preview random questions
  const previewRandomQuestions = async (data: QuizTemplateFormValues) => {
    setIsPreviewLoading(true);
    try {
      const params = new URLSearchParams({
        count: data.questionCount.toString(),
      });

      if (data.categoryDistribution) {
        params.append('categoryDistribution', JSON.stringify(data.categoryDistribution));
      }
      if (data.difficultyDistribution) {
        params.append('difficultyDistribution', JSON.stringify(data.difficultyDistribution));
      }

      const response = await fetch(`/api/random-questions?${params}`);
      if (!response.ok) {
        throw new Error('Failed to get random questions');
      }

      const randomQuestions = await response.json();
      setPreviewQuestions(randomQuestions);
    } catch (error) {
      console.error('Error previewing questions:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to preview questions",
        variant: "destructive",
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };


  // Update the process selection handler
  const handleProcessChange = (value: string) => {
    console.log('[Quiz Management] Process selection changed:', {
      newValue: value,
      parsedId: value === 'all' ? null : parseInt(value)
    });

    filterForm.setValue('processId', value);
    // Force refetch questions with new process filter
    queryClient.invalidateQueries({
      queryKey: ['/api/questions', value === 'all' ? null : parseInt(value)]
    });
  };

  // Adding proper state management for edit dialog
  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setIsAddQuestionOpen(true);
    questionForm.reset({
      question: question.question,
      type: question.type,
      options: question.options || ["", ""],
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || "",
      difficultyLevel: question.difficultyLevel,
      category: question.category,
      processId: question.processId,
    });
  };

  // Add state for template process filter
  const [selectedTemplateProcessId, setSelectedTemplateProcessId] = useState<string>("all");

  // Add form for template filter
  const templateFilterForm = useForm<TemplateFilterFormValues>({
    resolver: zodResolver(templateFilterFormSchema),
    defaultValues: {
      processId: "all"
    }
  });

  // Add query for quiz templates with process filtering
  const { data: quizTemplates = [], isLoading: templatesLoading } = useQuery<QuizTemplate[]>({
    queryKey: ['/api/quiz-templates', selectedTemplateProcessId !== 'all' ? parseInt(selectedTemplateProcessId) : null],
    queryFn: async () => {
      const url = new URL('/api/quiz-templates', window.location.origin);
      
      // Add process ID to query params if a specific process is selected
      if (selectedTemplateProcessId !== 'all') {
        url.searchParams.append('processId', selectedTemplateProcessId);
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch quiz templates');
      }
      
      const templates = await response.json();
      
      // If we need to filter on the client side as a fallback
      if (selectedTemplateProcessId !== 'all') {
        return templates.filter(t => t.processId === parseInt(selectedTemplateProcessId));
      }
      
      return templates;
    },
    enabled: !!user?.organizationId
  });

  // Add function to handle edit template
  const handleEditTemplate = (template: QuizTemplate) => {
    setEditingTemplate(template);
    setIsAddTemplateOpen(true);
    templateForm.reset({
      name: template.name,
      description: template.description || "",
      timeLimit: template.timeLimit,
      questionCount: template.questionCount,
      passingScore: template.passingScore,
      shuffleQuestions: template.shuffleQuestions,
      shuffleOptions: template.shuffleOptions,
      oneTimeOnly: template.oneTimeOnly,
      quizType: template.quizType || "internal",
      processId: template.processId,
      batchId: template.batchId,
      categoryDistribution: template.categoryDistribution || {},
      difficultyDistribution: template.difficultyDistribution || {},
    });
  };

  // State for quiz duration selection
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  // Update the generateQuizMutation to provide better feedback
  const generateQuizMutation = useMutation({
    mutationFn: async ({ templateId, durationInHours }: { templateId: number; durationInHours: number }) => {
      const response = await fetch(`/api/quiz-templates/${templateId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'active',
          durationInHours 
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate quiz');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Store the newly generated quiz ID
      const generatedQuizId = data.id;
      
      // Close the dialog
      setIsGenerateDialogOpen(false);
      
      // Clear the selection
      setSelectedTemplateId(null);
      
      queryClient.invalidateQueries({ queryKey: ['/api/quizzes'] });
      toast({
        title: "Success",
        description: (
          <div className="flex flex-col gap-2">
            <p>Quiz #{generatedQuizId} has been generated and is now available to trainees</p>
            <p className="text-sm text-muted-foreground">
              Available from {new Date(data.startTime).toLocaleString()} to {new Date(data.endTime).toLocaleString()}
            </p>
            <a 
              href={`/quiz/${generatedQuizId}`} 
              className="text-blue-500 underline hover:text-blue-700 font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              View this quiz
            </a>
          </div>
        ),
        duration: 10000, // Show for 10 seconds to give user time to click the link
      });
      
      // Also invalidate the quiz templates to refresh any stats or indicators
      queryClient.invalidateQueries({ queryKey: ['/api/quiz-templates'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Quiz Management</h1>

      <Tabs defaultValue="questions">
        <TabsList>
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
                            onValueChange={handleProcessChange}
                            value={filterForm.watch('processId')}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="All Processes" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">All Processes</SelectItem>
                              {processes.map((process) => (
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
                  </div>
                  <div className="flex items-end">
                    <Dialog open={isAddQuestionOpen} onOpenChange={(open) => {
                      setIsAddQuestionOpen(open);
                      if (!open) {
                        setEditingQuestion(null);
                        questionForm.reset({
                          question: "",
                          type: "multiple_choice",
                          options: ["", ""],
                          correctAnswer: "",
                          explanation: "",
                          difficultyLevel: 1,
                          category: "",
                          processId: undefined
                        });
                      }
                    }}>
                      <DialogTrigger asChild>
                        {hasPermission('manage_quiz') ? (
                          <Button onClick={() => {
                            // Reset form before opening dialog
                            questionForm.reset({
                              question: "",
                              type: "multiple_choice",
                              options: ["", ""],
                              correctAnswer: "",
                              explanation: "",
                              difficultyLevel: 1,
                              category: "",
                              processId: undefined
                            });
                            setEditingQuestion(null);
                            setIsAddQuestionOpen(true);
                          }}>Add Question</Button>
                        ) : (
                          <Button variant="outline" disabled className="flex items-center gap-1">
                            <ShieldAlert className="h-4 w-4" />
                            <span>Add Question</span>
                          </Button>
                        )}
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add New Question'}</DialogTitle>
                        </DialogHeader>
                        <Form {...questionForm}>
                          <form onSubmit={questionForm.handleSubmit(onSubmitQuestion)} className="space-y-4">
                            <FormField
                              control={questionForm.control}
                              name="processId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Process</FormLabel>
                                  <Select
                                    onValueChange={(value) => field.onChange(parseInt(value))}
                                    value={field.value?.toString()}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder={processesLoading ? "Loading..." : "Select a process"} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {processesLoading ? (
                                        <SelectItem value="" disabled>Loading processes...</SelectItem>
                                      ) : processes.length > 0 ? (
                                        processes.map((process) => (
                                          <SelectItem key={process.id} value={process.id.toString()}>
                                            {process.name}
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem value="" disabled>No processes available</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={questionForm.control}
                              name="question"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Question Text</FormLabel>
                                  <FormControl>
                                    <Textarea placeholder="Enter your question" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={questionForm.control}
                              name="type"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Question Type</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
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

                            {questionForm.watch("type") === "multiple_choice" && (
                              <FormField
                                control={questionForm.control}
                                name="options"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Options</FormLabel>
                                    <FormControl>
                                      <div className="space-y-2">
                                        {field.value?.map((_, index) => (
                                          <Input
                                            key={index}
                                            placeholder={`Option ${index + 1}`}
                                            value={field.value[index]}
                                            onChange={(e) => {
                                              const newOptions = [...field.value!];
                                              newOptions[index] = e.target.value;
                                              field.onChange(newOptions);
                                            }}
                                          />
                                        ))}
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => field.onChange([...field.value!, ""])}
                                        >
                                          Add Option
                                        </Button>
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}

                            <FormField
                              control={questionForm.control}
                              name="correctAnswer"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Correct Answer</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter correct answer" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={questionForm.control}
                              name="explanation"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Explanation (Optional)</FormLabel>
                                  <FormControl>
                                    <Textarea placeholder="Explain the correct answer" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={questionForm.control}
                              name="difficultyLevel"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Difficulty Level (1-5)</FormLabel>
                                  <Select
                                    onValueChange={(value) => field.onChange(parseInt(value))}
                                    defaultValue={field.value.toString()}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select difficulty" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {[1, 2, 3, 4, 5].map((level) => (
                                        <SelectItem key={level} value={level.toString()}>
                                          Level {level}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={questionForm.control}
                              name="category"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Category</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter question category" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <Button type="submit">Save Question</Button>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </form>
              </Form>

              {questionsLoading ? (
                <p>Loading questions...</p>
              ) : questions?.length === 0 ? (
                <p>No questions found for the selected process.</p>
              ) : (
                <div className="grid gap-4">
                  {questions?.map((question: QuestionWithProcess) => (
                    <Card key={question.id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="space-y-1">
                          <h3 className="font-medium text-lg">{question.question}</h3>
                          {question.processId && (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                Process: {processes.find(p => p.id === question.processId)?.name || 'Unknown Process'}
                              </Badge>
                            </div>
                          )}
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
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card className="p-4">
            <div className="flex flex-col gap-4">
              {/* Process Filter for Templates */}
              <Form {...templateFilterForm}>
                <form className="flex items-center gap-4">
                  <div className="flex-1">
                    <FormField
                      control={templateFilterForm.control}
                      name="processId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Filter by Process</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              setSelectedTemplateProcessId(value);
                              field.onChange(value);
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="All Processes" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">All Processes</SelectItem>
                              {processes.map((process) => (
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
                  </div>
                  <div className="flex items-end">
                    <Dialog open={isAddTemplateOpen || editingTemplate !== null} onOpenChange={(open) => {
                      setIsAddTemplateOpen(open);
                      if (!open) {
                        setEditingTemplate(null);
                        templateForm.reset();
                        setPreviewQuestions([]);
                      }
                    }}>
                      <DialogTrigger asChild>
                        {hasPermission('manage_quiz') ? (
                          <Button>Create Quiz Template</Button>
                        ) : (
                          <Button variant="outline" disabled className="flex items-center gap-1">
                            <ShieldAlert className="h-4 w-4" />
                            <span>Create Quiz Template</span>
                          </Button>
                        )}
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            {editingTemplate ? 'Edit Quiz Template' : 'Create Quiz Template'}
                          </DialogTitle>
                        </DialogHeader>
                        <Form {...templateForm}>
                          <form onSubmit={templateForm.handleSubmit(onSubmitTemplate)} className="space-y-4">
                            {/* Inside the template form, add process selection before other fields */}
                            <FormField
                              control={templateForm.control}
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
                                        <SelectValue placeholder={processesLoading ? "Loading..." : "Select a process"} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {processesLoading ? (
                                        <SelectItem value="" disabled>Loading processes...</SelectItem>
                                      ) : processes.length > 0 ? (
                                        processes.map((process) => (
                                          <SelectItem key={process.id} value={process.id.toString()}>
                                            {process.name}
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem value="" disabled>No processes available</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Batch selection field */}
                            <FormField
                              control={templateForm.control}
                              name="batchId"
                              render={({ field }) => {
                                // Get the currently selected process ID from the form
                                const selectedProcessId = templateForm.watch("processId");
                                
                                // Filter batches to only show those matching the selected process
                                const filteredBatches = batches.filter(batch => 
                                  // If no process is selected, show all batches
                                  !selectedProcessId || batch.processId === selectedProcessId
                                );
                                
                                return (
                                  <FormItem>
                                    <FormLabel>Restrict to Batch (Optional)</FormLabel>
                                    <Select
                                      onValueChange={(value) => field.onChange(value === "none" ? "none" : parseInt(value))}
                                      defaultValue={field.value?.toString() || "none"}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder={batchesLoading ? "Loading..." : "Select a batch"} />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="none">No batch restriction (Available to all)</SelectItem>
                                        {batchesLoading ? (
                                          <SelectItem value="loading" disabled>Loading batches...</SelectItem>
                                        ) : filteredBatches.length > 0 ? (
                                          filteredBatches.map((batch) => (
                                            <SelectItem key={batch.id} value={batch.id.toString()}>
                                              {batch.name}
                                            </SelectItem>
                                          ))
                                        ) : (
                                          <SelectItem value="na" disabled>No batches available for selected process</SelectItem>
                                        )}
                                      </SelectContent>
                                    </Select>
                                    <FormDescription>
                                      If selected, only trainees in this batch will be able to access this quiz template.
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
                            />



                            <FormField
                              control={templateForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Template Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter template name" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={templateForm.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Description (Optional)</FormLabel>
                                  <FormControl>
                                    <Textarea placeholder="Enter template description" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={templateForm.control}
                              name="quizType"
                              render={({ field }) => (
                                <FormItem className="space-y-3">
                                  <FormLabel>Quiz Type</FormLabel>
                                  <FormControl>
                                    <RadioGroup
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                      className="flex flex-col space-y-1"
                                    >
                                      <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                          <RadioGroupItem value="internal" />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                          Internal (Practice)
                                        </FormLabel>
                                      </FormItem>
                                      <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                          <RadioGroupItem value="final" />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                          Final (Assessment)
                                        </FormLabel>
                                      </FormItem>
                                    </RadioGroup>
                                  </FormControl>
                                  <FormDescription>
                                    Internal quizzes are for practice, while Final quizzes are used for formal assessments.
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={templateForm.control}
                              name="timeLimit"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Time Limit (minutes)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={1}
                                      placeholder="Enter time limit"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={templateForm.control}
                              name="questionCount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Number of Questions</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={1}
                                      placeholder="Enter number of questions"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={templateForm.control}
                              name="passingScore"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Passing Score (%)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      placeholder="Enter passing score"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="flex flex-col gap-4">
                              <FormField
                                control={templateForm.control}
                                name="shuffleQuestions"
                                render={({ field }) => (
                                  <div className="flex items-center justify-between">
                                    <Label htmlFor="shuffle-questions">Shuffle Questions</Label>
                                    <Switch
                                      id="shuffle-questions"
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </div>
                                )}
                              />

                              <FormField
                                control={templateForm.control}
                                name="shuffleOptions"
                                render={({ field }) => (
                                  <div className="flex items-center justify-between">
                                    <Label htmlFor="shuffle-options">Shuffle Answer Options</Label>
                                    <Switch
                                      id="shuffle-options"
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </div>
                                )}
                              />

                              <FormField
                                control={templateForm.control}
                                name="oneTimeOnly"
                                render={({ field }) => (
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <Label htmlFor="one-time-only" className="flex items-center gap-2">
                                        One-Time Only Quiz
                                        <span className="inline-block">
                                          <Badge variant="destructive" className="ml-2">Restricted</Badge>
                                        </span>
                                      </Label>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Trainees only get one attempt to complete this quiz
                                      </p>
                                    </div>
                                    <Switch
                                      id="one-time-only"
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </div>
                                )}
                              />
                            </div>

                            <div className="space-y-4">
                              <h4 className="font-medium">Question Distribution</h4>

                              {/* Category Distribution */}
                              <div className="space-y-2">
                                <Label>Category Distribution</Label>
                                <div className="grid grid-cols-2 gap-2">
                                  {Array.from(categories).map((category) => (
                                    <div key={category} className="flex items-center gap-2">
                                      <Label>{category}</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        placeholder="Count"
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value);
                                          const current = templateForm.getValues('categoryDistribution') || {};
                                          if (value > 0) {
                                            templateForm.setValue('categoryDistribution', {
                                              ...current,
                                              [category]: value
                                            });
                                          } else {
                                            const { [category]: _, ...rest } = current;
                                            templateForm.setValue('categoryDistribution', rest);
                                          }
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Difficulty Distribution */}
                              <div className="space-y-2">
                                <Label>Difficulty Distribution</Label>
                                <div className="grid grid-cols-2 gap-2">
                                  {difficulties.map((level) => (
                                    <div key={level} className="flex items-center gap-2">
                                      <Label>Level {level}</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        placeholder="Count"
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value);
                                          const current = templateForm.getValues('difficultyDistribution') || {};
                                          if (value > 0) {
                                            templateForm.setValue('difficultyDistribution', {
                                              ...current,
                                              [level]: value
                                            });
                                          } else {
                                            const { [level]: _, ...rest } = current;
                                            templateForm.setValue('difficultyDistribution', rest);
                                          }
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  const data = templateForm.getValues();
                                  previewRandomQuestions(data);
                                }}
                                disabled={isPreviewLoading}
                              >
                                {isPreviewLoading ? "Loading..." : "Preview Questions"}
                              </Button>
                              <Button type="submit">
                                {editingTemplate ? 'Update Template' : 'Create Template'}
                              </Button>
                            </div>
                          </form>

                        </Form>

                        {/* Preview Questions */}
                        {previewQuestions.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <h4 className="font-medium">Preview Selected Questions</h4>
                            <div className="max-h-[300px] overflow-y-auto space-y-2">
                              {previewQuestions.map((question) => (
                                <Card key={question.id} className="p-2">
                                  <div className="flex justify-between items-start">
                                    <p className="text-sm">{question.question}</p>
                                    <div className="flex gap-1">
                                      <Badge variant="outline">Level {question.difficultyLevel}</Badge>
                                      <Badge variant="outline">{question.category}</Badge>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </form>
              </Form>

              {/* Template List */}
              {templatesLoading ? (
                <p>Loading templates...</p>
              ) : quizTemplates.length === 0 ? (
                <p>No quiz templates found for the selected process.</p>
              ) : (
                <div className="grid gap-4">
                  {quizTemplates.map((template: QuizTemplate) => (
                    <div key={template.id} className={`border rounded-lg p-4 shadow-sm hover:shadow-md transition-all 
                      ${template.quizType === "final" 
                        ? "border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-transparent" 
                        : "border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-transparent"}`}>
                      <div className="flex items-center justify-between">
                        <div className="w-full">
                          <div className="flex justify-between items-center mb-3">
                            <h3 className={`text-lg font-semibold ${template.quizType === "final" ? "text-red-700" : "text-blue-700"}`}>
                              {template.name}
                            </h3>
                            <Badge variant={template.quizType === "final" ? "destructive" : "secondary"} 
                              className={`ml-2 ${template.quizType === "final" ? "bg-red-600" : "bg-blue-600"}`}>
                              {template.quizType === "final" ? "Final Quiz" : "Internal Quiz"}
                            </Badge>
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mb-3 border-l-2 border-gray-200 pl-2">{template.description}</p>
                          )}
                          <div className="flex flex-wrap gap-2 my-3 p-2 rounded-md bg-white bg-opacity-70">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 shadow-sm">
                              <Clock className="w-3 h-3 mr-1" /> {template.timeLimit} min
                            </Badge>
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 shadow-sm">
                              <FileQuestion className="w-3 h-3 mr-1" /> {template.questionCount} questions
                            </Badge>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 shadow-sm">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> {template.passingScore}% to pass
                            </Badge>
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 shadow-sm">
                              <BarChart className="w-3 h-3 mr-1" /> Generated: {template.generationCount || 0} times
                            </Badge>
                          </div>
                          <QuizTemplateDetailsSection template={template} processes={processes} batches={batches} />
                        </div>
                        <div className="flex items-center gap-2 ml-4 backdrop-blur-sm bg-white bg-opacity-50 p-2 rounded-md">
                          {hasPermission('manage_quiz') ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (generateQuizMutation.isPending) return;
                                setSelectedTemplateId(template.id);
                                setIsGenerateDialogOpen(true);
                              }}
                              disabled={generateQuizMutation.isPending}
                              className={`text-amber-600 hover:text-amber-700 hover:bg-amber-50 ${template.quizType === "final" ? "bg-red-50" : "bg-blue-50"}`}
                            >
                              {generateQuizMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <PlayCircle className="h-4 w-4" />
                              )}
                              <span className="ml-2">Generate Quiz</span>
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              className="opacity-50"
                              title="You don't have permission to generate quizzes"
                            >
                              <ShieldAlert className="h-4 w-4" />
                              <span className="ml-2">Generate Quiz</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIsPreviewLoading(true);
                              // Prepare the template data for preview
                              const previewData: QuizTemplateFormValues = {
                                name: template.name,
                                questionCount: template.questionCount,
                                categoryDistribution: template.categoryDistribution || {},
                                difficultyDistribution: template.difficultyDistribution || {},
                                processId: template.processId,
                                timeLimit: template.timeLimit,
                                passingScore: template.passingScore,
                                shuffleQuestions: template.shuffleQuestions,
                                shuffleOptions: template.shuffleOptions,
                                oneTimeOnly: template.oneTimeOnly,
                                quizType: template.quizType
                              };
                              previewRandomQuestions(previewData);
                              // Open the preview dialog
                              setIsPreviewDialogOpen(true);
                            }}
                            className={`text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 ${template.quizType === "final" ? "bg-red-50" : "bg-blue-50"}`}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="ml-2">Preview</span>
                          </Button>
                          {hasPermission('manage_quiz') ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTemplate(template)}
                              className={`text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 ${template.quizType === "final" ? "bg-red-50" : "bg-blue-50"}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              className="opacity-50"
                            >
                              <ShieldAlert className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {hasPermission('manage_quiz') ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingTemplateId(template.id)}
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              className="opacity-50"
                            >
                              <ShieldAlert className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deletingQuestionId !== null} onOpenChange={(open) => !open && setDeletingQuestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingQuestionId && deleteQuestionMutation.mutate(deletingQuestionId)}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={deletingTemplateId !== null}
        onOpenChange={(open) => !open && setDeletingTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quiz template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTemplateId && deleteTemplateMutation.mutate(deletingTemplateId)}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Add delete confirmation dialog in the return statement after the quiz templates section */}
      <AlertDialog open={!!deletingQuizId} onOpenChange={(open) => !open && setDeletingQuizId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quiz? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingQuizId && deleteQuizMutation.mutateAsync(deletingQuizId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteQuizMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Quiz'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quiz Generation Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Generate Quiz</DialogTitle>
            <DialogDescription>
              Set the duration for how long trainees will have access to take this quiz.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="duration-select">Quiz Availability Duration</Label>
                <Select 
                  value={selectedDuration.toString()} 
                  onValueChange={(value) => setSelectedDuration(parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="2">2 hours</SelectItem>
                    <SelectItem value="4">4 hours</SelectItem>
                    <SelectItem value="8">8 hours</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="24">24 hours (1 day)</SelectItem>
                    <SelectItem value="48">48 hours (2 days)</SelectItem>
                    <SelectItem value="72">72 hours (3 days)</SelectItem>
                    <SelectItem value="168">1 week</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  Trainees will have access to this quiz for {selectedDuration} hour{selectedDuration !== 1 ? 's' : ''} after generation.
                </p>
              </div>
              <div className="relative w-full rounded-lg border p-4 bg-background text-foreground mt-2">
                <div className="flex items-start">
                  <div className="mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="mb-1 font-medium leading-none tracking-tight">Time-bound Quiz</h5>
                    <div className="text-sm">
                      This quiz will be available to trainees from the moment it's generated until {selectedDuration} hour{selectedDuration !== 1 ? 's' : ''} later. 
                      The quiz timer of {quizTemplates.find(t => t.id === selectedTemplateId)?.timeLimit || 0} minutes begins when a trainee starts the quiz.
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (!selectedTemplateId || generateQuizMutation.isPending) return;
                  generateQuizMutation.mutate({ 
                    templateId: selectedTemplateId, 
                    durationInHours: selectedDuration 
                  });
                }}
                disabled={generateQuizMutation.isPending}
              >
                {generateQuizMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Quiz'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Questions Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quiz Preview</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {isPreviewLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading questions...</span>
              </div>
            ) : previewQuestions.length > 0 ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Sample Questions ({previewQuestions.length})</h4>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // Get the template data from the last preview and refresh
                      const lastTemplateData: QuizTemplateFormValues = {
                        name: "Preview Refresh",
                        questionCount: previewQuestions.length,
                        categoryDistribution: previewQuestions.reduce((acc, q) => {
                          acc[q.category] = (acc[q.category] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>),
                        difficultyDistribution: previewQuestions.reduce((acc, q) => {
                          const key = q.difficultyLevel.toString();
                          acc[key] = (acc[key] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>),
                        processId: previewQuestions[0]?.processId,
                        timeLimit: 10,
                        passingScore: 70,
                        shuffleQuestions: true,
                        shuffleOptions: true,
                        oneTimeOnly: false,
                        quizType: "internal"
                      };
                      previewRandomQuestions(lastTemplateData);
                    }}
                  >
                    <Loader2 className="h-4 w-4 mr-2" />
                    Refresh Preview
                  </Button>
                </div>
                <div className="space-y-4">
                  {previewQuestions.map((question, index) => (
                    <Card key={question.id} className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="flex gap-2">
                            <Badge>{question.category}</Badge>
                            <Badge variant="outline">Difficulty: {question.difficultyLevel}</Badge>
                          </div>
                          <Badge variant="secondary">Question {index + 1}</Badge>
                        </div>
                        <h4 className="font-medium">{question.question}</h4>
                        
                        {question.type === 'multiple_choice' && question.options && (
                          <div className="grid gap-2 mt-2">
                            {question.options.map((option, optIndex) => (
                              <div 
                                key={optIndex}
                                className={`p-2 border rounded ${option === question.correctAnswer ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                              >
                                {option} {option === question.correctAnswer && <span className="text-green-600 ml-2">(Correct)</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {question.type === 'true_false' && (
                          <div className="grid gap-2 mt-2">
                            <div className={`p-2 border rounded ${question.correctAnswer === 'true' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                              True {question.correctAnswer === 'true' && <span className="text-green-600 ml-2">(Correct)</span>}
                            </div>
                            <div className={`p-2 border rounded ${question.correctAnswer === 'false' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                              False {question.correctAnswer === 'false' && <span className="text-green-600 ml-2">(Correct)</span>}
                            </div>
                          </div>
                        )}
                        
                        {question.explanation && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            <strong>Explanation:</strong> {question.explanation}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">No preview questions available. Try modifying the template settings.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component to display additional information about a quiz template
function QuizTemplateDetailsSection({ template, processes, batches }: QuizTemplateDetailsSectionProps) {
  // Find the process corresponding to this template
  const process = processes.find(p => p.id === template.processId);
  
  // Find the batch if the template has a batchId
  const batch = template.batchId ? batches.find(b => b.id === template.batchId) : null;
  
  // Get users data for finding trainer name
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    enabled: !!batch?.trainerId
  });
  
  // Find trainer name from batch trainer ID
  const getTrainerName = () => {
    if (!batch?.trainerId) return null;
    
    // Find the trainer in the users array
    const trainer = users.find(user => user.id === batch.trainerId);
    
    // Return trainer name if found, otherwise fallback to ID
    if (trainer) {
      return trainer.name || trainer.username || trainer.email;
    }
    
    return `Trainer #${batch.trainerId}`;
  };
  
  const trainerName = getTrainerName();
  
  // Calculate additional quiz template stats
  const hasCategory = !!template.categoryDistribution && Object.keys(template.categoryDistribution).length > 0;
  const hasDifficulty = !!template.difficultyDistribution && Object.keys(template.difficultyDistribution).length > 0;
  
  return (
    <div className="mt-2 text-sm">
      {/* Primary information badges */}
      <div className="flex flex-wrap gap-2 mt-2 p-2 rounded-md bg-white bg-opacity-50 backdrop-blur-sm shadow-inner">
        {process && (
          <Badge variant="outline" className="bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border-amber-200 shadow-sm">
            <Briefcase className="w-3 h-3 mr-1" /> {process.name}
          </Badge>
        )}
        
        {batch && (
          <Badge variant="outline" className="bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700 border-indigo-200 shadow-sm">
            <CalendarDays className="w-3 h-3 mr-1" /> {batch.name}
          </Badge>
        )}
        
        {trainerName && (
          <Badge variant="outline" className="bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200 shadow-sm">
            <User className="w-3 h-3 mr-1" /> {trainerName}
          </Badge>
        )}

        {/* Quiz settings badges */}
        {template.shuffleQuestions && (
          <Badge variant="outline" className="bg-gradient-to-r from-violet-50 to-violet-100 text-violet-700 border-violet-200 shadow-sm">
            <FileQuestion className="w-3 h-3 mr-1" /> Shuffled Questions
          </Badge>
        )}
        
        {template.shuffleOptions && (
          <Badge variant="outline" className="bg-gradient-to-r from-fuchsia-50 to-fuchsia-100 text-fuchsia-700 border-fuchsia-200 shadow-sm">
            <FileQuestion className="w-3 h-3 mr-1" /> Shuffled Options
          </Badge>
        )}
        
        {template.oneTimeOnly && (
          <Badge variant="outline" className="bg-gradient-to-r from-rose-50 to-rose-100 text-rose-700 border-rose-200 shadow-sm">
            <FileQuestion className="w-3 h-3 mr-1" /> One-Time Only
          </Badge>
        )}
      </div>
      
      {/* Show distribution information if any */}
      {(hasCategory || hasDifficulty) && (
        <div className="mt-2 p-2 rounded-md bg-slate-50 bg-opacity-50 border border-slate-100 text-xs">
          {hasCategory && (
            <div className="flex items-center gap-1 mb-1">
              <FileQuestion className="w-3 h-3 text-slate-500" />
              <span className="text-slate-600 font-medium">Categories:</span>
              <span className="text-slate-500">
                {Object.entries(template.categoryDistribution || {})
                  .map(([cat, count]) => `${cat} (${count})`)
                  .join(', ')}
              </span>
            </div>
          )}
          
          {hasDifficulty && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-slate-500" />
              <span className="text-slate-600 font-medium">Difficulty:</span>
              <span className="text-slate-500">
                {Object.entries(template.difficultyDistribution || {})
                  .map(([level, count]) => `Level ${level} (${count})`)
                  .join(', ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default QuizManagement;