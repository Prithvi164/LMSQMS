import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import type { Question, QuizTemplate, OrganizationBatch } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Loader2, PlayCircle, Edit, Eye } from "lucide-react";

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

export function QuizManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
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
      shuffleOptions: false
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

  // Add query for quiz templates
  const { data: quizTemplates = [], isLoading: templatesLoading } = useQuery<QuizTemplate[]>({
    queryKey: ['/api/quiz-templates', selectedTemplateProcessId !== 'all' ? parseInt(selectedTemplateProcessId) : null],
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
      processId: template.processId,
      batchId: template.batchId,
      categoryDistribution: template.categoryDistribution || {},
      difficultyDistribution: template.difficultyDistribution || {},
    });
  };

  // Update the generateQuizMutation to provide better feedback and handle existing quizzes
  const generateQuizMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await fetch(`/api/quiz-templates/${templateId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'active'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Check for conflict status (409) which means user already has an active quiz
        if (response.status === 409 && data.quizId) {
          return {
            existingQuiz: true,
            ...data
          };
        }
        throw new Error(data.message || 'Failed to generate quiz');
      }
      return data;
    },
    onSuccess: (data) => {
      // Check if this is an existing quiz notification
      if (data.existingQuiz) {
        toast({
          title: "Active Quiz Already Exists",
          description: (
            <div className="flex flex-col gap-2">
              <p>You already have an active quiz (#{data.quizId}) from this template.</p>
              <a 
                href={`/quizzes/${data.quizId}`} 
                className="text-blue-500 underline hover:text-blue-700 font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                View existing quiz
              </a>
            </div>
          ),
          duration: 10000, // Show for 10 seconds to give user time to click the link
        });
        return;
      }
      
      // This is a newly generated quiz
      const generatedQuizId = data.id;
      
      queryClient.invalidateQueries({ queryKey: ['/api/quizzes'] });
      toast({
        title: "Success",
        description: (
          <div className="flex flex-col gap-2">
            <p>Quiz #{generatedQuizId} has been generated and is now available to trainees</p>
            <a 
              href={`/quizzes/${generatedQuizId}`} 
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditQuestion(question)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => setDeletingQuestionId(question.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
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
                        <Button>Create Quiz Template</Button>
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
                              render={({ field }) => (
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
                                      ) : batches.length > 0 ? (
                                        batches.map((batch) => (
                                          <SelectItem key={batch.id} value={batch.id.toString()}>
                                            {batch.name}
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem value="na" disabled>No batches available</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    If selected, only trainees in this batch will be able to access this quiz template.
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
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
                    <div key={template.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{template.name}</h3>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="secondary">Time: {template.timeLimit} min</Badge>
                            <Badge variant="secondary">Questions: {template.questionCount}</Badge>
                            <Badge variant="secondary">Pass: {template.passingScore}%</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (generateQuizMutation.isPending) return;
                              generateQuizMutation.mutate(template.id);
                            }}
                            disabled={generateQuizMutation.isPending}
                          >
                            {generateQuizMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <PlayCircle className="h-4 w-4" />
                            )}
                            <span className="ml-2">Generate Quiz</span>
                          </Button>
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
                                shuffleOptions: template.shuffleOptions
                              };
                              previewRandomQuestions(previewData);
                              // Open the preview dialog
                              setIsPreviewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="ml-2">Preview</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingTemplateId(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
                        shuffleOptions: true
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

export default QuizManagement;