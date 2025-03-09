import { FC, useState, useMemo } from "react";
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
import {Badge} from "@/components/ui/badge"

// Question form schema
const questionFormSchema = z.object({
  question: z.string().min(1, "Question is required"),
  type: z.enum(["multiple_choice", "true_false", "short_answer"]),
  options: z.array(z.string()).default([]),  // Default to empty array instead of optional
  correctAnswer: z.string().min(1, "Correct answer is required"),
  explanation: z.string().optional(),
  difficultyLevel: z.number().int().min(1).max(5),
  category: z.string().min(1, "Category is required")
});

type QuestionFormValues = z.infer<typeof questionFormSchema>;

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


const QuizManagement: FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [isAddTemplateOpen, setIsAddTemplateOpen] = useState(false);

  const questionForm = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      type: "multiple_choice",
      difficultyLevel: 1,
      options: ["", ""],  // Initialize with two empty options
      category: ""
    }
  });

  // Add query for processes
  const { data: processes } = useQuery({
    queryKey: ['/api/processes'],
  });

  const templateForm = useForm<QuizTemplateFormValues>({
    resolver: zodResolver(quizTemplateSchema),
    defaultValues: {
      timeLimit: 10,
      questionCount: 10,
      passingScore: 70,
    }
  });

  const { data: questions, isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ['/api/questions'],
  });

  const { data: quizTemplates, isLoading: templatesLoading } = useQuery<QuizTemplate[]>({
    queryKey: ['/api/quiz-templates'],
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
      // Always ensure options is an array
      const questionData = {
        ...data,
        options: data.type === 'multiple_choice' ? data.options : [],
        organizationId: user.organizationId,
        createdBy: user.id
      };
      console.log('Processed question data:', questionData);

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
      await queryClient.invalidateQueries({ queryKey: ['/api/questions'] });

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
        processId: data.processId // Ensure processId is included
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Questions</h2>
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

            {questionsLoading ? (
              <p>Loading questions...</p>
            ) : questions?.length === 0 ? (
              <p>No questions created yet.</p>
            ) : (
              <div className="grid gap-4">
                {questions?.map((question) => (
                  <Card key={question.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-lg">{question.question}</h3>
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
                                  <SelectValue placeholder="Select a process" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {processes?.map((process) => (
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

            {templatesLoading ? (
              <p>Loading templates...</p>
            ) : quizTemplates?.length === 0 ? (
              <p>No quiz templates created yet.</p>
            ) : (
              <div className="grid gap-4">
                {quizTemplates?.map((template) => (
                  <Card key={template.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-lg font-medium">{template.name}</h3>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="outline" size="sm">Start Quiz</Button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="font-medium mb-2">Quiz Settings</h4>
                          <ul className="space-y-1 text-muted-foreground">
                            <li>Time Limit: {template.timeLimit} minutes</li>
                            <li>Number of Questions: {template.questionCount}</li>
                            <li>Passing Score: {template.passingScore}%</li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Question Selection</h4>
                          {template.categoryDistribution && (
                            <div className="mb-2">
                              <p className="text-xs text-muted-foreground mb-1">Categories:</p>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(template.categoryDistribution).map(([category, count]) => (
                                  <Badge key={category} variant="outline" className="text-xs">
                                    {category}: {count}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {template.difficultyDistribution && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Difficulty Levels:</p>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(template.difficultyDistribution).map(([level, count]) => (
                                  <Badge key={level} variant="outline" className="text-xs">
                                    Level {level}: {count}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {template.shuffleQuestions && (
                          <Badge variant="secondary">Shuffle Questions</Badge>
                        )}
                        {template.shuffleOptions && (
                          <Badge variant="secondary">Shuffle Options</Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default QuizManagement;