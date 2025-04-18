import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Info, AlertCircle, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';

// Define the schema for update form
const formSchema = z.object({
  status: z.enum(['certify', 'refresher', 'refer_to_hr', 'in_progress']),
  notes: z.string().optional(),
});

// Define batch phase status interface
interface TraineePhaseStatus {
  id: number;
  traineeId: number;
  batchId: number;
  phase: string;
  status: 'certify' | 'refresher' | 'refer_to_hr' | 'in_progress';
  notes?: string;
  evaluatorId?: number;
  lastEvaluationDate?: string;
  createdAt: string;
  updatedAt: string;
  traineeName?: string;
}

interface TraineePhaseStatusProps {
  batchId: number;
  traineeId?: number;
  currentPhase: string;
  canEdit?: boolean;
}

const formatPhase = (phase: string) => {
  return phase
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Status badge components with appropriate styling
const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'certify':
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          <CheckCircle className="w-3 h-3 mr-1" /> Certified
        </Badge>
      );
    case 'refresher':
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600">
          <RefreshCw className="w-3 h-3 mr-1" /> Refresher
        </Badge>
      );
    case 'refer_to_hr':
      return (
        <Badge className="bg-red-500 hover:bg-red-600">
          <AlertCircle className="w-3 h-3 mr-1" /> Refer to HR
        </Badge>
      );
    case 'in_progress':
      return (
        <Badge className="bg-blue-500 hover:bg-blue-600">
          <Info className="w-3 h-3 mr-1" /> In Progress
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
};

export const TraineePhaseStatus: React.FC<TraineePhaseStatusProps> = ({
  batchId,
  traineeId,
  currentPhase,
  canEdit = false,
}) => {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState<TraineePhaseStatus | null>(null);
  
  // Check if user has edit permission and is allowed to edit based on props
  const canUpdateStatuses = hasPermission('manage_trainee_management') && canEdit;

  // Create form with zod validation
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: 'in_progress',
      notes: '',
    },
  });

  // Query to fetch trainee statuses for current batch and phase
  const { data: statusData, isLoading, isError } = useQuery({
    queryKey: ['/api/batch', batchId, 'trainee-phase-status', currentPhase],
    queryFn: () => apiRequest(`/api/batch/${batchId}/trainee-phase-status?phase=${currentPhase}`),
    enabled: !!batchId && !!currentPhase,
  });

  // Query to fetch specific trainee's status history if traineeId is provided
  const { data: traineeHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['/api/trainee', traineeId, 'batch', batchId, 'phase-status'],
    queryFn: () => apiRequest(`/api/trainee/${traineeId}/batch/${batchId}/phase-status`),
    enabled: !!traineeId && !!batchId,
  });

  // Mutation to update trainee phase status
  const updateStatusMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      if (!selectedTrainee) return Promise.reject('No trainee selected');
      
      return apiRequest(
        `/api/trainee/${selectedTrainee.traineeId}/batch/${batchId}/phase/${currentPhase}/status`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      );
    },
    onSuccess: () => {
      toast({
        title: 'Status updated',
        description: 'Trainee phase status has been successfully updated.',
      });
      // Close the dialog and invalidate queries to refresh data
      setIsUpdateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/batch', batchId, 'trainee-phase-status'] });
      if (traineeId) {
        queryClient.invalidateQueries({ queryKey: ['/api/trainee', traineeId, 'batch', batchId, 'phase-status'] });
      }
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: `Failed to update trainee status: ${error}`,
        variant: 'destructive',
      });
    },
  });

  // Handle opening the update dialog for a trainee
  const handleOpenUpdateDialog = (trainee: TraineePhaseStatus) => {
    setSelectedTrainee(trainee);
    form.reset({
      status: trainee.status,
      notes: trainee.notes || '',
    });
    setIsUpdateDialogOpen(true);
  };

  // Handle submit for updating trainee status
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    updateStatusMutation.mutate(data);
  };

  // Render loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-48" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-64" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (isError) {
    return (
      <Card className="border-red-300">
        <CardHeader>
          <CardTitle className="text-red-500">Error Loading Trainee Status</CardTitle>
          <CardDescription>
            There was a problem fetching the trainee status data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 text-red-500">
            <AlertCircle />
            <p>Please try refreshing the page or contact support if the issue persists.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter statuses to show only requested trainee if traineeId is provided
  const filteredStatuses = traineeId
    ? statusData?.filter((status: TraineePhaseStatus) => status.traineeId === traineeId) || []
    : statusData || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {traineeId ? 'Trainee Status' : 'Trainees Status'} - {formatPhase(currentPhase)} Phase
        </CardTitle>
        <CardDescription>
          Manage and track trainee progress status for the current phase
        </CardDescription>
      </CardHeader>
      <CardContent>
        {filteredStatuses.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <AlertTriangle className="mx-auto h-10 w-10 mb-2" />
            <p>No status records found for this phase.</p>
            {canUpdateStatuses && (
              <p className="mt-2">
                Status will be automatically set to "In Progress" when a trainee enters this phase.
              </p>
            )}
          </div>
        ) : (
          <Table>
            <TableCaption>Trainee phase statuses as of {new Date().toLocaleDateString()}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Trainee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                {canUpdateStatuses && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStatuses.map((status: TraineePhaseStatus) => (
                <TableRow key={status.id}>
                  <TableCell className="font-medium">{status.traineeName}</TableCell>
                  <TableCell>
                    <StatusBadge status={status.status} />
                  </TableCell>
                  <TableCell>
                    {new Date(status.updatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  {canUpdateStatuses && (
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleOpenUpdateDialog(status)}
                      >
                        Update Status
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Trainee History Section (only shown when viewing individual trainee) */}
        {traineeId && traineeHistory && traineeHistory.length > 0 && (
          <>
            <Separator className="my-6" />
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Status History</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phase</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated At</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {traineeHistory.map((history: TraineePhaseStatus) => (
                    <TableRow key={history.id}>
                      <TableCell>{formatPhase(history.phase)}</TableCell>
                      <TableCell>
                        <StatusBadge status={history.status} />
                      </TableCell>
                      <TableCell>
                        {new Date(history.updatedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {history.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>

      {/* Dialog for updating trainee status */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Trainee Status</DialogTitle>
            <DialogDescription>
              Update status for trainee: {selectedTrainee?.traineeName} in {formatPhase(currentPhase)} phase
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select trainee status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="certify">Certify</SelectItem>
                        <SelectItem value="refresher">Refresher</SelectItem>
                        <SelectItem value="refer_to_hr">Refer to HR</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Current phase status of the trainee
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any relevant notes or comments" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Optional: Add context or reason for the status change
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsUpdateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  isLoading={updateStatusMutation.isPending}
                >
                  Update Status
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TraineePhaseStatus;