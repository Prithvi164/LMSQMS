import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart, CalendarDays } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Types
type MetricType = 'daily' | 'weekly' | 'monthly';
type DrilldownLevel = 'overview' | 'phase' | 'trainee';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function BatchMonitoringDetail() {
  const { batchId } = useParams();
  const { user } = useAuth();
  const [metricType, setMetricType] = useState<MetricType>('weekly');
  const [drilldownLevel, setDrilldownLevel] = useState<DrilldownLevel>('overview');
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  // Fetch batch details
  const { data: batch, isLoading, error } = useQuery({
    queryKey: ['/api/organizations', user?.organizationId, 'batches', batchId],
    enabled: !!batchId && !!user?.organizationId,
  });

  // Sample data generators (replace with actual API data)
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
      default:
        return [];
    }
  };

  const getAttendanceData = () => ({
    overview: [
      { date: '2025-03-01', present: 45, absent: 3, leave: 2 },
      { date: '2025-03-02', present: 47, absent: 2, leave: 1 },
      { date: '2025-03-03', present: 46, absent: 2, leave: 2 },
      { date: '2025-03-04', present: 48, absent: 1, leave: 1 },
      { date: '2025-03-05', present: 47, absent: 2, leave: 1 }
    ],
    distribution: [
      { name: 'Present', value: 90 },
      { name: 'Absent', value: 7 },
      { name: 'Leave', value: 3 }
    ]
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading batch details. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const renderProgressTab = () => (
    <div className="space-y-6">
      <div className="flex gap-4">
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
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Trend</h3>
          <div className="h-[400px]">
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

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Performance Distribution</h3>
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

        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Phase Completion</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getPerformanceData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="score" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderAttendanceTab = () => (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Daily Attendance Trend</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getAttendanceData().overview}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="present" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                <Area type="monotone" dataKey="absent" stackId="1" stroke="#ff8042" fill="#ff8042" />
                <Area type="monotone" dataKey="leave" stackId="1" stroke="#8884d8" fill="#8884d8" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Attendance Distribution</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getAttendanceData().distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label
                  >
                    {getAttendanceData().distribution.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Attendance Summary</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Present Rate</span>
                  <span className="font-medium">90%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: '90%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Absent Rate</span>
                  <span className="font-medium">7%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: '7%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Leave Rate</span>
                  <span className="font-medium">3%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: '3%' }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{batch.name}</h1>
          <p className="text-muted-foreground">
            {batch.location?.name} • {batch.process?.name}
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          {batch.status}
        </Badge>
      </div>

      <Tabs defaultValue="progress" className="space-y-6">
        <TabsList>
          <TabsTrigger value="progress" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            Progress
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Attendance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-6">
          {renderProgressTab()}
        </TabsContent>

        <TabsContent value="attendance" className="space-y-6">
          {renderAttendanceTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default BatchMonitoringDetail;