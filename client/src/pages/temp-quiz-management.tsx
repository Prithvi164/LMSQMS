import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import { apiRequest } from "@/lib/queryClient";

// Define interfaces
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
});

const filterFormSchema = z.object({
  processId: z.string().optional(),
});

const templateFilterFormSchema = z.object({
  processId: z.string().optional(),
});

// MAIN COMPONENT FOR QUIZ MANAGEMENT PAGE
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

  // Data Queries
  const { data: processes = [] } = useQuery({
    queryKey: ['/api/processes'],
  });

  const { data: batches = [] } = useQuery<OrganizationBatch[]>({
    queryKey: ['/api/organization-batches'],
  });

  const filterForm = useForm({
    defaultValues: {
      processId: '',
    }
  });

  const templateFilterForm = useForm({
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

  // Query for questions with process filter
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
                              <SelectItem value="">All Processes</SelectItem>
                              {processes.map((process) => (
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
                        onSubmit={(data) => {
                          onSubmitQuestion(data);
                          setIsQuestionDialogOpen(false);
                        }}
                        onCancel={() => setIsQuestionDialogOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>
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
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          {/* Templates content goes here */}
        </TabsContent>
      </Tabs>
    </div>
  );
}