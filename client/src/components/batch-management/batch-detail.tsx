import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SiReact } from "react-icons/si";
import {
  Dialog,
  DialogContent,
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

interface Batch {
  id: number;
  name: string;
  status: 'planned' | 'ongoing' | 'completed';
  lineOfBusiness: string;
  processName: string;
  location: string;
  trainer: string;
  manager: string;
  batchNumber: string;
  participants: number;
  capacityLimit: number;
}

export function BatchDetail() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const {
    data: batches = [] as Batch[],
    isLoading,
    error
  } = useQuery<Batch[]>({
    queryKey: ['/api/batches'],
  });

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
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center space-x-2 mb-6">
        <SiReact className="h-8 w-8 text-blue-500" />
        <h1 className="text-2xl font-semibold">Manage Batch</h1>
      </div>

      {/* Search and Actions Section */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search batches..."
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Filter</Button>
              <Button 
                className="gap-2"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add New Batch
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Batch Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Batch</DialogTitle>
          </DialogHeader>
          <CreateBatchForm onClose={() => setIsCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Batch List Section */}
      <Card>
        <CardContent className="pt-6">
          {batches.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Batch Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Line of Business</TableHead>
                    <TableHead>Process</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Batch Number</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getStatusColor(batch.status)}>
                          {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{batch.lineOfBusiness}</TableCell>
                      <TableCell>{batch.processName}</TableCell>
                      <TableCell>{batch.location}</TableCell>
                      <TableCell>{batch.trainer}</TableCell>
                      <TableCell>{batch.manager}</TableCell>
                      <TableCell>{batch.batchNumber}</TableCell>
                      <TableCell>
                        {batch.participants}/{batch.capacityLimit}
                      </TableCell>
                      <TableCell className="text-right">
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
                  Add New Batch
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}