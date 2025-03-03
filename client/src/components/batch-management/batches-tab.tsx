import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateBatchForm } from "./create-batch-form";
import { RescheduleBatchForm } from "./reschedule-batch-form";

export function BatchesTab() {
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);

  const {
    data: batches = [],
    isLoading,
    error
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'induction':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'training':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'certification':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'ojt':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300';
      case 'ojt_certification':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300';
      case 'closed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'manual_cancel':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'manual_reschedule':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-destructive">
        Error loading batches. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Manage Batch</h2>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search batches..."
            className="pl-8"
          />
        </div>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Batch
        </Button>
      </div>

      {batches.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Process</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Trainer</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium">{batch.batchCode}</TableCell>
                  <TableCell>{batch.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getStatusColor(batch.status)}>
                      {formatStatus(batch.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{batch.process?.name}</TableCell>
                  <TableCell>{batch.location?.name}</TableCell>
                  <TableCell>{batch.trainer?.fullName}</TableCell>
                  <TableCell>{batch.capacityLimit}</TableCell>
                  <TableCell>
                    {new Date(batch.startDate).toLocaleDateString()} - 
                    {new Date(batch.endDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedBatch(batch);
                        setIsRescheduleDialogOpen(true);
                      }}
                    >
                      Reschedule
                    </Button>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed p-8 text-center animate-in fade-in-50">
          <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
            <h3 className="mt-4 text-lg font-semibold">No batches found</h3>
            <p className="mb-4 mt-2 text-sm text-muted-foreground">
              You haven't created any batches yet. Start by creating a new batch.
            </p>
            <Button 
              size="sm" 
              className="relative"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Batch
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
            <DialogDescription>
              Create a new training batch by filling out the form below.
            </DialogDescription>
          </DialogHeader>
          <CreateBatchForm onSuccess={() => setIsCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {selectedBatch && (
        <Dialog open={isRescheduleDialogOpen} onOpenChange={setIsRescheduleDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Reschedule Batch</DialogTitle>
              <DialogDescription>
                Reschedule the selected batch by updating the dates below.
              </DialogDescription>
            </DialogHeader>
            <RescheduleBatchForm
              batch={selectedBatch}
              onSuccess={() => {
                setIsRescheduleDialogOpen(false);
                setSelectedBatch(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}