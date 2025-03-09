import { FC, useState } from "react";
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

const QuizManagement: FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);

  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      type: "multiple_choice",
      difficultyLevel: 1,
      options: ["", ""],  // Initialize with two empty options
      category: ""
    }
  });

  const { data: questions, isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ['/api/questions'],
  });

  const { data: quizTemplates, isLoading: templatesLoading } = useQuery<QuizTemplate[]>({
    queryKey: ['/api/quiz-templates'],
  });

  const onSubmit = async (data: QuestionFormValues) => {
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
      form.reset();
    } catch (error) {
      console.error('Error saving question:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add question",
        variant: "destructive",
      });
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
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
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
                        control={form.control}
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

                      {form.watch("type") === "multiple_choice" && (
                        <FormField
                          control={form.control}
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
                        control={form.control}
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
                        control={form.control}
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
                        control={form.control}
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
                        control={form.control}
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
              <Button>Create Quiz Template</Button>
            </div>

            {templatesLoading ? (
              <p>Loading templates...</p>
            ) : quizTemplates?.length === 0 ? (
              <p>No quiz templates created yet.</p>
            ) : (
              <div className="grid gap-4">
                {quizTemplates?.map((template) => (
                  <Card key={template.id} className="p-4">
                    <h3 className="font-medium">{template.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Time Limit: {template.timeLimit} minutes |
                      Passing Score: {template.passingScore}%
                    </p>
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