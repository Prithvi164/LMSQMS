import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useLocation } from "wouter";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle, XCircle, Award, RefreshCw, FileQuestion } from "lucide-react";

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
    quizType: 'internal' | 'final';
  };
};

type BatchQuizAttemptsProps = {
  organizationId: number;
  batchId: number;
  filter: "all" | "passed" | "failed";
};

export function BatchQuizAttempts({ organizationId, batchId, filter }: BatchQuizAttemptsProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState<"all" | "passed" | "failed">(filter || "all");
  
  // For modal states
  const [refresherDialogOpen, setRefresherDialogOpen] = useState(false);
  const [refresherNotes, setRefresherNotes] = useState("");
  const [selectedTraineeId, setSelectedTraineeId] = useState<number | null>(null);
  
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);
  
  const [certificationDialogOpen, setCertificationDialogOpen] = useState(false);
  const [selectedQuizAttemptId, setSelectedQuizAttemptId] = useState<number | null>(null);

  // Fetch quizzes for reassignment
  const { data: quizzes } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/quizzes`],
    enabled: reassignDialogOpen
  });

  // Fetch quiz attempts
  const { data: quizAttempts, isLoading } = useQuery({
    queryKey: [
      `/api/organizations/${organizationId}/batches/${batchId}/quiz-attempts`,
      activeTab !== "all" ? { status: activeTab } : undefined,
    ]
  });
  
  // Debug logging - Uncomment to trace the data
  // React.useEffect(() => {
  //   if (quizAttempts) {
  //     console.log("Quiz attempts data:", quizAttempts);
  //     console.log("Final quiz attempts:", quizAttempts?.filter((attempt: any) => attempt.quiz?.quizType === 'final'));
  //   }
  // }, [quizAttempts]);

  // Mutation for scheduling refresher training
  const scheduleRefresherMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTraineeId) return;
      
      return apiRequest(
        `/api/organizations/${organizationId}/batches/${batchId}/trainees/${selectedTraineeId}/refresher`,
        {
          method: "POST",
          body: JSON.stringify({ notes: refresherNotes }),
        }
      );
    },
    onSuccess: () => {
      toast({
        title: "Refresher Scheduled",
        description: "Refresher training has been scheduled successfully",
      });
      setRefresherDialogOpen(false);
      setRefresherNotes("");
      setSelectedTraineeId(null);
      // Refresh batch events if needed
      queryClient.invalidateQueries({ queryKey: [`/api/batches/${batchId}/events`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to schedule refresher training",
        variant: "destructive",
      });
    },
  });

  // Mutation for reassigning quiz
  const reassignQuizMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTraineeId || !selectedQuizId) return;
      
      return apiRequest(
        `/api/organizations/${organizationId}/batches/${batchId}/trainees/${selectedTraineeId}/reassign-quiz`,
        {
          method: "POST",
          body: JSON.stringify({ quizId: selectedQuizId }),
        }
      );
    },
    onSuccess: () => {
      toast({
        title: "Quiz Reassigned",
        description: "Quiz has been reassigned to the trainee",
      });
      setReassignDialogOpen(false);
      setSelectedQuizId(null);
      setSelectedTraineeId(null);
      // Refresh relevant data
      queryClient.invalidateQueries({ queryKey: [`/api/batches/${batchId}/events`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to reassign quiz",
        variant: "destructive",
      });
    },
  });

  // Mutation for creating certification
  const createCertificationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTraineeId || !selectedQuizAttemptId) return;
      
      return apiRequest(
        `/api/organizations/${organizationId}/batches/${batchId}/trainees/${selectedTraineeId}/certification`,
        {
          method: "POST",
          body: JSON.stringify({ quizAttemptId: selectedQuizAttemptId }),
        }
      );
    },
    onSuccess: () => {
      toast({
        title: "Certification Created",
        description: "Certification has been created successfully",
      });
      setCertificationDialogOpen(false);
      setSelectedQuizAttemptId(null);
      setSelectedTraineeId(null);
      // Refresh relevant data
      queryClient.invalidateQueries({ queryKey: [`/api/batches/${batchId}/events`] });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create certification",
        variant: "destructive",
      });
    },
  });

  // Handler for refresher dialog
  const handleRefresherClick = (traineeId: number) => {
    setSelectedTraineeId(traineeId);
    setRefresherDialogOpen(true);
  };

  // Handler for reassign dialog
  const handleReassignClick = (traineeId: number) => {
    setSelectedTraineeId(traineeId);
    setReassignDialogOpen(true);
  };

  const [, navigate] = useLocation();
  
  // Handler for certification dialog
  const handleCertificationClick = (traineeId: number, quizAttemptId: number, traineeName: string) => {
    // Option 1: Show the certification dialog first
    // setSelectedTraineeId(traineeId);
    // setSelectedQuizAttemptId(quizAttemptId);
    // setCertificationDialogOpen(true);
    
    // Option 2: Directly navigate to the conduct evaluation page with pre-selected values
    navigate(`/conduct-evaluation?batchId=${batchId}&traineeId=${traineeId}&traineeName=${encodeURIComponent(traineeName || '')}`);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Final Assessment Results</CardTitle>
        <CardDescription>
          View final quiz results and manage trainee certifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Final Assessments</TabsTrigger>
            <TabsTrigger value="passed">Passed Final Assessments</TabsTrigger>
            <TabsTrigger value="failed">Failed Final Assessments</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : quizAttempts && quizAttempts.length > 0 ? (
              (() => {
                // Get only final quizzes
                const finalQuizAttempts = quizAttempts
                  .filter((attempt: QuizAttempt) => attempt.quiz?.quizType === 'final');
                
                if (finalQuizAttempts.length > 0) {
                  return (
                    <Table>
                      <TableCaption>
                        {activeTab === "all" 
                          ? "All final assessment results" 
                          : activeTab === "passed" 
                            ? "Final assessments with passing scores" 
                            : "Final assessments with failing scores"}
                      </TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Trainee</TableHead>
                          <TableHead>Quiz</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {finalQuizAttempts.map((attempt: QuizAttempt) => (
                          <TableRow key={attempt.id}>
                            <TableCell className="font-medium">
                              {attempt.user?.fullName || `User ${attempt.userId}`}
                            </TableCell>
                            <TableCell>{attempt.quiz?.name || "Unknown Quiz"}</TableCell>
                            <TableCell>
                              {attempt.score}%
                              {attempt.quiz?.passingScore && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  (Passing: {attempt.quiz.passingScore}%)
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(attempt.completedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {attempt.isPassed ? (
                                <Badge className="bg-green-500">Passed</Badge>
                              ) : (
                                <Badge variant="destructive">Failed</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {!attempt.isPassed ? (
                                <div className="flex justify-end space-x-2">
                                  {hasPermission("manage_batches") && (
                                    <>
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => handleRefresherClick(attempt.userId)}
                                      >
                                        <RefreshCw className="h-4 w-4 mr-1" />
                                        Refresher
                                      </Button>
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => handleReassignClick(attempt.userId)}
                                      >
                                        <FileQuestion className="h-4 w-4 mr-1" />
                                        Reassign
                                      </Button>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="flex justify-end">
                                  {hasPermission("manage_batches") && (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => handleCertificationClick(attempt.userId, attempt.id, attempt.user?.fullName || `User ${attempt.userId}`)}
                                    >
                                      <Award className="h-4 w-4 mr-1" />
                                      Certify
                                    </Button>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  );
                } else {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      No final quiz attempts found for this filter
                    </div>
                  );
                }
              })()
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No quiz attempts found
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Refresher Training Dialog */}
      <Dialog open={refresherDialogOpen} onOpenChange={setRefresherDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Refresher Training</DialogTitle>
            <DialogDescription>
              Add notes about what specific areas need focus during the refresher
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              id="refresherNotes"
              placeholder="Notes for the refresher training..."
              value={refresherNotes}
              onChange={(e) => setRefresherNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRefresherDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => scheduleRefresherMutation.mutate()}
              disabled={scheduleRefresherMutation.isPending}
            >
              {scheduleRefresherMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                "Schedule Refresher"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Quiz Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Quiz</DialogTitle>
            <DialogDescription>
              Select a quiz to reassign to the trainee
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Select 
              onValueChange={(value) => setSelectedQuizId(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a quiz to reassign" />
              </SelectTrigger>
              <SelectContent>
                {quizzes?.map((quiz: any) => (
                  <SelectItem key={quiz.id} value={quiz.id.toString()}>
                    {quiz.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setReassignDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => reassignQuizMutation.mutate()}
              disabled={reassignQuizMutation.isPending || !selectedQuizId}
            >
              {reassignQuizMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reassigning...
                </>
              ) : (
                "Reassign Quiz"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certification Dialog */}
      <Dialog open={certificationDialogOpen} onOpenChange={setCertificationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Certification</DialogTitle>
            <DialogDescription>
              Create a certification based on the passed assessment
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-6">
            <Award className="h-16 w-16 text-primary" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            This will create an official certification for the trainee and mark them as certified in the system.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCertificationDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => createCertificationMutation.mutate()}
              disabled={createCertificationMutation.isPending}
            >
              {createCertificationMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Certification"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}