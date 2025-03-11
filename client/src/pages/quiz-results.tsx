import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface QuizAnswer {
  questionId: number;
  question: string;
  type: string;
  options: string[];
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

interface QuizAttemptResult {
  id: number;
  score: number;
  completedAt: string;
  quiz: {
    name: string;
    description: string | null;
  };
  answers: QuizAnswer[];
}

export function QuizResultsPage() {
  const { attemptId } = useParams();

  const { data: result, isLoading } = useQuery<QuizAttemptResult>({
    queryKey: [`/api/quiz-attempts/${attemptId}`],
    enabled: !!attemptId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading results...</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Results not found.</p>
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
            <br />
            Completed at: {new Date(result.completedAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {result.answers.map((answer, index) => (
              <div
                key={answer.questionId}
                className={`p-4 rounded-lg border ${
                  answer.isCorrect ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {answer.isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">
                      Question {index + 1}: {answer.question}
                    </h3>
                    {answer.type === "multiple_choice" && (
                      <div className="mt-2 space-y-1">
                        {answer.options.map((option, optIndex) => (
                          <div
                            key={optIndex}
                            className={`p-2 rounded ${
                              option === answer.userAnswer
                                ? answer.isCorrect
                                  ? "bg-green-100"
                                  : "bg-red-100"
                                : option === answer.correctAnswer && !answer.isCorrect
                                ? "bg-green-100"
                                : "bg-gray-50"
                            }`}
                          >
                            {option}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                      Your answer: {answer.userAnswer}
                    </p>
                    {!answer.isCorrect && (
                      <p className="text-sm text-green-600 mt-1">
                        Correct answer: {answer.correctAnswer}
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