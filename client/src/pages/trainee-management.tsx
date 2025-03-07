import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Bell, Users, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addHours, addMinutes } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// Colors for charts
const COLORS = ['#82ca9d', '#ff8042', '#8884d8'];

// Type definitions
type Batch = {
  id: number;
  name: string;
  startDate: string;
  status: string;
  location: {
    name: string;
  };
  process: {
    name: string;
  };
  line_of_business: {
    name: string;
  };
};

export default function TraineeManagement() {
  const [selectedTab, setSelectedTab] = useState("all-batches");
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    data: batches = [],
    isLoading,
    error
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });

  // Helper function to check if batch is in active phase
  const isActivePhase = (status: string) => {
    return ['induction', 'training', 'certification', 'ojt'].includes(status);
  };

  // Group batches by status
  const batchesByStatus = batches.reduce((acc: Record<string, Batch[]>, batch: Batch) => {
    if (!acc[batch.status]) {
      acc[batch.status] = [];
    }
    acc[batch.status].push(batch);
    return acc;
  }, {});

  const plannedBatches = batchesByStatus['planned'] || [];
  const inductionBatches = batchesByStatus['induction'] || [];
  const trainingBatches = batchesByStatus['training'] || [];
  const certificationBatches = batchesByStatus['certification'] || [];
  const ojtBatches = batchesByStatus['ojt'] || [];
  const completedBatches = batchesByStatus['completed'] || [];

  // Sample attendance data (replace with actual API data)
  const attendanceData = [
    { date: '2025-03-07', present: 15, absent: 2, leave: 1 },
    { date: '2025-03-06', present: 16, absent: 1, leave: 1 },
    { date: '2025-03-05', present: 14, absent: 3, leave: 1 },
    { date: '2025-03-04', present: 16, absent: 2, leave: 0 },
    { date: '2025-03-03', present: 15, absent: 2, leave: 1 }
  ];

  const renderAttendanceSection = (batch: Batch) => {
    if (!isActivePhase(batch.status)) return null;

    return (
      <div className="mt-4 pt-4 border-t">
        <h4 className="font-medium mb-4">Attendance Overview</h4>
        <div className="h-[200px] w-full">
          <ResponsiveContainer>
            <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="present" fill={COLORS[0]} name="Present" />
              <Bar dataKey="absent" fill={COLORS[1]} name="Absent" />
              <Bar dataKey="leave" fill={COLORS[2]} name="On Leave" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">15</div>
              <div className="text-sm text-muted-foreground">Present Today</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">2</div>
              <div className="text-sm text-muted-foreground">Absent Today</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">1</div>
              <div className="text-sm text-muted-foreground">On Leave Today</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderBatchCard = (batch: Batch) => (
    <Card
      key={batch.id}
      className={`cursor-pointer ${selectedBatch === batch.id ? 'ring-2 ring-primary' : ''}`}
      onClick={() => setSelectedBatch(batch.id)}
    >
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg">{batch.name}</h3>
            <p className="text-sm text-muted-foreground">
              {batch.location.name} • {batch.process.name}
            </p>
          </div>
          <Badge
            variant={batch.status === 'planned' ? "outline" : "secondary"}
            className="capitalize"
          >
            {batch.status}
          </Badge>
        </div>

        <div className="space-y-2 mt-4">
          <p className="text-sm">
            <span className="font-medium">Start Date:</span>{" "}
            {formatToIST(batch.startDate)}
          </p>
          <p className="text-sm">
            <span className="font-medium">LOB:</span>{" "}
            {batch.line_of_business.name}
          </p>
        </div>

        {batch.status === 'planned' && (
          <Button
            className="w-full mt-4"
            onClick={(e) => {
              e.stopPropagation();
              startBatchMutation.mutate(batch.id);
            }}
            disabled={startBatchMutation.isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {startBatchMutation.isPending ? "Starting..." : "Start Batch"}
          </Button>
        )}

        {renderAttendanceSection(batch)}
      </CardContent>
    </Card>
  );

  // Helper function to format date in IST
  const formatToIST = (dateStr: string) => {
    const date = new Date(dateStr);
    const dateIST = addMinutes(addHours(date, 5), 30);
    return format(dateIST, "PPP");
  };

  // Mutation for starting a batch
  const startBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      const response = await fetch(`/api/batches/${batchId}/start`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to start batch');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/batches`] });
      toast({
        title: "Success",
        description: "Batch has been started successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start the batch. Please try again.",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading batches...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading batches. Please refresh the page to try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Trainee Management</h1>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="all-batches" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Batches
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all-batches">
          <div className="space-y-6">
            {plannedBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Planned Batches</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {plannedBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {inductionBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Induction Phase</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {inductionBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {trainingBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Training Phase</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {trainingBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {certificationBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Certification Phase</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {certificationBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {ojtBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">OJT Phase</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {ojtBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {completedBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Completed Batches</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {completedBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {batches.length === 0 && (
              <Alert>
                <AlertDescription>
                  No batches found. Create a new batch to get started.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <Alert>
            <AlertDescription>
              Notifications about batch progress and important updates will appear here.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}