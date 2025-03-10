import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import type { Question, QuizTemplate } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// Process filter form schema
const filterFormSchema = z.object({
  processId: z.string().optional()
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
});

// Process filter form schema

// Define all types after schemas
type QuestionFormValues = z.infer<typeof questionFormSchema>;
type QuizTemplateFormValues = z.infer<typeof quizTemplateSchema>;
type FilterFormValues = z.infer<typeof filterFormSchema>;

export function QuizManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [isAddTemplateOpen, setIsAddTemplateOpen] = useState(false);

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
      console.log('Submitting question data:', data);
      const questionData = {
        ...data,
        options: data.type === 'multiple_choice' ? data.options : [],
        organizationId: user.organizationId,
        createdBy: user.id
      };

      console.log('Creating question with data:', questionData);

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

      // Invalidate and refetch questions
      await queryClient.invalidateQueries({ queryKey: ['/api/questions', selectedProcessId] });

      toast({
        title: "Success",
        description: "Question added successfully",
      });
      setIsAddQuestionOpen(false);
      questionForm.reset();
    } catch (error) {
      console.error('Error saving question:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add question",
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
      setIsAddTemplateOpen(false);
      setPreviewQuestions([]);
      templateForm.reset();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add template",
        variant: "destructive",
      });
    }
  };

  // Add state for tracking selected questions preview
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

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
                    <Dialog open={isAddQuestionOpen} onOpenChange={setIsAddQuestionOpen}>
                      <DialogTrigger asChild>
                        <Button>Add Question</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Add New Question</DialogTitle>
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

                            <Button type="submit">Add Question</Button>
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
                          <span className="text-sm px-2 py-1 bg-primary/10 rounded-md">
                            Level {question.difficultyLevel}
                          </span>
                          <span className="text-sm px-2 py-1 bg-primary/10 rounded-md">
                            {question.category}
                          </span>
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Quiz Templates</h2>
              <Dialog open={isAddTemplateOpen} onOpenChange={setIsAddTemplateOpen}>
                <DialogTrigger asChild>
                  <Button>Create Quiz Template</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Quiz Template</DialogTitle>
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
                        <Button type="submit">Create Template</Button>
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

          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default QuizManagement;