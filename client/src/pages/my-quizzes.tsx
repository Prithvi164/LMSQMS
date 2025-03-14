import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import type { Quiz, QuizAttempt } from "@shared/schema";

interface QuizWithAttempts extends Quiz {
  attempts: QuizAttempt[];
}

// This page shows available quizzes for users in training (category: trainee)
export function MyQuizzesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch available quizzes for users in training (identified by category, not role)
  const { data: quizzes, isLoading } = useQuery<QuizWithAttempts[]>({
    queryKey: ["/api/trainee/quizzes"],
    enabled: !!user && user.category === "trainee",
  });

  console.log("Quizzes data:", quizzes); // Debug log

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Clock className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!quizzes || quizzes.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No quizzes are currently available. Check back later or contact your trainer.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">My Quizzes</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quizzes.map((quiz) => (
          <Card key={quiz.id} className="flex flex-col">
            <CardHeader>
              <CardTitle>{quiz.name}</CardTitle>
              <CardDescription>
                Time Limit: {quiz.timeLimit} minutes
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    Passing Score: {quiz.passingScore}%
                  </Badge>
                </div>
                {quiz.description && (
                  <p className="text-sm text-muted-foreground">
                    {quiz.description}
                  </p>
                )}
              </div>
            </CardContent>
            <CardContent className="pt-0">
              <Button 
                className="w-full"
                onClick={() => setLocation(`/quiz-taking/${quiz.id}`)}
              >
                Start Quiz
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default MyQuizzesPage;