import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Bell, Users, CalendarDays, CheckCircle2, Loader2, BarChart, ChevronDown, ChevronRight } from "lucide-react";
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
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

// Performance metrics types
type MetricType = 'daily' | 'weekly' | 'monthly';
type DrilldownLevel = 'overview' | 'phase' | 'trainee';

const phases = ['planned', 'induction', 'training', 'certification', 'ojt', 'completed'];

export default function TraineeManagement() {
  const [selectedTab, setSelectedTab] = useState("all-batches");
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [metricType, setMetricType] = useState<MetricType>('weekly');
  const [drilldownLevel, setDrilldownLevel] = useState<DrilldownLevel>('overview');
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
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

  // Set the first batch as selected by default
  useEffect(() => {
    if (batches.length > 0 && !selectedBatch) {
      setSelectedBatch(batches[0].id);
    }
  }, [batches]);

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

  // Sample performance data based on metric type
  const getPerformanceData = () => {
    switch (metricType) {
      case 'daily':
        return [
          { name: 'Mon', score: 85, attendance: 90 },
          { name: 'Tue', score: 88, attendance: 95 },
          { name: 'Wed', score: 92, attendance: 88 },
          { name: 'Thu', score: 90, attendance: 92 },
          { name: 'Fri', score: 87, attendance: 85 }
        ];
      case 'weekly':
        return [
          { name: 'Week 1', score: 85, attendance: 90 },
          { name: 'Week 2', score: 88, attendance: 95 },
          { name: 'Week 3', score: 92, attendance: 88 },
          { name: 'Week 4', score: 90, attendance: 92 }
        ];
      case 'monthly':
        return [
          { name: 'Jan', score: 85, attendance: 90 },
          { name: 'Feb', score: 88, attendance: 95 },
          { name: 'Mar', score: 92, attendance: 88 }
        ];
      default:
        return [];
    }
  };

  const attendanceData = [
    { name: 'Present', value: 85 },
    { name: 'Absent', value: 10 },
    { name: 'Leave', value: 5 }
  ];


  const renderBatchCard = (batch: Batch) => (
    <Card key={batch.id}>
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

        {batch.status === 'planned' ? (
          <Button
            className="w-full mt-4"
            onClick={() => startBatchMutation.mutate(batch.id)}
            disabled={startBatchMutation.isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {startBatchMutation.isPending ? "Starting..." : "Start Batch"}
          </Button>
        ) : (
          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
            </TabsList>
            <TabsContent value="details">
              <div className="space-y-2 mt-4">
                <p className="text-sm">Current Phase: {batch.status}</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Phase Progress</span>
                    <span className="text-sm text-muted-foreground">{Math.round(((phases.indexOf(batch.status) + 1) / phases.length) * 100)}%</span>
                  </div>
                  <Progress value={((phases.indexOf(batch.status) + 1) / phases.length) * 100} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="progress">
              <div className="mt-4">
                <div className="mb-4">
                  <Select defaultValue="weekly" onValueChange={(value) => setMetricType(value as MetricType)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select time period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily View</SelectItem>
                      <SelectItem value="weekly">Weekly View</SelectItem>
                      <SelectItem value="monthly">Monthly View</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getPerformanceData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="score" stroke="#8884d8" name="Overall Score" />
                      <Line type="monotone" dataKey="attendance" stroke="#82ca9d" name="Attendance" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="attendance">
              <div className="mt-4">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={attendanceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
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
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );

  const renderDrilldownControls = () => ( //This function is not used anymore.
    <div className="flex gap-4 mb-6">
      {/*Removed this section as it is replaced in the updated renderBatchCard*/}
    </div>
  );

  const renderPerformanceCharts = () => { //This function is not used anymore.
    return null;
  };


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