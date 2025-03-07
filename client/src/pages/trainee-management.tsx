import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Bell, Users, CalendarDays, CheckCircle2, Loader2, BarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addHours, addMinutes } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer
} from 'recharts';
import { Progress } from "@/components/ui/progress";

// Type for batch data
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

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function TraineeManagement() {
  const [selectedTab, setSelectedTab] = useState("all-batches");
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch all batches
  const {
    data: batches = [],
    isLoading,
    error
  } = useQuery<Batch[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });

  // Fetch batch performance data when a batch is selected
  const { data: batchPerformance } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${selectedBatch}/performance`],
    enabled: !!selectedBatch,
  });

  // Mutation for starting a batch
  const startBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      const response = await fetch(`/api/batches/${batchId}/start`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start batch');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/batches`] });
      toast({
        title: "Batch Started",
        description: "The batch has been successfully started and moved to induction phase.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error Starting Batch",
        description: error.message,
      });
    },
  });

  // Helper function to format date in IST
  const formatToIST = (dateStr: string) => {
    const date = new Date(dateStr);
    const dateIST = addMinutes(addHours(date, 5), 30);
    return format(dateIST, "PPP");
  };

  // Group batches by status
  const batchesByStatus = batches.reduce((acc, batch) => {
    if (!acc[batch.status]) {
      acc[batch.status] = [];
    }
    acc[batch.status].push(batch);
    return acc;
  }, {} as Record<string, Batch[]>);

  const plannedBatches = batchesByStatus['planned'] || [];
  const inductionBatches = batchesByStatus['induction'] || [];
  const trainingBatches = batchesByStatus['training'] || [];
  const certificationBatches = batchesByStatus['certification'] || [];
  const ojtBatches = batchesByStatus['ojt'] || [];
  const completedBatches = batchesByStatus['completed'] || [];

  // Sample performance data (replace with actual data from API)
  const performanceData = [
    { name: 'Week 1', score: 85 },
    { name: 'Week 2', score: 88 },
    { name: 'Week 3', score: 92 },
    { name: 'Week 4', score: 90 }
  ];

  const attendanceData = [
    { name: 'Present', value: 85 },
    { name: 'Absent', value: 10 },
    { name: 'Leave', value: 5 }
  ];

  const phaseProgress = [
    { name: 'Induction', completed: 100 },
    { name: 'Training', completed: 75 },
    { name: 'Certification', completed: 30 },
    { name: 'OJT', completed: 0 },
    { name: 'OJT Certification', completed: 0 }
  ];

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

  const renderBatchCard = (batch: Batch) => (
    <Card 
      key={batch.id} 
      className={`cursor-pointer ${selectedBatch === batch.id ? 'ring-2 ring-primary' : ''}`}
      onClick={() => setSelectedBatch(batch.id)}
    >
      <CardContent className="p-6 space-y-4">
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

        <div className="space-y-2">
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
            className="w-full"
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
      </CardContent>
    </Card>
  );

  const renderPerformanceCharts = () => (
    <div className="space-y-8">
      {/* Weekly Performance Chart */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Weekly Performance Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Chart */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Attendance Distribution</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label
                >
                  {attendanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Phase Progress Chart */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Phase Progress</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={phaseProgress}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" fill="#8884d8" />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );

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
          <TabsTrigger value="progress" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            Progress
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Attendance
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {plannedBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {inductionBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Induction Phase</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inductionBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {trainingBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Training Phase</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {trainingBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {certificationBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Certification Phase</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {certificationBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {ojtBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">OJT Phase</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ojtBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {completedBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Completed Batches</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

        <TabsContent value="progress">
          {selectedBatch ? (
            renderPerformanceCharts()
          ) : (
            <Alert>
              <AlertDescription>
                Select a batch to view detailed performance metrics.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="attendance">
          <Alert>
            <AlertDescription>
              Attendance tracking functionality will be implemented here.
            </AlertDescription>
          </Alert>
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