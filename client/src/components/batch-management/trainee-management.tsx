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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, ArrowRightLeft, Loader2, UserX } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";

// Updated type to match actual API response
type Trainee = {
  id: number;
  userId: number;
  employeeId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  dateOfJoining: string;
  status?: string;
};

type DeactivationRequest = {
  id: number;
  userId: number;
  batchId: number;
  requesterId: number;
  managerId: number;
  organizationId: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string;
  approverComments?: string | null;
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
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [deactivationReason, setDeactivationReason] = useState("");

  // Fetch trainees for the current batch
  const { data: trainees = [], isLoading, error } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`],
    enabled: !!batchId && !!organizationId,
  });

  // Fetch all other batches for transfer
  const { data: allBatches = [] } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/batches`],
    enabled: !!organizationId,
  });

  // Fetch existing deactivation requests
  const { data: deactivationRequests = [] } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/trainee-deactivation-requests`],
    enabled: !!organizationId,
  });

  // Helper function to safely format dates
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PP') : 'N/A';
  };

  console.log('Debug - Trainees:', { 
    trainees, 
    isLoading, 
    error,
    sampleTrainee: trainees[0],
    traineeCount: trainees.length 
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
  
  // Deactivation request mutation
  const deactivateTraineeMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: number; reason: string }) => {
      const response = await fetch(
        `/api/organizations/${organizationId}/trainee-deactivation-requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            batchId,
            reason,
            organizationId
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit deactivation request");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate deactivation requests
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/trainee-deactivation-requests`]
      });

      // Close dialogs and reset state
      setIsDeactivateDialogOpen(false);
      setSelectedTrainee(null);
      setDeactivationReason("");

      toast({
        title: "Success",
        description: "Deactivation request submitted successfully",
      });
    },
    onError: (error: Error) => {
      console.error('Deactivation request error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

  if (!trainees || trainees.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No trainees found in this batch.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Batch Trainees</h2>

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
                        setIsDeactivateDialogOpen(true);
                      }}
                    >
                      <UserX className="h-4 w-4" />
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

      {/* Deactivation Dialog */}
      <Dialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Trainee Deactivation</DialogTitle>
            <DialogDescription>
              This will submit a request to deactivate {selectedTrainee?.fullName} from the system.
              Deactivation requires manager approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deactivation-reason">Reason for deactivation</Label>
              <Textarea
                id="deactivation-reason"
                value={deactivationReason}
                onChange={(e) => setDeactivationReason(e.target.value)}
                placeholder="Please provide a detailed reason for this deactivation request"
                className="min-h-[100px]"
              />
            </div>

            {/* Check if there's a pending request for this trainee */}
            {selectedTrainee && deactivationRequests.some((req: DeactivationRequest) => 
              req.userId === selectedTrainee.userId && req.status === 'pending'
            ) && (
              <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-700">
                <p className="font-medium">Note: There is already a pending deactivation request for this trainee.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeactivateDialogOpen(false);
                setDeactivationReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedTrainee && deactivationReason.trim()) {
                  deactivateTraineeMutation.mutate({
                    userId: selectedTrainee.userId,
                    reason: deactivationReason
                  });
                } else {
                  toast({
                    title: "Error",
                    description: "Please provide a reason for deactivation",
                    variant: "destructive",
                  });
                }
              }}
              disabled={deactivateTraineeMutation.isPending || !deactivationReason.trim()}
            >
              {deactivateTraineeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}