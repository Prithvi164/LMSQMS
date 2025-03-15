import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

export function MyQuizzesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Add debug logs
  console.log("Current user:", user);
  console.log("User category:", user?.category);

  // Fetch available quizzes for the trainee
  const { data: quizzes = [], isLoading, error } = useQuery({
    queryKey: ["/api/trainee/quizzes"],
    queryFn: async () => {
      try {
        console.log("Fetching quizzes...");
        const response = await fetch("/api/trainee/quizzes");
        console.log("Quiz response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to fetch quizzes");
        }

        const data = await response.json();
        console.log("Fetched quizzes data:", data);
        return data;
      } catch (err) {
        console.error("Error fetching quizzes:", err);
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to fetch quizzes",
          variant: "destructive",
        });
        throw err;
      }
    },
    enabled: !!user && user.category === 'trainee',
  });

  // Debug logs
  console.log("Query state:", { isLoading, error, quizzes });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Clock className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">
              {error instanceof Error ? error.message : "Failed to load quizzes"}
            </p>
          </CardContent>
        </Card>
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
        {quizzes.map((quiz: any) => (
          <Card key={quiz.quiz_id}>
            <CardHeader>
              <CardTitle>{quiz.quiz_name}</CardTitle>
              <CardDescription>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">
                    Time: {quiz.timeLimit} min
                  </Badge>
                  <Badge variant="secondary">
                    Pass: {quiz.passingScore}%
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Process: {quiz.processName}
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full"
                onClick={() => setLocation(`/quiz-taking/${quiz.quiz_id}`)}
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