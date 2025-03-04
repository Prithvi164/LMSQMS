import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Plus, Trash2, Edit, Calendar as CalendarIcon, List } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { CreateBatchForm } from "./create-batch-form";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, isSameDay } from "date-fns";
import type { OrganizationBatch } from "@shared/schema";

export function BatchesTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<OrganizationBatch | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Check if user has permission to edit/delete batches
  const canManageBatches = user?.role === 'admin' || user?.role === 'owner';

  const {
    data: batches = [],
    isLoading,
    error
  } = useQuery<OrganizationBatch[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId
  });

  // Filter and group batches
  const filteredBatches = batches.filter(batch => 
    batch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    batch.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedBatches = {
    planned: filteredBatches.filter(b => b.status === 'planned'),
    ongoing: filteredBatches.filter(b => ['induction', 'training', 'certification', 'ojt', 'ojt_certification'].includes(b.status)),
    completed: filteredBatches.filter(b => b.status === 'completed')
  };

  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      const response = await fetch(`/api/organizations/${user?.organizationId}/batches/${batchId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete batch');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/batches`] });
      toast({
        title: "Success",
        description: "Batch deleted successfully",
      });
      setDeleteDialogOpen(false);
      setDeleteConfirmation('');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete batch",
        variant: "destructive",
      });
    }
  });

  const handleDeleteClick = (batch: OrganizationBatch) => {
    if (batch.status !== 'planned') {
      toast({
        title: "Cannot Delete",
        description: "Only batches with 'Planned' status can be deleted",
        variant: "destructive",
      });
      return;
    }
    setSelectedBatch(batch);
    setSelectedBatchId(batch.id);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (batch: OrganizationBatch) => {
    if (batch.status !== 'planned') {
      toast({
        title: "Cannot Edit",
        description: "Only batches with 'Planned' status can be edited",
        variant: "destructive",
      });
      return;
    }
    setSelectedBatch(batch);
    setIsEditDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedBatch || !selectedBatchId) return;

    if (deleteConfirmation !== selectedBatch.name) {
      toast({
        title: "Error",
        description: "Batch name confirmation does not match",
        variant: "destructive",
      });
      return;
    }

    await deleteBatchMutation.mutateAsync(selectedBatchId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ongoing':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'planned':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'completed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatBatchCategory = (category: string) => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Function to get batches for a specific date
  const getBatchesForDate = (date: Date) => {
    return filteredBatches.filter(batch => {
      const startDate = new Date(batch.startDate);
      const endDate = new Date(batch.endDate);
      return date >= startDate && date <= endDate;
    });
  };

  // Custom calendar day render function
  const renderCalendarDay = (day: Date) => {
    const dayBatches = getBatchesForDate(day);
    return (
      <div className="w-full h-full">
        <div className="text-center">{format(day, 'd')}</div>
        {dayBatches.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {dayBatches.map((batch) => (
              <Popover key={batch.id}>
                <PopoverTrigger asChild>
                  <div
                    className={`w-2 h-2 rounded-full cursor-pointer ${
                      batch.status === 'planned' ? 'bg-blue-500' :
                      batch.status === 'completed' ? 'bg-gray-500' : 'bg-green-500'
                    }`}
                  />
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{batch.name}</h4>
                        <Badge variant="outline" className="mt-1">
                          {formatBatchCategory(batch.batchCategory)}
                        </Badge>
                      </div>
                      <Badge variant="secondary" className={getStatusColor(batch.status)}>
                        {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Process:</div>
                      <div>{batch.process?.name}</div>
                      <div className="text-muted-foreground">Location:</div>
                      <div>{batch.location?.name}</div>
                      <div className="text-muted-foreground">Trainer:</div>
                      <div>{batch.trainer?.fullName}</div>
                      <div className="text-muted-foreground">Capacity:</div>
                      <div>{batch.capacityLimit}</div>
                      <div className="text-muted-foreground">Timeline:</div>
                      <div>
                        {format(new Date(batch.startDate), 'MMM d, yyyy')} - 
                        {format(new Date(batch.endDate), 'MMM d, yyyy')}
                      </div>
                    </div>
                    {canManageBatches && batch.status === 'planned' && (
                      <div className="flex justify-end gap-2 mt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditClick(batch)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteClick(batch)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderBatchTable = (batchList: OrganizationBatch[]) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
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
          {batchList.map((batch) => (
            <TableRow key={batch.id}>
              <TableCell>{batch.name}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {formatBatchCategory(batch.batchCategory)}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={getStatusColor(batch.status)}>
                  {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
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
                <Button variant="outline" size="sm">
                  View Details
                </Button>
                {canManageBatches && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteClick(batch)}
                      disabled={batch.status !== 'planned'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditClick(batch)}
                      disabled={batch.status !== 'planned'}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

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
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search batches..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {canManageBatches && (
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Batch
          </Button>
        )}
      </div>

      {batches.length > 0 ? (
        <Tabs defaultValue="table" className="w-full">
          <TabsList>
            <TabsTrigger value="table" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Table View
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Calendar View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="table" className="space-y-6">
            {Object.entries(groupedBatches).map(([status, batchList]) => (
              batchList.length > 0 && (
                <div key={status} className="space-y-4">
                  <h3 className="text-lg font-semibold capitalize">{status} Batches</h3>
                  {renderBatchTable(batchList)}
                </div>
              )
            ))}
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <div className="rounded-md border p-4">
              <Calendar
                mode="single"
                disabled={false}
                components={{
                  Day: ({ date }) => renderCalendarDay(date)
                }}
                className="w-full"
              />
              <div className="mt-4 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>Planned</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Ongoing</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500" />
                  <span>Completed</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed p-8 text-center animate-in fade-in-50">
          <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
            <h3 className="mt-4 text-lg font-semibold">No batches found</h3>
            <p className="mb-4 mt-2 text-sm text-muted-foreground">
              You haven't created any batches yet. Start by creating a new batch.
            </p>
            {canManageBatches && (
              <Button 
                size="sm" 
                className="relative"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Batch
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
          </DialogHeader>
          <CreateBatchForm />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
            <DialogDescription>
              Make changes to the batch details.
            </DialogDescription>
          </DialogHeader>
          {selectedBatch && (
            <CreateBatchForm 
              editMode={true} 
              batchData={selectedBatch} 
              onSuccess={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Please type "{selectedBatch?.name}" to confirm deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              placeholder="Type batch name to confirm"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteConfirmation('');
              setDeleteDialogOpen(false);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteConfirmation !== selectedBatch?.name || deleteBatchMutation.isPending}
            >
              {deleteBatchMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}