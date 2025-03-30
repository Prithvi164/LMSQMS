import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Award, XCircle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type QuizAttempt = {
  id: number;
  userId: number;
  score: number;
  completedAt: string;
  isPassed: boolean;
  user?: {
    fullName: string;
  };
  quiz?: {
    id: number;
    name: string | null;
    description: string | null;
    passingScore: number | null;
  };
};

type BatchQuizAttemptsProps = {
  organizationId: number;
  batchId: number;
  filter: "all" | "passed" | "failed";
};

export function BatchQuizAttempts({ organizationId, batchId, filter }: BatchQuizAttemptsProps) {
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: attempts, isLoading, error } = useQuery<QuizAttempt[]>({
    queryKey: [
      `/api/organizations/${organizationId}/batches/${batchId}/quiz-attempts`,
      filter
    ],
    queryFn: async ({ queryKey }) => {
      const [baseUrl, filterType] = queryKey;
      
      let url = `${baseUrl}?page=${page}&limit=${limit}`;
      // The server now handles the status filtering
      if (filterType === 'passed') {
        url += '&status=passed';
      } else if (filterType === 'failed') {
        url += '&status=failed';
      }
      
      console.log("Fetching quiz attempts with URL:", url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch quiz attempts');
      }
      return response.json();
    },
    enabled: !!organizationId && !!batchId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load quiz attempts. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!attempts || attempts.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No {filter === 'passed' ? 'passed' : filter === 'failed' ? 'failed' : ''} quiz attempts found for this batch.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trainee</TableHead>
            <TableHead>Quiz Name</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Passing Score</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Completed On</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attempts.map((attempt) => (
            <TableRow key={attempt.id}>
              <TableCell>{attempt.user?.fullName || "Unknown Trainee"}</TableCell>
              <TableCell>{attempt.quiz?.name || "Unnamed Quiz"}</TableCell>
              <TableCell>{attempt.score}%</TableCell>
              <TableCell>{attempt.quiz?.passingScore || "-"}%</TableCell>
              <TableCell>
                {attempt.isPassed ? (
                  <Badge className="bg-green-500 flex items-center">
                    <Award className="mr-1 h-3 w-3" />
                    Passed
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="flex items-center">
                    <XCircle className="mr-1 h-3 w-3" />
                    Failed
                  </Badge>
                )}
              </TableCell>
              <TableCell className="flex items-center">
                <Clock className="mr-1 h-3 w-3" />
                {format(new Date(attempt.completedAt), "dd MMM yyyy, hh:mm a")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}