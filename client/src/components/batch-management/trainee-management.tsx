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
import { Edit, Trash2, ArrowRightLeft } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";

type Trainee = {
  id: number;
  username: string;
  fullName: string;
  email: string;
  employeeId: string;
  phoneNumber: string;
  dateOfJoining: string;
  dateOfBirth: string;
  education: string;
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

  // Fetch trainees for the current batch
  const { data: trainees = [], isLoading } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`],
    enabled: !!batchId && !!organizationId,
  });

  // Fetch all other batches for transfer
  const { data: allBatches = [] } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/batches`],
    enabled: !!organizationId,
  });

  // Helper function to safely format dates
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PP') : 'N/A';
  };

  // Delete trainee mutation
  const deleteTraineeMutation = useMutation({
    mutationFn: async (traineeId: number) => {
      const response = await fetch(
        `/api/organizations/${organizationId}/batches/${batchId}/trainees/${traineeId}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete trainee");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`]
      });
      toast({
        title: "Success",
        description: "Trainee deleted successfully",
      });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`]
      });
      toast({
        title: "Success",
        description: "Trainee transferred successfully",
      });
      setIsTransferDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div>Loading trainees...</div>;
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
            {trainees.map((trainee: Trainee) => (
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
                        // TODO: Implement edit functionality
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the trainee
              from the batch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedTrainee) {
                  deleteTraineeMutation.mutate(selectedTrainee.id);
                }
              }}
            >
              Delete
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
                .filter((batch: any) => batch.id !== batchId)
                .map((batch: any) => (
                  <Button
                    key={batch.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      if (selectedTrainee) {
                        transferTraineeMutation.mutate({
                          traineeId: selectedTrainee.id,
                          newBatchId: batch.id,
                        });
                      }
                    }}
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