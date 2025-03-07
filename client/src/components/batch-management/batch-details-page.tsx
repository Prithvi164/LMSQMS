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

type AttendanceStatus = 'present' | 'absent' | 'late';

type Trainee = {
  id: number;
  name: string;
  status: AttendanceStatus;
  lastUpdated?: string;
};

export function BatchDetailsPage() {
  const [selectedTab, setSelectedTab] = useState("attendance");
  const { batchId } = useParams();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentDate = format(new Date(), "PPP");

  // Fetch batch details
  const { data: batch, isLoading, error } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}`],
    enabled: !!user?.organizationId && !!batchId,
  });

  // Fetch trainees for the batch
  const { data: trainees } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`],
    enabled: !!user?.organizationId && !!batchId,
  });

  // Mutation for updating attendance
  const updateAttendanceMutation = useMutation({
    mutationFn: async ({ traineeId, status }: { traineeId: number; status: AttendanceStatus }) => {
      const response = await fetch(`/api/attendance/${traineeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, date: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error('Failed to update attendance');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`] });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading batch details...</span>
      </div>
    );
  }

  if (error) {
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

  if (batch.status === 'planned') {
    return (
      <Alert>
        <AlertDescription>
          Detailed tracking is only available after the batch has started.
        </AlertDescription>
      </Alert>
    );
  }

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'absent':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'late':
        return <Clock className="h-4 w-4 text-yellow-500" />;
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
            {batch.location.name} • {batch.process.name}
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

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trainee Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainees?.map((trainee: Trainee) => (
                    <TableRow key={trainee.id}>
                      <TableCell>{trainee.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(trainee.status)}
                          <span className="capitalize">{trainee.status || 'Not marked'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {trainee.lastUpdated ? format(new Date(trainee.lastUpdated), "hh:mm a") : '-'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={trainee.status}
                          onValueChange={(value: AttendanceStatus) => 
                            updateAttendanceMutation.mutate({ traineeId: trainee.id, status: value })
                          }
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Mark attendance" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Present</SelectItem>
                            <SelectItem value="absent">Absent</SelectItem>
                            <SelectItem value="late">Late</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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