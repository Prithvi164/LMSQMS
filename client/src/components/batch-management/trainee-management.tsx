import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, ArrowRightLeft, Loader2, CheckCircle2 } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

const PHASES = [
  { id: 'induction', name: 'Induction', color: 'bg-blue-500' },
  { id: 'training', name: 'Training', color: 'bg-purple-500' },
  { id: 'certification', name: 'Certification', color: 'bg-orange-500' },
  { id: 'ojt', name: 'OJT', color: 'bg-green-500' },
  { id: 'ojt_certification', name: 'OJT Certification', color: 'bg-yellow-500' },
  { id: 'completed', name: 'Completed', color: 'bg-gray-500' }
] as const;

type Phase = typeof PHASES[number]['id'];

type Trainee = {
  id: number;
  userId: number;
  user: {
    id: number;
    username: string;
    fullName: string;
    email: string;
    employeeId: string;
    phoneNumber: string;
    dateOfJoining: string;
  };
};

export function TraineeManagement({ organizationId }: { organizationId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTrainees, setSelectedTrainees] = useState<Set<number>>(new Set());

  // Fetch all batches
  const { data: batches = [], isLoading: isLoadingBatches } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/batches`],
    enabled: !!organizationId,
  });

  // End phase mutation
  const endPhaseMutation = useMutation({
    mutationFn: async ({ batchId, phase }: { batchId: number; phase: Phase }) => {
      const response = await fetch(
        `/api/batches/${batchId}/phase/${phase}/end`,
        { method: "POST" }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to end phase");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/batches`]
      });
      toast({
        title: "Success",
        description: "Phase completed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not Started';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PP') : 'Invalid Date';
  };

  // Helper to determine if a phase is active
  const isPhaseActive = (phaseId: Phase, batchStatus: string): boolean => {
    return batchStatus === phaseId;
  };

  // Helper to determine if a phase is completed
  const isPhaseCompleted = (phaseId: Phase, batchStatus: string): boolean => {
    const phaseIndex = PHASES.findIndex(p => p.id === phaseId);
    const currentPhaseIndex = PHASES.findIndex(p => p.id === batchStatus);
    return phaseIndex < currentPhaseIndex;
  };

  if (isLoadingBatches) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading batches...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {batches.map((batch: any) => (
        <Card key={batch.id} className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">
                {batch.name}
                <Badge className="ml-2" variant="outline">
                  {batch.status}
                </Badge>
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {formatDate(batch.startDate)} - {formatDate(batch.endDate)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Phase Progress */}
            <div className="grid gap-4 mb-6">
              {PHASES.map((phase) => {
                const isActive = isPhaseActive(phase.id, batch.status);
                const isComplete = isPhaseCompleted(phase.id, batch.status);
                const dates = {
                  startDate: batch[`actual${phase.name.replace(' ', '')}StartDate`],
                  endDate: batch[`actual${phase.name.replace(' ', '')}EndDate`]
                };

                return (
                  <div
                    key={phase.id}
                    className={`
                      p-4 rounded-lg border
                      ${isActive ? 'border-primary bg-primary/5' : 'border-muted'}
                      ${isComplete ? 'bg-muted/20' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="font-medium">{phase.name}</h3>
                        <div className="text-sm text-muted-foreground">
                          {isComplete && (
                            <span className="flex items-center text-green-600">
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Completed
                            </span>
                          )}
                          {isActive && (
                            <span className="text-primary">In Progress</span>
                          )}
                          {!isActive && !isComplete && (
                            <span>Not Started</span>
                          )}
                        </div>
                      </div>

                      {isActive && (
                        <Button
                          onClick={() => endPhaseMutation.mutate({ batchId: batch.id, phase: phase.id })}
                          disabled={endPhaseMutation.isPending}
                        >
                          {endPhaseMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Ending...
                            </>
                          ) : (
                            'End Phase'
                          )}
                        </Button>
                      )}
                    </div>

                    <div className="mt-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">Start:</span>{' '}
                          {formatDate(dates.startDate)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">End:</span>{' '}
                          {formatDate(dates.endDate)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Trainees Table */}
            <TraineesTable
              batchId={batch.id}
              organizationId={organizationId}
              batchStatus={batch.status}
              selectedTrainees={selectedTrainees}
              setSelectedTrainees={setSelectedTrainees}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TraineesTable({
  batchId,
  organizationId,
  batchStatus,
  selectedTrainees,
  setSelectedTrainees
}: {
  batchId: number;
  organizationId: number;
  batchStatus: string;
  selectedTrainees: Set<number>;
  setSelectedTrainees: (trainees: Set<number>) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState<any>(null);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);

  // Fetch trainees for the batch
  const { data: trainees = [], isLoading: isLoadingTrainees, error } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`],
    enabled: !!batchId && !!organizationId,
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


  if (isLoadingTrainees) {
    return <div className="text-center py-4">Loading trainees...</div>;
  }
  if (error) {
    return <div className="text-center py-4 text-red-500">Error loading trainees.</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {batchStatus === 'induction' && (
              <TableHead className="w-[50px] text-center">Select</TableHead>
            )}
            <TableHead>Name</TableHead>
            <TableHead>Employee ID</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Date of Joining</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trainees.map((trainee: any) => (
            <TableRow key={trainee.id}>
              {batchStatus === 'induction' && (
                <TableCell className="text-center">
                  <input
                    type="checkbox"
                    checked={selectedTrainees.has(trainee.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedTrainees);
                      if (e.target.checked) {
                        newSelected.add(trainee.id);
                      } else {
                        newSelected.delete(trainee.id);
                      }
                      setSelectedTrainees(newSelected);
                    }}
                    className="h-4 w-4"
                  />
                </TableCell>
              )}
              <TableCell>{trainee.user.fullName}</TableCell>
              <TableCell>{trainee.user.employeeId}</TableCell>
              <TableCell>{trainee.user.email}</TableCell>
              <TableCell>{trainee.user.phoneNumber}</TableCell>
              <TableCell>{formatDate(trainee.user.dateOfJoining)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
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
                      setIsTransferDialogOpen(true);
                    }}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
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
              Select a batch to transfer {selectedTrainee?.user.fullName} to:
            </p>
            <div className="space-y-2">
              {batches
                .filter((batch: any) => batch.id !== batchId && batch.status === 'planned')
                .map((batch: any) => (
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
    </div>
  );
}