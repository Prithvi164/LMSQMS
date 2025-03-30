import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, ArrowRightLeft, Loader2, BookOpen, Plus } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { isSubordinate, getAllSubordinates } from "@/lib/hierarchy-utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Updated type to match actual API response
type Trainee = {
  id: number;
  userId: number;
  employeeId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  dateOfJoining: string;
};

interface TraineeManagementProps {
  batchId: number;
  organizationId: number;
}

export function TraineeManagement({ batchId, organizationId }: TraineeManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  // State for quiz creation dialog
  const [isCreateQuizOpen, setIsCreateQuizOpen] = useState(false);
  const [selectedTrainees, setSelectedTrainees] = useState<number[]>([]);
  
  // Use hierarchy utility functions for permission checks
  
  // Define User type
  type User = {
    id: number;
    username?: string;
    fullName?: string;
    employeeId?: string;
    role: 'owner' | 'admin' | 'manager' | 'team_lead' | 'quality_analyst' | 'trainer' | 'advisor' | 'trainee';
    managerId?: number | null;
    email?: string;
    phoneNumber?: string;
    dateOfJoining?: string;
    organizationId?: number;
    processId?: number;
    status?: string;
  };
  
  // Get user for hierarchy checks
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });
  
  // Get all users for hierarchy checks
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: [`/api/organizations/${organizationId}/users`],
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
  
  // Define Batch type
  type Batch = {
    id: number;
    name: string;
    startDate: string;
    endDate?: string;
    status: string;
    location?: {
      id: number;
      name: string;
    };
    process?: {
      id: number;
      name: string;
    };
    line_of_business?: {
      id: number;
      name: string;
    };
    capacityLimit: number;
    trainer?: {
      id: number;
      fullName: string;
      email?: string;
      phoneNumber?: string;
    } | null;
  };
  
  // Fetch batch details to get trainer info
  const { data: batchDetails } = useQuery<Batch>({
    queryKey: [`/api/organizations/${organizationId}/batches/${batchId}`],
    enabled: !!batchId && !!organizationId,
  });

  // Check if the current user can view this batch based on hierarchy
  const canViewBatch = () => {
    if (!currentUser || !batchDetails || !allUsers.length) return false;
    
    // Admins and owners can see all batches
    if (currentUser.role === 'admin' || currentUser.role === 'owner') return true;
    
    // Trainers can only see their assigned batches
    if (currentUser.role === 'trainer') {
      return batchDetails.trainer?.id === currentUser.id;
    }
    
    // Managers can see all batches - they should have broader access
    if (currentUser.role === 'manager') {
      return true; // Allow managers to view all batches
    }
    
    // Team leads can see batches they're the trainer for OR batches assigned to trainers who report to them
    if (currentUser.role === 'team_lead') {
      // Direct assignment to team lead
      if (batchDetails.trainer?.id === currentUser.id) return true;
      
      // Check if trainer reports to this team lead
      return batchDetails.trainer && isSubordinate(currentUser.id, batchDetails.trainer.id, allUsers);
    }
    
    return false;
  };

  // Fetch trainees for the current batch
  const { data: trainees = [], isLoading, error } = useQuery<Trainee[]>({
    queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`],
    enabled: !!batchId && !!organizationId && canViewBatch(),
  });

  // Fetch all other batches for transfer (filtered by hierarchy)
  const { data: allBatchesRaw = [] } = useQuery<Batch[]>({
    queryKey: [`/api/organizations/${organizationId}/batches`],
    enabled: !!organizationId,
  });
  
  // Filter batches for transfers based on reporting hierarchy
  const allBatches = allBatchesRaw.filter((batch: Batch) => {
    if (!currentUser) return false;
    
    // Admins and owners can see all batches
    if (currentUser.role === 'admin' || currentUser.role === 'owner') return true;
    
    // Trainers can only see their assigned batches
    if (currentUser.role === 'trainer') {
      return batch.trainer?.id === currentUser.id;
    }
    
    // Managers can see all batches for consistency with canViewBatch
    if (currentUser.role === 'manager') {
      return true;
    }
    
    // Team leads can see batches they're the trainer for OR batches assigned to trainers who report to them
    if (currentUser.role === 'team_lead') {
      // Direct assignment to team lead
      if (batch.trainer?.id === currentUser.id) return true;
      
      // Check if trainer reports to this team lead
      return batch.trainer && isSubordinate(currentUser.id, batch.trainer.id, allUsers);
    }
    
    return false;
  });

  // Helper function to safely format dates
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PP') : 'N/A';
  };

  // Debug logging with proper type handling
  console.log('Debug - Trainees:', { 
    trainees, 
    isLoading, 
    error,
    sampleTrainee: Array.isArray(trainees) && trainees.length > 0 ? trainees[0] : null,
    traineeCount: Array.isArray(trainees) ? trainees.length : 0 
  });

  // Delete trainee mutation - using user_batch_process.id
  const deleteTraineeMutation = useMutation({
    mutationFn: async (userBatchProcessId: number) => {
      console.log('Deleting trainee batch process:', userBatchProcessId);
      const response = await fetch(
        `/api/organizations/${organizationId}/batches/${batchId}/trainees/${userBatchProcessId}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete trainee");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the current batch's trainee list
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`]
      });

      // Invalidate batches to update counts
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/batches`]
      });

      toast({
        title: "Success",
        description: "Trainee removed from batch successfully",
      });
      setIsDeleteDialogOpen(false);
      setSelectedTrainee(null);
    },
    onError: (error: Error) => {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Transfer trainee mutation
  const transferTraineeMutation = useMutation({
    mutationFn: async ({ traineeId, newBatchId }: { traineeId: number; newBatchId: number }) => {
      console.log('Starting transfer:', { traineeId, newBatchId, currentBatchId: batchId });

      const response = await fetch(
        `/api/organizations/${organizationId}/batches/${batchId}/trainees/${traineeId}/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newBatchId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to transfer trainee");
      }

      const result = await response.json();
      console.log('Transfer response:', result);
      return result;
    },
    onSuccess: () => {
      // Invalidate queries for both the source and destination batch
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/batches`]
      });

      // Invalidate the current batch's trainee list
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`]
      });

      // Close dialogs and reset state
      setIsTransferDialogOpen(false);
      setSelectedTrainee(null);

      toast({
        title: "Success",
        description: "Trainee transferred successfully",
      });
    },
    onError: (error: Error) => {
      console.error('Transfer error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check if the user has permission to view this batch
  if (batchDetails && currentUser && !canViewBatch()) {
    return (
      <div className="text-center py-8 text-destructive">
        <div className="mb-2 text-lg font-semibold">Access Denied</div>
        <p>You don't have permission to view trainees in this batch.</p>
        <p className="text-sm text-muted-foreground mt-2">
          This batch is assigned to a trainer who is not in your reporting hierarchy.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading trainees...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Error loading trainees. Please try again.
      </div>
    );
  }

  // Check if batch is in training phase - assessments only available during training
  const isTrainingPhase = batchDetails?.status === 'training';
  
  // Define assessment quiz types
  type QuizAttempt = {
    id: number;
    userId: number;
    quizId: number;
    score: number;
    completedAt: string;
    userFullName?: string;
  };
  
  type Quiz = {
    id: number;
    name: string;
    description?: string;
    templateId: number;
    status: 'assigned' | 'active' | 'completed';
    passingScore: number;
    startTime?: string;
    endTime?: string;
    userId?: number;
    userFullName?: string;
    attempts?: QuizAttempt[];
  };
  
  // Fetch assessments for this batch
  const { data: assessments = [], isLoading: isLoadingAssessments } = useQuery<Quiz[]>({
    queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/assessments`],
    enabled: !!batchId && !!organizationId && isTrainingPhase,
  });

  if (!trainees || trainees.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No trainees found in this batch.
      </div>
    );
  }
  
  // Extract passing and failing trainees
  const getPassingTrainees = () => {
    return assessments
      .filter(quiz => quiz.attempts && quiz.attempts.some(attempt => attempt.score >= quiz.passingScore))
      .map(quiz => {
        const highestAttempt = quiz.attempts?.reduce((highest, current) => 
          current.score > highest.score ? current : highest
        );
        return {
          quizName: quiz.name,
          traineeId: quiz.userId,
          traineeName: quiz.userFullName || 'Unknown',
          score: highestAttempt?.score || 0,
          passedAt: highestAttempt?.completedAt
        };
      });
  };
  
  const getFailingTrainees = () => {
    return assessments
      .filter(quiz => quiz.attempts && quiz.attempts.every(attempt => attempt.score < quiz.passingScore))
      .map(quiz => {
        const lastAttempt = quiz.attempts?.sort((a, b) => 
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
        )[0];
        return {
          quizName: quiz.name,
          traineeId: quiz.userId,
          traineeName: quiz.userFullName || 'Unknown',
          score: lastAttempt?.score || 0,
          attemptedAt: lastAttempt?.completedAt
        };
      });
  };
  
  // Get list of trainees who need to be assigned assessment or haven't taken it yet
  const getPendingTrainees = () => {
    const assignedTraineeIds = new Set(assessments.map(quiz => quiz.userId));
    return trainees.filter(trainee => !assignedTraineeIds.has(trainee.userId));
  };
  
  // Schedule refresher training mutation
  const scheduleRefresherMutation = useMutation({
    mutationFn: async (traineeId: number) => {
      // This would be replaced with an actual endpoint to schedule refresher training
      const response = await fetch(`/api/organizations/${organizationId}/batches/${batchId}/trainees/${traineeId}/refresher`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to schedule refresher training");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Refresher training scheduled successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule refresher training",
        variant: "destructive",
      });
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <h2 className="text-lg font-semibold">Batch Management</h2>
        {batchDetails?.trainer && (
          <p className="text-sm text-muted-foreground">
            Trainer: <span className="font-medium">{batchDetails.trainer.fullName}</span>
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Status: <span className="font-medium capitalize">{batchDetails?.status || 'Unknown'}</span>
        </p>
      </div>

      <Tabs defaultValue="trainees" className="w-full">
        <TabsList>
          <TabsTrigger value="trainees">Trainees</TabsTrigger>
          <TabsTrigger value="assessments" disabled={!isTrainingPhase}>
            Assessments & Certifications
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="trainees" className="pt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Date of Joining</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(trainees) && trainees.map((trainee: Trainee) => (
                  <TableRow key={trainee.id}>
                    <TableCell>{trainee.fullName}</TableCell>
                    <TableCell>{trainee.employeeId}</TableCell>
                    <TableCell>{trainee.email}</TableCell>
                    <TableCell>{trainee.phoneNumber}</TableCell>
                    <TableCell>{formatDate(trainee.dateOfJoining)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTrainee(trainee);
                            setIsTransferDialogOpen(true);
                          }}
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            toast({
                              title: "Coming Soon",
                              description: "Edit functionality will be available soon",
                            });
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTrainee(trainee);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        
        <TabsContent value="assessments" className="pt-4">
          {isTrainingPhase ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Assessments & Certifications</h3>
                <Button 
                  onClick={() => setIsCreateQuizOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus size={16} />
                  Create Assessment
                </Button>
              </div>
              
              {isLoadingAssessments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Loading assessments...</span>
                </div>
              ) : assessments.length > 0 ? (
                <div className="space-y-6">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Assessment</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Passing Score</TableHead>
                          <TableHead>Assigned Trainees</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assessments.map((assessment) => (
                          <TableRow key={assessment.id}>
                            <TableCell className="font-medium">{assessment.name}</TableCell>
                            <TableCell>{assessment.description || '-'}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                assessment.status === 'completed' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                                  : assessment.status === 'active'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                              }`}>
                                {assessment.status === 'assigned' ? 'Assigned' : 
                                 assessment.status === 'active' ? 'In Progress' : 'Completed'}
                              </span>
                            </TableCell>
                            <TableCell>{assessment.passingScore}%</TableCell>
                            <TableCell>{assessment.userId ? '1' : '0'}</TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // View assessment details
                                  // This would navigate to a detailed view
                                  toast({
                                    title: "Coming Soon",
                                    description: "Detailed assessment view will be available soon",
                                  });
                                }}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Passing Trainees */}
                    <div className="rounded-md border p-4">
                      <h3 className="text-lg font-medium mb-4">Passing Trainees</h3>
                      {getPassingTrainees().length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Trainee</TableHead>
                              <TableHead>Assessment</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead>Passed On</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {getPassingTrainees().map((result, index) => (
                              <TableRow key={index}>
                                <TableCell>{result.traineeName}</TableCell>
                                <TableCell>{result.quizName}</TableCell>
                                <TableCell>{result.score}%</TableCell>
                                <TableCell>{formatDate(result.passedAt)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          No trainees have passed assessments yet.
                        </div>
                      )}
                    </div>
                    
                    {/* Failing Trainees */}
                    <div className="rounded-md border p-4">
                      <h3 className="text-lg font-medium mb-4">Failed Assessments</h3>
                      {getFailingTrainees().length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Trainee</TableHead>
                              <TableHead>Assessment</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {getFailingTrainees().map((result, index) => (
                              <TableRow key={index}>
                                <TableCell>{result.traineeName}</TableCell>
                                <TableCell>{result.quizName}</TableCell>
                                <TableCell>{result.score}%</TableCell>
                                <TableCell>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => scheduleRefresherMutation.mutate(result.traineeId)}
                                    disabled={scheduleRefresherMutation.isPending}
                                  >
                                    {scheduleRefresherMutation.isPending && (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Schedule Refresher
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          No failed assessments to display.
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Pending Trainees */}
                  <div className="rounded-md border p-4">
                    <h3 className="text-lg font-medium mb-4">Pending Trainees</h3>
                    {getPendingTrainees().length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Employee ID</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getPendingTrainees().map((trainee) => (
                            <TableRow key={trainee.id}>
                              <TableCell>{trainee.fullName}</TableCell>
                              <TableCell>{trainee.employeeId}</TableCell>
                              <TableCell>{trainee.email}</TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTrainees([trainee.userId]);
                                    setIsCreateQuizOpen(true);
                                  }}
                                >
                                  Assign Assessment
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        All trainees have been assigned assessments.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border p-6 flex flex-col items-center justify-center min-h-[200px] text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-1">No Assessments Created Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create an assessment to evaluate trainee knowledge and skills
                  </p>
                  <Button 
                    onClick={() => setIsCreateQuizOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Create Assessment
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border p-6 flex flex-col items-center justify-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">Assessments Only Available in Training Phase</h3>
              <p className="text-muted-foreground">
                This batch is currently in {batchDetails?.status || 'unknown'} phase.
                Assessments are only available during the training phase.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will remove the trainee
              from this batch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedTrainee) {
                  // Pass the user_batch_process.id directly
                  deleteTraineeMutation.mutate(selectedTrainee.id);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Trainee to Another Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a batch to transfer {selectedTrainee?.fullName} to:
            </p>
            <div className="space-y-2">
              {allBatches
                .filter((batch: Batch) => batch.id !== batchId && batch.status === 'planned')
                .map((batch: Batch) => (
                  <Button
                    key={batch.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      if (selectedTrainee) {
                        // Pass the correct IDs for transfer
                        transferTraineeMutation.mutate({
                          traineeId: selectedTrainee.id,
                          newBatchId: batch.id,
                        });
                      }
                    }}
                    disabled={transferTraineeMutation.isPending}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{batch.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(batch.startDate)} - {formatDate(batch.endDate)}
                      </span>
                    </div>
                  </Button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quiz Creation Dialog */}
      <Dialog open={isCreateQuizOpen} onOpenChange={setIsCreateQuizOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Assessment</DialogTitle>
            <DialogDescription>
              Create a new assessment for trainees in this batch.
            </DialogDescription>
          </DialogHeader>
          <AssessmentCreationForm 
            batchId={batchId}
            organizationId={organizationId}
            trainees={trainees}
            onSuccess={() => {
              setIsCreateQuizOpen(false);
              // Invalidate queries to refresh assessments
              queryClient.invalidateQueries({
                queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/assessments`]
              });
              toast({
                title: "Success",
                description: "Assessment created successfully",
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Assessment Creation Form Component
interface AssessmentCreationFormProps {
  batchId: number;
  organizationId: number;
  trainees: Trainee[];
  onSuccess: () => void;
}

function AssessmentCreationForm({ batchId, organizationId, trainees, onSuccess }: AssessmentCreationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTraineeIds, setSelectedTraineeIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Fetch processes for dropdown
  const { data: processes = [] } = useQuery<any[]>({
    queryKey: ['/api/processes'],
    enabled: true,
  });
  
  // Fetch batch details to get process ID
  const { data: batchDetails } = useQuery<any>({
    queryKey: [`/api/organizations/${organizationId}/batches/${batchId}`],
    enabled: !!batchId && !!organizationId,
  });
  
  // Set up form with zod schema
  const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    processId: z.number().min(1, "Process is required"),
    timeLimit: z.number().min(5, "Time limit must be at least 5 minutes").max(180, "Time limit must be at most 180 minutes"),
    passingScore: z.number().min(0, "Passing score must be at least 0").max(100, "Passing score must be at most 100"),
    questionCount: z.number().min(1, "Must include at least 1 question"),
    shuffleQuestions: z.boolean().default(true),
    shuffleOptions: z.boolean().default(true),
  });

  type FormValues = z.infer<typeof formSchema>;
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      processId: batchDetails?.process?.id || 0,
      timeLimit: 30,
      passingScore: 70,
      questionCount: 10,
      shuffleQuestions: true,
      shuffleOptions: true,
    },
  });
  
  // If the batch process ID becomes available, update form
  useEffect(() => {
    if (batchDetails?.process?.id && form.getValues("processId") === 0) {
      form.setValue("processId", batchDetails.process.id);
    }
  }, [batchDetails, form]);
  
  // Toggle all trainees selection
  useEffect(() => {
    if (selectAll) {
      setSelectedTraineeIds(trainees.map(trainee => trainee.userId));
    } else if (selectedTraineeIds.length === trainees.length) {
      setSelectedTraineeIds([]);
    }
  }, [selectAll, trainees]);
  
  // Toggle individual trainee selection
  const toggleTrainee = (traineeId: number) => {
    if (selectedTraineeIds.includes(traineeId)) {
      setSelectedTraineeIds(prev => prev.filter(id => id !== traineeId));
      if (selectAll) setSelectAll(false);
    } else {
      setSelectedTraineeIds(prev => [...prev, traineeId]);
      if (selectedTraineeIds.length + 1 === trainees.length) {
        setSelectAll(true);
      }
    }
  };
  
  // Create quiz template mutation
  const createQuizTemplateMutation = useMutation({
    mutationFn: async (data: FormValues & { batchId: number, traineeIds: number[] }) => {
      const response = await fetch("/api/quiz-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          // Add batchId to restrict to this batch
          batchId: data.batchId,
          // Will be replaced with actual random questions by backend
          questions: []
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create quiz template");
      }

      // If successful, assign quiz to selected trainees
      const template = await response.json();
      
      // Only assign to specific trainees if not selecting all
      if (data.traineeIds.length > 0) {
        // Assign quiz to selected trainees
        // This would call a backend endpoint to assign the quiz to trainees
        const assignResponse = await fetch(`/api/quiz-templates/${template.id}/assign-trainees`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            traineeIds: data.traineeIds,
          }),
        });
        
        if (!assignResponse.ok) {
          const assignError = await assignResponse.json();
          throw new Error(assignError.message || "Failed to assign quiz to trainees");
        }
      }
      
      return template;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ['/api/quiz-templates']
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  const onSubmit = (values: FormValues) => {
    if (selectedTraineeIds.length === 0 && !selectAll) {
      toast({
        title: "Error",
        description: "Please select at least one trainee",
        variant: "destructive",
      });
      return;
    }
    
    // Submit with selected trainees
    createQuizTemplateMutation.mutate({
      ...values,
      batchId,
      traineeIds: selectAll ? [] : selectedTraineeIds, // Empty array means all trainees
    });
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assessment Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter assessment name" {...field} />
                </FormControl>
                <FormDescription>
                  A descriptive name for this assessment.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="processId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Process</FormLabel>
                <Select
                  onValueChange={value => field.onChange(parseInt(value))}
                  value={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a process" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {processes.map((process: any) => (
                      <SelectItem 
                        key={process.id} 
                        value={process.id.toString()}
                      >
                        {process.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  The process this assessment is for.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter a description of this assessment" 
                  {...field} 
                  value={field.value || ''}
                />
              </FormControl>
              <FormDescription>
                Optional: Provide details about this assessment.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="timeLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time Limit (minutes)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    onChange={e => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Time allowed for completion.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="passingScore"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Passing Score (%)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    onChange={e => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Minimum score to pass.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="questionCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number of Questions</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    onChange={e => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Total questions to include.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="shuffleQuestions"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Shuffle Questions</FormLabel>
                  <FormDescription>
                    Randomize question order for each trainee.
                  </FormDescription>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="shuffleOptions"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Shuffle Options</FormLabel>
                  <FormDescription>
                    Randomize option order for each question.
                  </FormDescription>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Select Trainees</h3>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="selectAll" 
                checked={selectAll}
                onCheckedChange={() => setSelectAll(!selectAll)}
              />
              <label 
                htmlFor="selectAll" 
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Select All
              </label>
            </div>
          </div>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Select</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainees.map((trainee) => (
                  <TableRow key={trainee.userId}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedTraineeIds.includes(trainee.userId) || selectAll}
                        onCheckedChange={() => toggleTrainee(trainee.userId)}
                      />
                    </TableCell>
                    <TableCell>{trainee.fullName}</TableCell>
                    <TableCell>{trainee.employeeId}</TableCell>
                    <TableCell>{trainee.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button variant="outline" type="button" onClick={() => setIsCreateQuizOpen(false)}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={createQuizTemplateMutation.isPending}
          >
            {createQuizTemplateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Assessment
          </Button>
        </div>
      </form>
    </Form>
  );
}