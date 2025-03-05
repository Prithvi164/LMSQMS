import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { BatchTrainee, User } from "@shared/schema";

interface BatchTraineesProps {
  batchId: number;
}

export function BatchTrainees({ batchId }: BatchTraineesProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddingTrainee, setIsAddingTrainee] = useState(false);

  // Fetch batch trainees
  const { data: trainees = [], isLoading: isLoadingTrainees } = useQuery<BatchTrainee[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`],
    enabled: !!user?.organizationId && !!batchId,
  });

  // Fetch available trainees
  const { data: availableTrainees = [], isLoading: isLoadingAvailable } = useQuery<User[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/available-trainees`],
    enabled: !!user?.organizationId && isAddingTrainee,
    select: (users) => users.filter(u => u.category === 'trainee' && !trainees.some(t => t.traineeId === u.id)),
  });

  // Mutation for adding trainee to batch
  const addTraineeMutation = useMutation({
    mutationFn: async (traineeId: number) => {
      const response = await fetch(
        `/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ traineeId }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add trainee');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`],
      });
      toast({ title: "Success", description: "Trainee added to batch" });
      setIsAddingTrainee(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add trainee",
        variant: "destructive",
      });
    },
  });

  // Mutation for removing trainee from batch
  const removeTraineeMutation = useMutation({
    mutationFn: async (traineeId: number) => {
      const response = await fetch(
        `/api/organizations/${user?.organizationId}/batches/${batchId}/trainees/${traineeId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to remove trainee');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`],
      });
      toast({ title: "Success", description: "Trainee removed from batch" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove trainee",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Batch Trainees</h3>
        <Dialog open={isAddingTrainee} onOpenChange={setIsAddingTrainee}>
          <DialogTrigger asChild>
            <Button>Add Trainee</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Trainee to Batch</DialogTitle>
              <DialogDescription>
                Select a trainee to add to this batch.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingAvailable ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center">
                        Loading available trainees...
                      </TableCell>
                    </TableRow>
                  ) : availableTrainees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center">
                        No available trainees found
                      </TableCell>
                    </TableRow>
                  ) : (
                    availableTrainees.map((trainee) => (
                      <TableRow key={trainee.id}>
                        <TableCell>{trainee.fullName}</TableCell>
                        <TableCell>{trainee.employeeId}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => addTraineeMutation.mutate(trainee.id)}
                            disabled={addTraineeMutation.isPending}
                          >
                            Add
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddingTrainee(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Employee ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined At</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoadingTrainees ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center">
                Loading trainees...
              </TableCell>
            </TableRow>
          ) : trainees.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center">
                No trainees in this batch
              </TableCell>
            </TableRow>
          ) : (
            trainees.map((trainee) => (
              <TableRow key={trainee.id}>
                <TableCell>{trainee.trainee.fullName}</TableCell>
                <TableCell>{trainee.trainee.employeeId}</TableCell>
                <TableCell className="capitalize">{trainee.status}</TableCell>
                <TableCell>
                  {new Date(trainee.joinedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeTraineeMutation.mutate(trainee.traineeId)}
                    disabled={removeTraineeMutation.isPending}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
