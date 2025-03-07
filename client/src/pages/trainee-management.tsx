import { useState, useEffect } from "react";
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
  capacityLimit: number;
  enrolledCount: number;
};

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// Performance metrics types
type MetricType = 'daily' | 'weekly' | 'monthly';
type DrilldownLevel = 'overview' | 'phase' | 'trainee';

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

  // Set the first batch as selected by default when batches are loaded
  useEffect(() => {
    if (batches && batches.length > 0 && !selectedBatch) {
      setSelectedBatch(batches[0].id);
    }
  }, [batches, selectedBatch]);

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

  const renderBatchCard = (batch: Batch) => (
    <Card
      key={batch.id}
      className={`${selectedBatch === batch.id ? 'border-primary' : ''} cursor-pointer`}
      onClick={() => {
        if (batch.status !== 'planned') {
          window.location.href = `/batch-details/${batch.id}`;
        } else {
          setSelectedBatch(batch.id);
        }
      }}
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
          <div className="mt-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">Capacity</span>
              <span className="text-sm">{batch.enrolledCount || 0} / {batch.capacityLimit}</span>
            </div>
            <Progress value={(batch.enrolledCount || 0) / batch.capacityLimit * 100} />
          </div>
        </div>

        {batch.status === 'planned' && (
          <Button
            className="w-full transition-transform active:scale-95 hover:scale-100"
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

  const renderDrilldownControls = () => (
    <div className="flex gap-4 mb-6">
      <Select value={metricType} onValueChange={(value: MetricType) => setMetricType(value)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select metric type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="daily">Daily Metrics</SelectItem>
          <SelectItem value="weekly">Weekly Metrics</SelectItem>
          <SelectItem value="monthly">Monthly Metrics</SelectItem>
        </SelectContent>
      </Select>

      <Select value={drilldownLevel} onValueChange={(value: DrilldownLevel) => setDrilldownLevel(value)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select view level" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="overview">Batch Overview</SelectItem>
          <SelectItem value="phase">Phase Details</SelectItem>
          <SelectItem value="trainee">Trainee Details</SelectItem>
        </SelectContent>
      </Select>

      {drilldownLevel === 'phase' && (
        <Select value={selectedPhase || ''} onValueChange={setSelectedPhase}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select phase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="induction">Induction</SelectItem>
            <SelectItem value="training">Training</SelectItem>
            <SelectItem value="certification">Certification</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );

  const renderPerformanceCharts = () => {
    // Overview Level Charts
    if (drilldownLevel === 'overview') {
      return (
        <div className="space-y-8">
          {/* Overall Performance Trend */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Overall Performance Trend</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getPerformanceData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="score" stroke="#8884d8" name="Overall Score" />
                    <Line type="monotone" dataKey="attendance" stroke="#82ca9d" name="Attendance" />
                    <Line type="monotone" dataKey="assessment" stroke="#ffc658" name="Assessment" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Progress Distribution */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Progress Distribution</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={getPerformanceData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="score" stackId="1" stroke="#8884d8" fill="#8884d8" />
                    <Area type="monotone" dataKey="attendance" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                    <Area type="monotone" dataKey="assessment" stackId="1" stroke="#ffc658" fill="#ffc658" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Phase Level Charts
    if (drilldownLevel === 'phase' && selectedPhase) {
      const phaseData = phasePerformanceData[selectedPhase as keyof typeof phasePerformanceData];
      return (
        <div className="space-y-8">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">{selectedPhase.charAt(0).toUpperCase() + selectedPhase.slice(1)} Phase Performance</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={phaseData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completion" fill="#8884d8" name="Completion %" />
                    <Bar dataKey="performance" fill="#82ca9d" name="Performance Score" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Trainee Level Charts
    if (drilldownLevel === 'trainee') {
      return (
        <div className="space-y-8">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Individual Trainee Performance</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={traineePerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="score" fill="#8884d8" name="Overall Score" />
                    <Bar dataKey="progress" fill="#82ca9d" name="Progress" />
                    <Bar dataKey="attendance" fill="#ffc658" name="Attendance" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return null;
  };

  const getPerformanceData = () => {
    switch (metricType) {
      case 'daily':
        return [
          { name: 'Mon', score: 85, attendance: 90, assessment: 82 },
          { name: 'Tue', score: 88, attendance: 95, assessment: 85 },
          { name: 'Wed', score: 92, attendance: 88, assessment: 90 },
          { name: 'Thu', score: 90, attendance: 92, assessment: 88 },
          { name: 'Fri', score: 87, attendance: 85, assessment: 89 }
        ];
      case 'weekly':
        return [
          { name: 'Week 1', score: 85, attendance: 90, assessment: 82 },
          { name: 'Week 2', score: 88, attendance: 95, assessment: 85 },
          { name: 'Week 3', score: 92, attendance: 88, assessment: 90 },
          { name: 'Week 4', score: 90, attendance: 92, assessment: 88 }
        ];
      case 'monthly':
        return [
          { name: 'Jan', score: 85, attendance: 90, assessment: 82 },
          { name: 'Feb', score: 88, attendance: 95, assessment: 85 },
          { name: 'Mar', score: 92, attendance: 88, assessment: 90 }
        ];
      default:
        return [];
    }
  };

  // Sample trainee-specific data
  const traineePerformanceData = [
    { name: 'John Doe', score: 92, progress: 85, attendance: 95 },
    { name: 'Jane Smith', score: 88, progress: 90, attendance: 92 },
    { name: 'Mike Johnson', score: 85, progress: 88, attendance: 90 },
    { name: 'Sarah Wilson', score: 90, progress: 92, attendance: 88 }
  ];

  // Sample phase-specific data
  const phasePerformanceData = {
    induction: [
      { name: 'Day 1', completion: 100, performance: 85 },
      { name: 'Day 2', completion: 90, performance: 88 },
      { name: 'Day 3', completion: 95, performance: 92 }
    ],
    training: [
      { name: 'Week 1', completion: 85, performance: 80 },
      { name: 'Week 2', completion: 75, performance: 85 },
      { name: 'Week 3', completion: 60, performance: 88 }
    ],
    certification: [
      { name: 'Module 1', completion: 90, performance: 85 },
      { name: 'Module 2', completion: 85, performance: 82 },
      { name: 'Module 3', completion: 70, performance: 78 }
    ]
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
          <TabsTrigger value="progress" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            Progress {selectedBatch && <Badge variant="outline" className="ml-2">Batch Selected</Badge>}
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
            <div className="space-y-6">
              {renderDrilldownControls()}
              {renderPerformanceCharts()}
            </div>
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