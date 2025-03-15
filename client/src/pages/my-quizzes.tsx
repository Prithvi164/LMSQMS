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

interface Quiz {
  id: number;
  title: string;
  description: string | null;
  timeLimit: number;
  passingScore: number;
  startTime: string;
  endTime: string;
  status: string;
}

// This page shows available quizzes for users in training (category: trainee)
export function MyQuizzesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch available quizzes for users in training (identified by category, not role)
  const { data: quizzes, isLoading } = useQuery<Quiz[]>({
    queryKey: ["/api/trainee/quizzes"],
    enabled: !!user && user.category === "trainee", // Only check category, role can be any valid role
  });

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
          <Card key={quiz.id}>
            <CardHeader>
              <CardTitle>{quiz.title}</CardTitle>
              <CardDescription>{quiz.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>Time Limit:</span>
                <span>{quiz.timeLimit} minutes</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Passing Score:</span>
                <span>{quiz.passingScore}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Available Until:</span>
                <span>{format(new Date(quiz.endTime), 'PPp')}</span>
              </div>
              <Button 
                className="w-full"
                onClick={() => setLocation(`/quiz/${quiz.id}`)}
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