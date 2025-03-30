import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Types
type QuizResult = {
  quizId: number;
  quizName: string;
  score: number;
  passingScore: number;
  status: 'pass' | 'fail';
  completedAt: string;
};

type TraineeQuizResult = {
  traineeId: number;
  fullName: string;
  employeeId: string;
  quizzes: QuizResult[];
};

type QuizResultsProps = {
  batchId?: number;
  userId?: number;
  organizationId: number;
  showTitle?: boolean;
};

// Format date properly
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  } catch {
    return 'Invalid date';
  }
};

export const QuizResultsDisplay = ({ 
  batchId, 
  userId, 
  organizationId,
  showTitle = true
}: QuizResultsProps) => {
  const [expandedTrainee, setExpandedTrainee] = useState<number | null>(null);

  // Query for batch quiz results
  const batchQuery = useQuery({
    queryKey: ['/api/organizations', organizationId, 'batches', batchId, 'quiz-results'],
    enabled: !!batchId && !!organizationId,
  });

  // Query for individual user quiz results
  const userQuery = useQuery({
    queryKey: ['/api/organizations', organizationId, 'users', userId, 'quiz-results'],
    enabled: !!userId && !!organizationId,
  });

  // Handle loading state
  const isLoading = (batchId && batchQuery.isLoading) || (userId && userQuery.isLoading);
  
  // Handle error state
  const hasError = (batchId && batchQuery.isError) || (userId && userQuery.isError);
  
  // Get data based on query type
  const data = batchId ? batchQuery.data : userQuery.data;

  // Toggle expanded trainee
  const toggleTrainee = (traineeId: number) => {
    if (expandedTrainee === traineeId) {
      setExpandedTrainee(null);
    } else {
      setExpandedTrainee(traineeId);
    }
  };

  // Show loading skeleton
  if (isLoading) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="text-base">Quiz Results</CardTitle>
            <CardDescription>Loading quiz results...</CardDescription>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle error state
  if (hasError) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="text-base">Quiz Results</CardTitle>
            <CardDescription>Error loading quiz results</CardDescription>
          </CardHeader>
        )}
        <CardContent>
          <div className="p-4 text-center text-red-500">
            Failed to load quiz results. Please try again later.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Display for individual user's quiz results
  if (userId) {
    const quizResults = data as QuizResult[];
    
    if (!quizResults || quizResults.length === 0) {
      return (
        <Card>
          {showTitle && (
            <CardHeader>
              <CardTitle className="text-base">Quiz Results</CardTitle>
              <CardDescription>No quiz results found</CardDescription>
            </CardHeader>
          )}
          <CardContent>
            <div className="text-center text-muted-foreground py-4">
              No quiz attempts found for this trainee.
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="text-base">Quiz Results</CardTitle>
            <CardDescription>{quizResults.length} quiz attempts found</CardDescription>
          </CardHeader>
        )}
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quiz Name</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizResults.map((result) => (
                <TableRow key={`${result.quizId}-${result.completedAt}`}>
                  <TableCell>{result.quizName}</TableCell>
                  <TableCell>{result.score}% (Passing: {result.passingScore}%)</TableCell>
                  <TableCell>
                    <Badge 
                      variant={result.status === 'pass' ? 'success' : 'destructive'}
                    >
                      {result.status === 'pass' ? 'PASS' : 'FAIL'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(result.completedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  // Display for batch quiz results
  const batchResults = data as TraineeQuizResult[];

  if (!batchResults || batchResults.length === 0) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="text-base">Quiz Results</CardTitle>
            <CardDescription>No quiz results found</CardDescription>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            No quiz attempts found for trainees in this batch.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate some statistics
  const totalTrainees = batchResults.length;
  const traineesWithQuizzes = batchResults.filter(t => t.quizzes.length > 0).length;
  const totalQuizAttempts = batchResults.reduce((sum, trainee) => sum + trainee.quizzes.length, 0);

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="text-base">Quiz Results</CardTitle>
          <CardDescription>
            {traineesWithQuizzes} of {totalTrainees} trainees have taken quizzes, 
            with {totalQuizAttempts} total quiz attempts
          </CardDescription>
        </CardHeader>
      )}
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trainee</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Quizzes Taken</TableHead>
              <TableHead>Pass Rate</TableHead>
              <TableHead>Average Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batchResults.map((trainee) => {
              // Calculate statistics for this trainee
              const quizCount = trainee.quizzes.length;
              const passCount = trainee.quizzes.filter(q => q.status === 'pass').length;
              const passRate = quizCount > 0 ? Math.round((passCount / quizCount) * 100) : 0;
              const avgScore = quizCount > 0 
                ? Math.round(trainee.quizzes.reduce((sum, q) => sum + q.score, 0) / quizCount) 
                : 0;
              
              return (
                <>
                  <TableRow 
                    key={trainee.traineeId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleTrainee(trainee.traineeId)}
                  >
                    <TableCell className="font-medium">{trainee.fullName}</TableCell>
                    <TableCell>{trainee.employeeId}</TableCell>
                    <TableCell>{quizCount}</TableCell>
                    <TableCell>
                      {quizCount > 0 ? (
                        <Badge 
                          variant={passRate >= 80 ? 'success' : passRate >= 50 ? 'default' : 'destructive'}
                        >
                          {passRate}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">No quizzes</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {quizCount > 0 ? `${avgScore}%` : '-'}
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded details row */}
                  {expandedTrainee === trainee.traineeId && quizCount > 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <div className="bg-muted/30 p-4 rounded-md my-2">
                          <div className="font-semibold mb-2">Quiz Details</div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Quiz Name</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date Completed</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {trainee.quizzes.map((quiz) => (
                                <TableRow key={`${trainee.traineeId}-${quiz.quizId}-${quiz.completedAt}`}>
                                  <TableCell>{quiz.quizName}</TableCell>
                                  <TableCell>{quiz.score}% (Passing: {quiz.passingScore}%)</TableCell>
                                  <TableCell>
                                    <Badge 
                                      variant={quiz.status === 'pass' ? 'success' : 'destructive'}
                                    >
                                      {quiz.status === 'pass' ? 'PASS' : 'FAIL'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{formatDate(quiz.completedAt)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};