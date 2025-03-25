import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, AlertCircle, Clock, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { BatchTimeline } from "./batch-timeline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Textarea
} from "@/components/ui/textarea";

const statusColors = {
  present: 'text-green-500',
  absent: 'text-red-500',
  late: 'text-yellow-500',
  leave: 'text-blue-500'
} as const;

type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

type Trainee = {
  id: number;
  status: string;
  user: {
    id: number;
    fullName: string;
    employeeId: string;
    email: string;
    role: string;
    category: string;
  };
  lastUpdated?: string;
};

const getStatusIcon = (status: AttendanceStatus | null) => {
  switch (status) {
    case 'present':
      return <CheckCircle className={`h-4 w-4 ${statusColors.present}`} />;
    case 'absent':
      return <AlertCircle className={`h-4 w-4 ${statusColors.absent}`} />;
    case 'late':
      return <Clock className={`h-4 w-4 ${statusColors.late}`} />;
    case 'leave':
      return <Clock className={`h-4 w-4 ${statusColors.leave}`} />;
    default:
      return null;
  }
};

const LoadingSkeleton = () => (
  <div className="space-y-4 p-8">
    <div className="space-y-2">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/4" />
    </div>
    <Skeleton className="h-[200px] w-full" />
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  </div>
);

const phaseChangeFormSchema = z.object({
  requestedPhase: z.enum(['induction', 'training', 'certification', 'ojt', 'ojt_certification']),
  justification: z.string().min(1, "Justification is required"),
  managerId: z.string().min(1, "Manager is required"),
});

