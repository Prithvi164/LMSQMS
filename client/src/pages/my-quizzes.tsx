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
import { Loader2, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

export function MyQuizzesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch available quizzes for the trainee
  const { data: quizzes, isLoading } = useQuery({
    queryKey: ["/api/trainee/quizzes"],
    enabled: !!user && user.role === "trainee",
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
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
        {quizzes.map((quiz: any) => {
          const startTime = new Date(quiz.startTime);
          const endTime = new Date(quiz.endTime);
          const now = new Date();
          
          const isActive = quiz.status === "active" && 
                          now >= startTime && 
                          now <= endTime;
          
          const hasAttempted = quiz.attempts && quiz.attempts.length > 0;
          
          return (
            <Card key={quiz.id} className="relative">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{quiz.title}</CardTitle>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant={isActive ? "default" : "secondary"}>
                          {isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isActive 
                          ? "Quiz is currently available"
                          : now < startTime
                            ? "Quiz hasn't started yet"
                            : "Quiz has ended"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardDescription>
                  Process: {quiz.processName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="mr-2 h-4 w-4" />
                    <span>
                      {format(startTime, "PPp")} - {format(endTime, "PPp")}
                    </span>
                  </div>
                  
                  {hasAttempted ? (
                    <div className="flex items-center text-sm">
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      <span>Completed with score: {quiz.attempts[0].score}%</span>
                    </div>
                  ) : !isActive ? (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <XCircle className="mr-2 h-4 w-4" />
                      <span>Not available</span>
                    </div>
                  ) : null}
                  
                  <Button
                    className="w-full mt-4"
                    onClick={() => setLocation(`/quiz-taking/${quiz.id}`)}
                    disabled={!isActive || hasAttempted}
                  >
                    {hasAttempted 
                      ? "Already Completed" 
                      : isActive 
                        ? "Start Quiz" 
                        : "Not Available"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default MyQuizzesPage;
