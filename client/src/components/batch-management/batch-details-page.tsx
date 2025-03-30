import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, AlertCircle, Clock, ChevronLeft, ClipboardCheck, Eye, PlayCircle, Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { BatchTimeline } from "./batch-timeline";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Textarea
} from "@/components/ui/textarea";
import { FormMessage } from "@/components/ui/form";

// Type definitions needed for quiz management
type Process = {
  id: number;
  name: string;
  description?: string;
  organizationId: number;
};

type Question = {
  id: number;
  question: string;
  type: "multiple_choice" | "true_false" | "short_answer";
  options: string[];
  correctAnswer: string;
  explanation?: string;
  difficultyLevel: number;
  category: string;
  processId: number;
  organizationId: number;
  createdAt: Date;
  updatedAt: Date;
};

type QuizTemplate = {
  id: number;
  name: string;
  description?: string;
  timeLimit: number;
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questionCount: number;
  categoryDistribution?: Record<string, number>;
  difficultyDistribution?: Record<string, number>;
  processId: number;
  organizationId: number;
  batchId?: number;
  createdBy: number;
  questions: number[];
  createdAt: Date;
  updatedAt: Date;
};

const statusColors = {
  present: 'text-green-500',
  absent: 'text-red-500',
  late: 'text-yellow-500',
  leave: 'text-blue-500',
  half_day: 'text-orange-500',
  public_holiday: 'text-purple-500',
  weekly_off: 'text-gray-500'
} as const;

type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'half_day' | 'public_holiday' | 'weekly_off';

type Trainee = {
  id: number;
  status: string;
  name: string;
  employeeId?: string;
  user?: {
    id: number;
    fullName: string;
    employeeId: string;
    email: string;
    role: string;
    category: string;
  };
  lastUpdated?: string;
};

const getStatusIcon = (status: AttendanceStatus | null) => {
  switch (status) {
    case 'present':
      return <CheckCircle className={`h-4 w-4 ${statusColors.present}`} />;
    case 'absent':
      return <AlertCircle className={`h-4 w-4 ${statusColors.absent}`} />;
    case 'late':
      return <Clock className={`h-4 w-4 ${statusColors.late}`} />;
    case 'leave':
      return <Clock className={`h-4 w-4 ${statusColors.leave}`} />;
    case 'half_day':
      return <Clock className={`h-4 w-4 ${statusColors.half_day}`} />;
    case 'public_holiday':
      return <AlertCircle className={`h-4 w-4 ${statusColors.public_holiday}`} />;
    case 'weekly_off':
      return <AlertCircle className={`h-4 w-4 ${statusColors.weekly_off}`} />;
    default:
      return null;
  }
};

