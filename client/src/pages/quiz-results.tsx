import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface QuizAnswer {
  questionId: number;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

interface QuizAttemptResult {
  id: number;
  score: number;
  completedAt: string;
  quiz: {
    id: number;
    name: string;
    description: string | null;
    questions: Array<{
      id: number;
      question: string;
      type: string;
      options: string[];
      userAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
    }>;
  };
}

export function QuizResultsPage() {
  const { attemptId } = useParams();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data: result, isLoading: dataLoading } = useQuery<QuizAttemptResult>({
    queryKey: [`/api/quiz-attempts/${attemptId}`],
    enabled: !!attemptId && !!user,
  });

  const isLoading = authLoading || dataLoading;

  // Handle authentication loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Checking authentication...</span>
      </div>
    );
  }

  // Handle unauthenticated state
  if (!user) {
    setLocation('/auth');
    return null;
  }

  // Handle data loading
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading results...</span>
      </div>
    );
  }

  // Handle missing data
  if (!result) {
    return (
      <div className="container mx-auto py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Results Not Found</CardTitle>
            <CardDescription>
              The quiz results you're looking for could not be found.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center pt-4">
              <Button onClick={() => window.history.back()}>
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Quiz Results: {result.quiz.name}</CardTitle>
          <CardDescription>
            Your score: {result.score.toFixed(1)}%
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {result.quiz.questions.map((question, index) => (
              <div
                key={question.id}
                className={`p-4 rounded-lg border ${
                  question.isCorrect ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {question.isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">
                      Question {index + 1}: {question.question}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your answer: {question.userAnswer}
                    </p>
                    {!question.isCorrect && (
                      <p className="text-sm text-green-600 mt-1">
                        Correct answer: {question.correctAnswer}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-center pt-4">
              <Button onClick={() => window.history.back()}>
                Return to Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}