export function BatchDetailsPage() {
  const { batchId } = useParams();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("attendance");
  const currentDate = format(new Date(), "PPP");

  // Initialize form
  const form = useForm({
    resolver: zodResolver(phaseChangeFormSchema),
    defaultValues: {
      requestedPhase: undefined,
      justification: "",
      managerId: "",
    },
  });

  // Query hooks with improved error handling
  const { data: batch, isLoading: batchLoading, error: batchError } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}`],
    enabled: !!user?.organizationId && !!batchId,
  });

  const { data: trainees = [], isLoading: traineesLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`],
    enabled: !!user?.organizationId && !!batchId && !!batch,
  });

  const { data: managers } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/users`],
    enabled: !!user?.organizationId,
    select: (users: any[]) => users.filter(u => u.role === 'manager'),
  });

  const { data: trainerRequests } = useQuery({
    queryKey: [`/api/trainers/${user?.id}/phase-change-requests`],
    enabled: !!user?.id && user?.role === 'trainer',
  });

  const { data: managerRequests } = useQuery({
    queryKey: [`/api/managers/${user?.id}/phase-change-requests`],
    enabled: !!user?.id && user?.role === 'manager',
  });

  const phaseRequests = user?.role === 'trainer' ? trainerRequests :
                       user?.role === 'manager' ? managerRequests : [];

  const updateAttendanceMutation = useMutation({
    mutationFn: async ({ traineeId, status }: { traineeId: number; status: AttendanceStatus }) => {
      const response = await fetch(`/api/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          traineeId,
          status,
          date: new Date().toISOString().split('T')[0],
          organizationId: user?.organizationId,
          batchId: parseInt(batchId!),
          phase: batch?.status,
          markedById: user?.id
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update attendance');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`]
      });
      toast({
        title: "Success",
        description: "Attendance marked successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Creating phase change request:', data);
      const response = await fetch(`/api/batches/${batchId}/phase-change-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          managerId: parseInt(data.managerId),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create request');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [
          `/api/trainers/${user?.id}/phase-change-requests`,
          `/api/managers/${user?.id}/phase-change-requests`
        ] 
      });
      toast({
        title: "Success",
        description: "Phase change request submitted successfully",
      });
      form.reset();
      const closeButton = document.querySelector('[data-dialog-close]');
      if (closeButton instanceof HTMLElement) {
        closeButton.click();
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to submit request",
      });
    },
  });

  const onSubmit = (data: any) => {
    console.log('Submitting form data:', data);
    createRequestMutation.mutate(data);
  };

  const handleApprove = async (requestId: number) => {
    try {
      await fetch(`/api/phase-change-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'approved',
        }),
      });
      queryClient.invalidateQueries({ 
        queryKey: [
          `/api/trainers/${user?.id}/phase-change-requests`,
          `/api/managers/${user?.id}/phase-change-requests`
        ]
      });
      toast({
        title: "Success",
        description: "Request approved successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve request",
      });
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      await fetch(`/api/phase-change-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'rejected',
        }),
      });
      queryClient.invalidateQueries({ 
        queryKey: [
          `/api/trainers/${user?.id}/phase-change-requests`,
          `/api/managers/${user?.id}/phase-change-requests`
        ]
      });
      toast({
        title: "Success",
        description: "Request rejected successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reject request",
      });
    }
  };

  if (batchLoading || traineesLoading) {
    return <LoadingSkeleton />;
  }

  if (batchError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load batch details. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!batch) {
    return (
      <Alert>
        <AlertDescription>
          Batch not found. Please make sure you have access to this batch.
        </AlertDescription>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-4"
          onClick={() => setLocation('/batches')}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Batches
        </Button>
      </Alert>
    );
  }

  const canAccessPhaseRequests = user?.role === 'trainer' || user?.role === 'manager';

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{batch.name}</h1>
          <p className="text-muted-foreground">
            {batch.location?.name} • {batch.process?.name}
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">
          {batch.status}
        </Badge>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <h3 className="font-medium">Batch Capacity</h3>
            <div className="grid gap-2">
              <div className="flex justify-between font-medium">
                <span>Total Capacity:</span>
                <span>{batch.capacityLimit}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Current Trainees:</span>
                <span>{batch.userCount}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Remaining Slots:</span>
                <span>{batch.capacityLimit - batch.userCount}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="training-plan">Training Planner</TabsTrigger>
          {canAccessPhaseRequests && (
            <TabsTrigger value="phase-requests">Phase Requests</TabsTrigger>
          )}
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Attendance Tracking</h2>
                <p className="text-muted-foreground">{currentDate}</p>
              </div>

              {trainees && trainees.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainee Name</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainees.map((trainee: Trainee) => (
                      <TableRow key={trainee.id}>
                        <TableCell>{trainee.user.fullName}</TableCell>
                        <TableCell>{trainee.user.employeeId}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(trainee.status as AttendanceStatus)}
                            <span className={`capitalize ${statusColors[trainee.status as AttendanceStatus] || ''}`}>
                              {trainee.status || 'Not marked'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {trainee.lastUpdated ? format(new Date(trainee.lastUpdated), "hh:mm a") : '-'}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={trainee.status || ''}
                            onValueChange={(value: AttendanceStatus) =>
                              updateAttendanceMutation.mutate({ traineeId: trainee.id, status: value })
                            }
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue placeholder="Mark attendance" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present" className={statusColors.present}>Present</SelectItem>
                              <SelectItem value="absent" className={statusColors.absent}>Absent</SelectItem>
                              <SelectItem value="late" className={statusColors.late}>Late</SelectItem>
                              <SelectItem value="leave" className={statusColors.leave}>Leave</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <AlertDescription>
                    No trainees found in this batch.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training-plan" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Training Schedule</h2>
              <Alert>
                <AlertDescription>
                  Training planner interface will be implemented here.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {canAccessPhaseRequests && (
          <TabsContent value="phase-requests" className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Phase Change Requests</h2>
                  {user?.role === 'trainer' && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button>Request Phase Change</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Request Phase Change</DialogTitle>
                          <DialogDescription>
                            Submit a request to change the batch phase. This will need approval from your reporting manager.
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                              control={form.control}
                              name="requestedPhase"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Requested Phase</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select phase" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="induction">Induction</SelectItem>
                                      <SelectItem value="training">Training</SelectItem>
                                      <SelectItem value="certification">Certification</SelectItem>
                                      <SelectItem value="ojt">OJT</SelectItem>
                                      <SelectItem value="ojt_certification">OJT Certification</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="justification"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Justification</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Explain why this phase change is needed..."
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="managerId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Reporting Manager</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select manager" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {managers?.map((manager: any) => (
                                        <SelectItem key={manager.id} value={manager.id.toString()}>
                                          {manager.fullName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <DialogFooter>
                              <Button 
                                type="submit" 
                                disabled={createRequestMutation.isPending}
                              >
                                {createRequestMutation.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                  </>
                                ) : (
                                  'Submit Request'
                                )}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                {phaseRequests && phaseRequests.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Batch Name</TableHead>
                        <TableHead>Current Phase</TableHead>
                        <TableHead>Requested Phase</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phaseRequests.map((request: any) => (
                        <TableRow key={request.id}>
                          <TableCell>{request.trainer?.fullName}</TableCell>
                          <TableCell>{batch.name}</TableCell>
                          <TableCell className="capitalize">{request.currentPhase}</TableCell>
                          <TableCell className="capitalize">{request.requestedPhase}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                request.status === 'pending' 
                                  ? 'outline' 
                                  : request.status === 'approved' 
                                    ? 'default'
                                    : 'destructive'
                              }
                            >
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user?.id === request.managerId && request.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApprove(request.id)}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReject(request.id)}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Alert>
                    <AlertDescription>
                      No phase change requests found.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Batch History</h2>
              </div>
              <BatchTimeline batchId={batchId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}