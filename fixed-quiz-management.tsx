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
  EyeOff,
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
  active: boolean;
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
        
        // Only show active questions by default
        // No includeInactive parameter means only active questions will be returned

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
        credentials: 'include'
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
        credentials: 'include'
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
  
  // Add toggle active mutation
  const toggleQuestionActiveMutation = useMutation({
    mutationFn: async ({ id, currentState }: { id: number, currentState: boolean }) => {
      console.log(`Attempting to toggle question ${id} active state from ${currentState} to ${!currentState}`);
      
      const response = await fetch(`/api/questions/${id}/toggle-active`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Log the response details for debugging
      console.log(`Toggle response status: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
      
      if (!response.ok) {
        // If the response is 401, it's an authentication error
        if (response.status === 401) {
          console.error('Authentication error when toggling question state');
          throw new Error('Authentication failed. Please refresh the page and try again.');
        }
        
        // Try to parse error message from response, but handle case where it's not JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            console.error('Server returned error:', errorData);
            throw new Error(errorData.message || 'Failed to toggle question active state');
          } catch (e) {
            console.error('Error parsing JSON response:', e);
            throw new Error(`Failed to toggle question active state: ${response.statusText}`);
          }
        } else {
          // If the response is not JSON, log and handle accordingly
          const text = await response.text();
          console.error('Received non-JSON response:', text);
          throw new Error('Server returned an unexpected response. Please try again later.');
        }
      }
      
      const text = await response.text();
      let data;
      
      try {
        // Only try to parse as JSON if there's actually content to parse
        if (text.trim()) {
          data = JSON.parse(text);
          console.log('Toggle successful:', data);
        } else {
          // Handle empty response
          data = { message: "Question status updated successfully" };
        }
      } catch (e) {
        console.error('Error parsing success response:', e);
        // Provide a more helpful message
        data = { 
          message: currentState ? "Question deactivated successfully" : "Question activated successfully",
          parseFailed: true 
        };
      }
      
      return { ...data, id, newState: !currentState };
    },
    onSuccess: (data) => {
      console.log('Toggle successful, invalidating queries...', data);
      // Invalidate the questions query to refetch the updated data
      queryClient.invalidateQueries({ queryKey: ['/api/questions', selectedProcessId] });
      
      toast({
        title: "Success",
        description: data.message || "Question state updated successfully",
      });
    },
    onError: (error: Error) => {
      console.error('Error in toggle active mutation:', error);
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
          credentials: 'include'
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
          credentials: 'include'
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
        credentials: 'include'
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
        credentials: 'include'
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
        credentials: 'include'
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

      const response = await fetch(`/api/random-questions?${params}`, {
        credentials: 'include'
      });
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
      
      const response = await fetch(url, {
        credentials: 'include'
      });
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
        }),
        credentials: 'include'
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
                                      Process: {processes.find(p => p.id === question.processId)?.name || 'Unknown Process'}
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
                                      Process: {processes.find(p => p.id === question.processId)?.name || 'Unknown Process'}
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
                  
                  {/* Inactive Questions Section */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
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
                                      Process: {processes.find(p => p.id === question.processId)?.name || 'Unknown Process'}
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
          </Card>
        </TabsContent>