const LoadingSkeleton = () => (
  <div className="space-y-4 p-8 animate-fade-in">
    {/* Header with batch name and info */}
    <div className="flex justify-between items-start">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-6 w-24 rounded-full" /> {/* Badge */}
    </div>
    
    {/* Batch capacity card */}
    <div className="border rounded-lg p-6 space-y-4">
      <Skeleton className="h-5 w-32" />
      <div className="space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-30" />
          <Skeleton className="h-4 w-8" />
        </div>
      </div>
    </div>
    
    {/* Tabs */}
    <div className="space-y-4">
      <div className="flex space-x-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-28" />
      </div>
      
      {/* Tab content */}
      <div className="border rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-6 w-40" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        
        {/* Table */}
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          
          {/* Table rows */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-5 gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const phaseChangeFormSchema = z.object({
  requestedPhase: z.enum(['induction', 'training', 'certification', 'ojt', 'ojt_certification']),
  justification: z.string().min(1, "Justification is required"),
  managerId: z.string().min(1, "Manager is required"),
});

// QuizTemplateForm component definition for reuse
function QuizTemplateForm({ batchId }: { batchId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);

  // Query for processes
  const { data: processes = [] } = useQuery<Process[]>({
    queryKey: ['/api/processes'],
    enabled: !!user?.organizationId
  });
  
  // Extract categories from questions for distribution form
  const { data: questions = [] } = useQuery<Question[]>({
    queryKey: ['/api/questions'],
    enabled: !!user?.organizationId
  });
  
  // Extract unique categories and difficulty levels
  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    questions.forEach(q => {
      if (q.category) categorySet.add(q.category);
    });
    return categorySet;
  }, [questions]);
  
  const difficulties = useMemo(() => {
    return [1, 2, 3, 4, 5];
  }, []);

  // Quiz template form
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
  });

  type QuizTemplateFormValues = z.infer<typeof quizTemplateSchema>;

  const form = useForm<QuizTemplateFormValues>({
    resolver: zodResolver(quizTemplateSchema),
    defaultValues: {
      timeLimit: 10,
      questionCount: 10,
      passingScore: 70,
      shuffleQuestions: false,
      shuffleOptions: false,
      categoryDistribution: {},
      difficultyDistribution: {}
    }
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: QuizTemplateFormValues) => {
      const payload = {
        ...data,
        batchId: batchId,
        organizationId: user?.organizationId,
        createdBy: user?.id,
        questions: previewQuestions.map(q => q.id)
      };
      
      const response = await fetch('/api/quiz-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create quiz template');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/quiz-templates`] });
      toast({
        title: "Success",
        description: "Quiz template created successfully",
      });
      // Close dialog
      const closeButton = document.querySelector('[data-dialog-close]');
      if (closeButton instanceof HTMLElement) {
        closeButton.click();
      }
      // Reset form
      form.reset();
      setPreviewQuestions([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Preview questions function
  const previewRandomQuestions = async (data: QuizTemplateFormValues) => {
    setIsPreviewLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('count', data.questionCount.toString());
      
      if (data.processId) {
        params.append('processId', data.processId.toString());
      }
      
      if (data.categoryDistribution && Object.keys(data.categoryDistribution).length > 0) {
        params.append('categoryDistribution', JSON.stringify(data.categoryDistribution));
      }
      
      if (data.difficultyDistribution && Object.keys(data.difficultyDistribution).length > 0) {
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

  const onSubmit = (data: QuizTemplateFormValues) => {
    if (previewQuestions.length === 0) {
      // If no questions previewed yet, preview them first
      previewRandomQuestions(data).then(() => {
        // After preview loaded, submit if we have questions
        if (previewQuestions.length > 0) {
          createTemplateMutation.mutate(data);
        } else {
          toast({
            title: "Warning",
            description: "Please preview questions before creating template",
            variant: "destructive",
          });
        }
      });
    } else {
      // We already have previewed questions, proceed with creation
      createTemplateMutation.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quiz Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter quiz name" {...field} />
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
                <Textarea placeholder="Enter quiz description" {...field} />
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
                value={field.value?.toString()}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a process" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
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
            control={form.control}
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
        </div>

        <FormField
          control={form.control}
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
            control={form.control}
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
            control={form.control}
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
                      const current = form.getValues('categoryDistribution') || {};
                      if (value > 0) {
                        form.setValue('categoryDistribution', {
                          ...current,
                          [category]: value
                        });
                      } else {
                        const { [category]: _, ...rest } = current;
                        form.setValue('categoryDistribution', rest);
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
                      const current = form.getValues('difficultyDistribution') || {};
                      if (value > 0) {
                        form.setValue('difficultyDistribution', {
                          ...current,
                          [level]: value
                        });
                      } else {
                        const { [level]: _, ...rest } = current;
                        form.setValue('difficultyDistribution', rest);
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
              const data = form.getValues();
              previewRandomQuestions(data);
            }}
            disabled={isPreviewLoading}
          >
            {isPreviewLoading ? "Loading..." : "Preview Questions"}
          </Button>
          <Button type="submit" disabled={createTemplateMutation.isPending}>
            {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
          </Button>
        </div>
      </form>

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
    </Form>
  );
}

// QuizTemplatesList component for showing templates
function QuizTemplatesList({ batchId }: { batchId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Query for quiz templates for this batch
  const { data: quizTemplates = [], isLoading: templatesLoading } = useQuery<QuizTemplate[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/quiz-templates`],
    enabled: !!user?.organizationId && !!batchId
  });
  
  // Generate quiz mutation
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
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate quiz');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Store the newly generated quiz ID
      const generatedQuizId = data.id;
      
      queryClient.invalidateQueries({ queryKey: ['/api/quizzes'] });
      toast({
        title: "Success",
        description: (
          <div className="flex flex-col gap-2">
            <p>Quiz #{generatedQuizId} has been generated and is now available to trainees</p>
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
        duration: 10000, // Show for 10 seconds to give time to click the link
      });
      
      // Also invalidate the quiz templates to refresh stats
      queryClient.invalidateQueries({ 
        queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/quiz-templates`] 
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await fetch(`/api/quiz-templates/${templateId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete template');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/quiz-templates`] 
      });
      toast({
        title: "Success",
        description: "Quiz template deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  if (templatesLoading) {
    return <p>Loading quiz templates...</p>;
  }
  
  if (quizTemplates.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No quiz templates have been created for this batch yet. Create a quiz template to get started.
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-4">
      {quizTemplates.map((template) => (
        <Card key={template.id} className="p-4">
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
                variant="outline"
                size="sm"
                onClick={() => generateQuizMutation.mutate(template.id)}
                disabled={generateQuizMutation.isPending}
              >
                <PlayCircle className="h-4 w-4 mr-1" />
                Generate Quiz
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this template?')) {
                    deleteTemplateMutation.mutate(template.id);
                  }
                }}
                disabled={deleteTemplateMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function BatchDetailsPage() {
  const { batchId } = useParams();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("attendance");
  const currentDate = format(new Date(), "PPP");
  
  // Format current date as YYYY-MM-DD for API and initialize selectedDate state
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);

  // Initialize form
  const form = useForm({
    resolver: zodResolver(phaseChangeFormSchema),
    defaultValues: {
      requestedPhase: undefined,
      justification: "",
      managerId: "",
    },
  });

  // Define the Batch type to fix type errors
  type Batch = {
    id: number;
    name: string;
    status: string;
    capacityLimit: number;
    userCount: number;
    location?: {
      name: string;
    };
    process?: {
      name: string;
    };
    trainer?: {
      id: number;
      fullName: string;
    };
    trainingPlan?: any[];
  };

  // Query hooks with improved error handling
  const { data: batch, isLoading: batchLoading, error: batchError } = useQuery<Batch>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}`],
    enabled: !!user?.organizationId && !!batchId,
  });

  const { data: trainees = [], isLoading: traineesLoading } = useQuery<any[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`, selectedDate],
    queryFn: async ({ queryKey }) => {
      const [baseUrl, date] = queryKey;
      const url = `${baseUrl}?date=${date}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch trainees');
      }
      return response.json();
    },
    enabled: !!user?.organizationId && !!batchId && !!batch,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0 // Always refetch the data
  });

  const { data: managers } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/users`],
    enabled: !!user?.organizationId,
    select: (users: any[]) => users.filter(u => u.role === 'manager'),
  });

  const { data: trainerRequests } = useQuery({
    queryKey: [`/api/trainers/${user?.id}/phase-change-requests`],
    enabled: !!user?.id && user?.role === 'trainer',
  });

  const { data: managerRequests } = useQuery({
    queryKey: [`/api/managers/${user?.id}/phase-change-requests`],
    enabled: !!user?.id && user?.role === 'manager',
  });

  // Define a type for phase requests
  type PhaseRequest = {
    id: number;
    trainerId: number;
    managerId: number;
    currentPhase: string;
    requestedPhase: string;
    status: string;
    trainer?: {
      fullName: string;
    };
  };
  
  // Initialize phase requests with proper typing
  const phaseRequests: PhaseRequest[] = user?.role === 'trainer' 
    ? (trainerRequests as PhaseRequest[] || []) 
    : user?.role === 'manager' 
      ? (managerRequests as PhaseRequest[] || []) 
      : [];

  const updateAttendanceMutation = useMutation({
    mutationFn: async ({ traineeId, status }: { traineeId: number; status: AttendanceStatus }) => {
      const response = await fetch(`/api/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          traineeId,
          status,
          date: selectedDate, // Use the selected date
          organizationId: user?.organizationId,
          batchId: parseInt(batchId!),
          phase: batch?.status,
          markedById: user?.id
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update attendance');
      }

      const responseData = await response.json();
      console.log("Attendance response data:", JSON.stringify(responseData));
      return responseData;
    },
    onSuccess: (data) => {
      console.log("Updating cache with data:", JSON.stringify(data));
      
      // First, immediately refetch the data to ensure the UI is updated
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`, selectedDate],
        refetchType: 'active',
        exact: true
      });
      
      toast({
        title: "Success",
        description: "Attendance marked successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Creating phase change request:', data);
      const response = await fetch(`/api/batches/${batchId}/phase-change-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          managerId: parseInt(data.managerId),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create request');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [
          `/api/trainers/${user?.id}/phase-change-requests`,
          `/api/managers/${user?.id}/phase-change-requests`
        ] 
      });
      toast({
        title: "Success",
        description: "Phase change request submitted successfully",
      });
      form.reset();
      const closeButton = document.querySelector('[data-dialog-close]');
      if (closeButton instanceof HTMLElement) {
        closeButton.click();
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to submit request",
      });
    },
  });

  const onSubmit = (data: any) => {
    console.log('Submitting form data:', data);
    createRequestMutation.mutate(data);
  };

  const handleApprove = async (requestId: number) => {
    try {
      await fetch(`/api/phase-change-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'approved',
        }),
      });
      queryClient.invalidateQueries({ 
        queryKey: [
          `/api/trainers/${user?.id}/phase-change-requests`,
          `/api/managers/${user?.id}/phase-change-requests`
        ]
      });
      toast({
        title: "Success",
        description: "Request approved successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve request",
      });
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      await fetch(`/api/phase-change-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'rejected',
        }),
      });
      queryClient.invalidateQueries({ 
        queryKey: [
          `/api/trainers/${user?.id}/phase-change-requests`,
          `/api/managers/${user?.id}/phase-change-requests`
        ]
      });
      toast({
        title: "Success",
        description: "Request rejected successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reject request",
      });
    }
  };

  if (batchLoading || traineesLoading) {
    return <LoadingSkeleton />;
  }

  if (batchError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load batch details. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!batch) {
    return (
      <Alert>
        <AlertDescription>
          Batch not found. Please make sure you have access to this batch.
        </AlertDescription>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-4"
          onClick={() => setLocation('/batches')}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Batches
        </Button>
      </Alert>
    );
  }

  const canAccessPhaseRequests = user?.role === 'trainer' || user?.role === 'manager';

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{batch.name}</h1>
          <p className="text-muted-foreground">
            {batch.location?.name} • {batch.process?.name}
          </p>
          {batch.trainer && (
            <p className="text-sm text-muted-foreground mt-1">
              Assigned Trainer: <span className="font-medium">{batch.trainer.fullName}</span>
            </p>
          )}
        </div>
        <Badge variant="secondary" className="capitalize">
          {batch.status}
        </Badge>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <h3 className="font-medium">Batch Capacity</h3>
            <div className="grid gap-2">
              <div className="flex justify-between font-medium">
                <span>Total Capacity:</span>
                <span>{batch.capacityLimit}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Current Trainees:</span>
                <span>{batch.userCount}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Remaining Slots:</span>
                <span>{batch.capacityLimit - batch.userCount}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          {batch.status === 'training' && (
            <TabsTrigger value="assessments">Assessments & Certifications</TabsTrigger>
          )}
          <TabsTrigger value="training-plan">Training Planner</TabsTrigger>
          {canAccessPhaseRequests && (
            <TabsTrigger value="phase-requests">Phase Requests</TabsTrigger>
          )}
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Attendance Tracking</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label htmlFor="date" className="text-sm font-medium">Date:</label>
                    <input 
                      type="date" 
                      id="date" 
                      className="border rounded p-1 text-sm" 
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>
                  <p className="text-muted-foreground">{currentDate}</p>
                </div>
              </div>

              {trainees && trainees.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainee Name</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainees.map((trainee: any) => {
                      return (
                        <TableRow key={trainee.id}>
                          <TableCell>
                            {trainee.fullName || (trainee.user && trainee.user.fullName) || 'No name'}
                          </TableCell>
                          <TableCell>
                            {trainee.employeeId || (trainee.user && trainee.user.employeeId) || 'No ID'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(trainee.status as AttendanceStatus)}
                              <span className={`capitalize ${statusColors[trainee.status as AttendanceStatus] || ''}`}>
                                {trainee.status || 'Not marked'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {trainee.lastUpdated ? format(new Date(trainee.lastUpdated), "hh:mm a") : '-'}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={trainee.status || ''}
                              onValueChange={(value: AttendanceStatus) =>
                                updateAttendanceMutation.mutate({ traineeId: trainee.id, status: value })
                              }
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="Mark attendance" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="present" className={statusColors.present}>Present</SelectItem>
                                <SelectItem value="absent" className={statusColors.absent}>Absent</SelectItem>
                                <SelectItem value="late" className={statusColors.late}>Late</SelectItem>
                                <SelectItem value="leave" className={statusColors.leave}>Leave</SelectItem>
                                <SelectItem value="half_day" className={statusColors.half_day}>Half Day</SelectItem>
                                <SelectItem value="public_holiday" className={statusColors.public_holiday}>Public Holiday</SelectItem>
                                <SelectItem value="weekly_off" className={statusColors.weekly_off}>Weekly Off</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <AlertDescription>
                    No trainees found in this batch.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {batch.status === 'training' && (
          <TabsContent value="assessments" className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Assessments & Certifications</h2>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>Create Quiz Template</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create Quiz Template</DialogTitle>
                        <DialogDescription>
                          Create a quiz template for this batch. The template will be used to generate quizzes for the trainees.
                        </DialogDescription>
                      </DialogHeader>
                      <QuizTemplateForm batchId={batch.id} />
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="bg-white shadow-sm border">
                    <CardContent className="p-5 flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                        <ClipboardCheck className="h-6 w-6 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-semibold mb-1">5</h3>
                      <p className="text-gray-600 text-center">Pending Assessments</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white shadow-sm border">
                    <CardContent className="p-5 flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      </div>
                      <h3 className="text-xl font-semibold mb-1">3</h3>
                      <p className="text-gray-600 text-center">Completed Certifications</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white shadow-sm border">
                    <CardContent className="p-5 flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                        <AlertCircle className="h-6 w-6 text-amber-600" />
                      </div>
                      <h3 className="text-xl font-semibold mb-1">75%</h3>
                      <p className="text-gray-600 text-center">Average Assessment Score</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Quiz Templates</h3>
                  <div className="grid gap-4">
                    <QuizTemplatesList batchId={batch.id} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="training-plan" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Training Schedule</h2>
              <Alert>
                <AlertDescription>
                  Training planner interface will be implemented here.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {canAccessPhaseRequests && (
          <TabsContent value="phase-requests" className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Phase Change Requests</h2>
                  {user?.role === 'trainer' && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button>Request Phase Change</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Request Phase Change</DialogTitle>
                          <DialogDescription>
                            Submit a request to change the batch phase. This will need approval from your reporting manager.
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                              control={form.control}
                              name="requestedPhase"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Requested Phase</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select phase" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="induction">Induction</SelectItem>
                                      <SelectItem value="training">Training</SelectItem>
                                      <SelectItem value="certification">Certification</SelectItem>
                                      <SelectItem value="ojt">OJT</SelectItem>
                                      <SelectItem value="ojt_certification">OJT Certification</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="justification"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Justification</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Explain why this phase change is needed..."
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="managerId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Reporting Manager</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select manager" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {managers?.map((manager: any) => (
                                        <SelectItem key={manager.id} value={manager.id.toString()}>
                                          {manager.fullName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <DialogFooter>
                              <Button 
                                type="submit" 
                                disabled={createRequestMutation.isPending}
                              >
                                {createRequestMutation.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                  </>
                                ) : (
                                  'Submit Request'
                                )}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                {phaseRequests && phaseRequests.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Batch Name</TableHead>
                        <TableHead>Current Phase</TableHead>
                        <TableHead>Requested Phase</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phaseRequests.map((request: any) => (
                        <TableRow key={request.id}>
                          <TableCell>{request.trainer?.fullName}</TableCell>
                          <TableCell>{batch.name}</TableCell>
                          <TableCell className="capitalize">{request.currentPhase}</TableCell>
                          <TableCell className="capitalize">{request.requestedPhase}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                request.status === 'pending' 
                                  ? 'outline' 
                                  : request.status === 'approved' 
                                    ? 'default'
                                    : 'destructive'
                              }
                            >
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user?.id === request.managerId && request.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApprove(request.id)}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReject(request.id)}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Alert>
                    <AlertDescription>
                      No phase change requests found.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Batch History</h2>
              </div>
              <BatchTimeline batchId={batchId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}