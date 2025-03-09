import { FC } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { Question, QuizTemplate } from "@shared/schema";

const QuizManagement: FC = () => {
  const { toast } = useToast();

  const { data: questions, isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ['/api/questions'],
  });

  const { data: quizTemplates, isLoading: templatesLoading } = useQuery<QuizTemplate[]>({
    queryKey: ['/api/quiz-templates'],
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Questions</h2>
              <Button>Add Question</Button>
            </div>

            {questionsLoading ? (
              <p>Loading questions...</p>
            ) : questions?.length === 0 ? (
              <p>No questions created yet.</p>
            ) : (
              <div className="grid gap-4">
                {questions?.map((question) => (
                  <Card key={question.id} className="p-4">
                    <h3 className="font-medium">{question.question}</h3>
                    <p className="text-sm text-muted-foreground">
                      Type: {question.type} | Difficulty: {question.difficultyLevel}
                    </p>
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