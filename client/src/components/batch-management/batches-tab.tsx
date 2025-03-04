import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Plus, Trash2, Edit, Eye, Calendar as CalendarIcon, List } from "lucide-react";
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
import { format } from "date-fns";
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  // Filter batches
  const filteredBatches = batches.filter(batch =>
    (searchQuery === '' ||
      batch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.status.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (selectedCategory === null || batch.batchCategory === selectedCategory)
  );

  // Get unique batch categories
  const batchCategories = [...new Set(batches.map(batch => batch.batchCategory))];

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

  const renderCalendarDay = (day: Date) => {
    const dayBatches = getBatchesForDate(day);
    const maxVisibleBatches = 4;
    const hasMoreBatches = dayBatches.length > maxVisibleBatches;
    const visibleBatches = hasMoreBatches ? dayBatches.slice(0, maxVisibleBatches) : dayBatches;
    const extraBatchesCount = dayBatches.length - maxVisibleBatches;

    return (
      <div className="w-full h-full min-h-[100px] p-2 relative">
        <div className="font-medium border-b border-gray-100 dark:border-gray-800 pb-1 mb-2">
          {format(day, 'd')}
        </div>
        {dayBatches.length > 0 && (
          <div className="absolute bottom-2 left-0 right-0 flex flex-wrap gap-1 justify-center">
            {visibleBatches.map((batch) => (
              <Popover key={batch.id}>
                <PopoverTrigger asChild>
                  <div
                    className={`
                      w-2 h-2 rounded-full cursor-pointer
                      transform transition-all duration-200 ease-in-out
                      hover:scale-150
                      ${batch.status === 'planned'
                        ? 'bg-blue-500 hover:bg-blue-600'
                        : batch.status === 'completed'
                        ? 'bg-gray-500 hover:bg-gray-600'
                        : 'bg-green-500 hover:bg-green-600'}
                    `}
                  />
                </PopoverTrigger>
                <PopoverContent
                  className="w-96 p-4 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                  align="start"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start border-b pb-2">
                      <div>
                        <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">
                          {batch.name}
                        </h4>
                        <Badge
                          variant="outline"
                          className="mt-2 transition-colors hover:bg-secondary"
                        >
                          {formatBatchCategory(batch.batchCategory)}
                        </Badge>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${getStatusColor(batch.status)} transition-all hover:scale-105`}
                      >
                        {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="col-span-2 space-y-2">
                        {[
                          { label: 'Process', value: batch.process?.name },
                          { label: 'Location', value: batch.location?.name },
                          { label: 'Trainer', value: batch.trainer?.fullName },
                          { label: 'Capacity', value: batch.capacityLimit },
                          {
                            label: 'Timeline',
                            value: `${format(new Date(batch.startDate), 'MMM d, yyyy')} - ${format(new Date(batch.endDate), 'MMM d, yyyy')}`
                          }
                        ].map(({ label, value }) => (
                          <div
                            key={label}
                            className="flex justify-between items-center p-1 rounded hover:bg-secondary/10 transition-colors"
                          >
                            <span className="text-muted-foreground">{label}:</span>
                            <span className="font-medium">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {canManageBatches && batch.status === 'planned' && (
                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(batch)}
                          className="transition-all hover:scale-105 hover:bg-secondary/20"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(batch)}
                          className="transition-all hover:scale-105 hover:bg-destructive/20"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            ))}
            {hasMoreBatches && (
              <Popover>
                <PopoverTrigger asChild>
                  <div className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors">
                    +{extraBatchesCount} more
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  <div className="space-y-1">
                    {dayBatches.slice(maxVisibleBatches).map((batch) => (
                      <div
                        key={batch.id}
                        className="flex items-center justify-between p-2 rounded hover:bg-secondary/10 transition-colors"
                      >
                        <span className="text-sm font-medium">{batch.name}</span>
                        <Badge
                          variant="secondary"
                          className={getStatusColor(batch.status)}
                        >
                          {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderBatchTable = (batchList: OrganizationBatch[]) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[150px] text-center">Start Date</TableHead>
            <TableHead className="text-center">Batch Name</TableHead>
            <TableHead className="text-center">Location</TableHead>
            <TableHead className="text-center">Line of Business</TableHead>
            <TableHead className="text-center">Process</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredBatches.map((batch) => (
            <TableRow
              key={batch.id}
              className="hover:bg-muted/50 transition-colors group"
            >
              <TableCell className="font-medium text-center whitespace-nowrap">
                {format(new Date(batch.startDate), 'MMM d, yyyy')}
              </TableCell>
              <TableCell className="text-center">
                <div className="font-semibold group-hover:text-primary transition-colors">
                  {batch.name}
                </div>
              </TableCell>
              <TableCell className="text-center">{batch.location?.name}</TableCell>
              <TableCell className="text-center">{batch.lineOfBusiness?.name}</TableCell>
              <TableCell className="text-center">{batch.process?.name}</TableCell>
              <TableCell className="text-center">
                <Badge
                  variant="secondary"
                  className={`${getStatusColor(batch.status)} px-2 py-1 inline-flex justify-center`}
                >
                  {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {canManageBatches && batch.status === 'planned' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(batch)}
                        className="h-8 w-8 p-0 hover:text-primary"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(batch)}
                        className="h-8 w-8 p-0 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const getBatchesForDate = (date: Date) => {
    return filteredBatches.filter(batch => {
      const startDate = new Date(batch.startDate);
      const endDate = new Date(batch.endDate);
      return date >= startDate && date <= endDate;
    });
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
      <div className="flex flex-col gap-4">
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

        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? "secondary" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="transition-colors"
          >
            All Categories
          </Button>
          {batchCategories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "secondary" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="transition-colors"
            >
              {formatBatchCategory(category)}
            </Button>
          ))}
        </div>
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
            {renderBatchTable(filteredBatches)}
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <div className="rounded-md border p-6">
              <Calendar
                mode="single"
                disabled={false}
                components={{
                  Day: ({ date }) => renderCalendarDay(date)
                }}
                className="w-full"
                classNames={{
                  cell: "h-24 w-24 p-0 border-2 border-gray-100 dark:border-gray-800",
                  head_cell: "text-muted-foreground font-normal border-b-2 border-gray-100 dark:border-gray-800 p-2",
                  table: "border-collapse border-spacing-0 border-2 border-gray-100 dark:border-gray-800",
                  day: "h-full rounded-none hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:bg-gray-50 dark:focus-visible:bg-gray-800",
                  nav_button: "h-12 w-12 bg-primary/10 hover:bg-primary/20 p-0 opacity-90 hover:opacity-100 absolute top-[50%] -translate-y-1/2 flex items-center justify-center rounded-full transition-all shadow-sm hover:shadow-md border border-primary/20",
                  nav_button_previous: "left-4",
                  nav_button_next: "right-4",
                  nav: "relative flex items-center justify-between pt-4 pb-10 px-2 border-b-2 border-gray-100 dark:border-gray-800 mb-4",
                  caption: "text-2xl font-semibold text-center flex-1 px-10",
                  caption_label: "text-lg font-medium"
                }}
              />
              <div className="mt-6 flex items-center gap-6 text-sm border-t pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="font-medium">Planned</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="font-medium">Ongoing</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500" />
                  <span className="font-medium">Completed</span>
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