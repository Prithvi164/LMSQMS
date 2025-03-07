import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
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
  };
  lastUpdated?: string;
};

const statusColors = {
  present: 'text-green-500',
  absent: 'text-red-500',
  late: 'text-yellow-500',
  leave: 'text-blue-500'
} as const;

export function BatchDetailsPage() {
  const [selectedTab, setSelectedTab] = useState("attendance");
  const { batchId } = useParams();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentDate = format(new Date(), "PPP");

  // Fetch batch details
  const { data: batch, isLoading: batchLoading, error: batchError } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}`],
    enabled: !!user?.organizationId && !!batchId,
  });

  // Fetch trainees for the batch
  const { data: trainees, isLoading: traineesLoading } = useQuery<Trainee[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`],
    enabled: !!user?.organizationId && !!batchId,
  });

  // Mutation for updating attendance
  const updateAttendanceMutation = useMutation({
    mutationFn: async ({ traineeId, status }: { traineeId: number; status: AttendanceStatus }) => {
      try {
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

        // First check if response is JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server returned non-JSON response");
        }

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to update attendance');
        }

        return data;
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Attendance update failed: ${error.message}`);
        }
        throw new Error('Failed to update attendance');
      }
    },
    onSuccess: (data) => {
      // Invalidate both queries to refresh the data
      queryClient.invalidateQueries({ 
        queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`] 
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}`] 
      });
      toast({
        title: "Attendance Updated",
        description: "The attendance status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  if (batchLoading || traineesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading batch details...</span>
      </div>
    );
  }

  if (batchError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading batch details. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!batch) {
    return (
      <Alert>
        <AlertDescription>Batch not found.</AlertDescription>
      </Alert>
    );
  }

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

  return (
    <div className="p-8 space-y-6">
      {/* Batch Header */}
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

      {/* Batch Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Overall Progress</span>
              <span>{batch.progress || 0}%</span>
            </div>
            <Progress value={batch.progress || 0} />
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="training-plan">Training Planner</TabsTrigger>
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
                    {trainees.map((trainee) => (
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
              {/* Training planner interface will be implemented here */}
              <Alert>
                <AlertDescription>
                  Training planner interface will be implemented here.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}