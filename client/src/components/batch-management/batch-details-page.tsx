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

  // Initialize form at the top level
  const form = useForm({
    resolver: zodResolver(phaseChangeFormSchema),
    defaultValues: {
      requestedPhase: undefined,
      justification: "",
      managerId: "",
    },
  });

  // Query hooks
  const { data: batch, isLoading: batchLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}`],
    enabled: !!user?.organizationId && !!batchId,
  });

  const { data: trainees, isLoading: traineesLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`],
    enabled: !!user?.organizationId && !!batchId,
  });

  const { data: managers } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/users`],
    enabled: !!user?.organizationId,
    select: (users: any[]) => users.filter(u => u.role === 'manager'),
  });

  // Add separate queries for trainer and manager phase requests
  const { data: trainerRequests } = useQuery({
    queryKey: [`/api/trainers/${user?.id}/phase-change-requests`],
    enabled: !!user?.id && user?.role === 'trainer',
  });

  const { data: managerRequests } = useQuery({
    queryKey: [`/api/managers/${user?.id}/phase-change-requests`],
    enabled: !!user?.id && user?.role === 'manager',
  });

  // Combine requests based on user role
  const phaseRequests = user?.role === 'trainer' ? trainerRequests : 
                       user?.role === 'manager' ? managerRequests : [];

  // Mutations
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
      const response = await fetch(`/api/batches/${batchId}/phase-change-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create request');
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
    },
  });

  // Event handlers
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

  const onSubmit = (data: any) => {
    createRequestMutation.mutate({
      ...data,
      managerId: parseInt(data.managerId),
    });
  };

  // Show loading skeleton while data is being fetched
  if (batchLoading || traineesLoading) {
    return <LoadingSkeleton />;
  }

  if (!batch) {
    return (
      <Alert>
        <AlertDescription>Batch not found.</AlertDescription>
      </Alert>
    );
  }

  const enrolledCount = trainees?.length || 0;
  const remainingCapacity = batch.capacityLimit - enrolledCount;

  // Only show phase requests tab for trainers and managers
  const showPhaseRequestsTab = user?.role === 'trainer' || user?.role === 'manager';

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
              <div className="flex justify-between">
                <span>Total Capacity</span>
                <span>{batch.capacityLimit}</span>
              </div>
              <div className="flex justify-between">
                <span>Enrolled Trainees</span>
                <span>{enrolledCount}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Remaining Slots</span>
                <span>{remainingCapacity}</span>
              </div>
            </div>
            <Progress value={(enrolledCount / batch.capacityLimit) * 100} />
          </div>
        </CardContent>
      </Card>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="training-plan">Training Planner</TabsTrigger>
          {showPhaseRequestsTab && (
            <TabsTrigger value="phase-requests">Phase Requests</TabsTrigger>
          )}
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

        {showPhaseRequestsTab && (
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
                              <Button type="submit">Submit Request</Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                {/* Phase change requests list */}
                {phaseRequests && phaseRequests.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requested By</TableHead>
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
                          <TableCell>{request.currentPhase}</TableCell>
                          <TableCell>{request.requestedPhase}</TableCell>
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
      </Tabs>
    </div>
  );
}