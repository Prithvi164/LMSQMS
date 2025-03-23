import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { StatsCard } from '@/components/ui/stats-card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Users, 
  UserRound, 
  Layers, 
  MapPin, 
  BarChart2,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  TrendingUp,
  Briefcase,
  GraduationCap,
  CheckCircle2,
  ClipboardCheck,
  Award,
  Calendar,
  Clock
} from 'lucide-react';

// Types for the analytics API responses
interface HeadcountByCategory {
  active: number;
  trainee: number;
}

interface HeadcountByRole {
  [role: string]: number;
}

interface HeadcountByLocation {
  [location: string]: number;
}

interface HeadcountProjection {
  date: string;
  expectedHeadcount: number;
}

interface ProcessHeadcountAnalytics {
  processId: number;
  processName: string;
  totalHeadcount: number;
  byCategory: HeadcountByCategory;
  byRole: HeadcountByRole;
  byLocation: HeadcountByLocation;
  projection?: HeadcountProjection[];
}

interface Process {
  id: number;
  name: string;
}

interface LineOfBusiness {
  id: number;
  name: string;
}

// Colors for charts
const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c', 
  '#d0ed57', '#83a6ed', '#8dd1e1', '#a4262c', '#ca5010'
];

// Additional interface types for the new insights
interface BatchInsight {
  batchId: number;
  batchName: string;
  status: string;
  traineesCount: number;
  completionRate: number;
  phaseChangeRate: number;
  startDate: string;
  endDate: string;
}

interface TrainerInsight {
  trainerId: number;
  trainerName: string;
  batchesCount: number;
  traineesCount: number;
  successRate: number;
  currentLoad: number;
}

interface AttendanceInsight {
  processId: number;
  processName: string;
  averageAttendance: number;
  absenteeRate: number;
  onTimeRate: number;
  lateRate: number;
  dailyTrend: { date: string; attendance: number }[];
}

interface WrittenAssessmentInsight {
  processId: number;
  processName: string;
  averageScore: number;
  passingRate: number;
  failureRate: number;
  topPerformers: number;
  underperformers: number;
}

interface CertificationInsight {
  processId: number;
  processName: string;
  certificationRate: number;
  averageAttempts: number;
  firstTimePassRate: number;
  pendingCertifications: number;
}

// Main dashboard component
export default function AnalyticsDashboard() {
  // Main tab control for insight types
  const [insightType, setInsightType] = useState('headcount');
  
  // Filter controls (apply across insight types)
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedProcess, setSelectedProcess] = useState<number | null>(null);
  const [selectedLOB, setSelectedLOB] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<{from: Date | undefined, to: Date | undefined}>({from: undefined, to: undefined});
  
  // Time period filter for trend data
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'quarter'>('month');

  // Fetch processes
  const { data: processes, isLoading: isProcessesLoading } = useQuery({
    queryKey: ['/api/processes'],
    retry: false
  });

  // Fetch line of businesses
  const { data: lineOfBusinesses, isLoading: isLOBLoading } = useQuery({
    queryKey: ['/api/line-of-businesses'],
    retry: false
  });

  // Build the correct endpoint URL based on the selected filter
  const analyticsEndpoint = useMemo(() => {
    if (selectedTab === 'overview') {
      return '/api/analytics/headcount';
    } else if (selectedTab === 'process' && selectedProcess) {
      return `/api/analytics/headcount/process/${selectedProcess}`;
    } else if (selectedTab === 'lob' && selectedLOB) {
      return `/api/analytics/headcount/line-of-business/${selectedLOB}`;
    }
    return null;
  }, [selectedTab, selectedProcess, selectedLOB]);

  // Fetch analytics based on selected filter
  const { data: analyticsData, isLoading: isAnalyticsLoading, error: analyticsError } = useQuery({
    queryKey: analyticsEndpoint ? [analyticsEndpoint] : ['analytics', 'disabled'],
    enabled: !!analyticsEndpoint && (
      (selectedTab === 'overview') || 
      (selectedTab === 'process' && !!selectedProcess) || 
      (selectedTab === 'lob' && !!selectedLOB)
    ),
    retry: 2
  });
  
  // Handle process selection
  const handleProcessChange = (value: string) => {
    setSelectedProcess(Number(value));
  };

  // Handle LOB selection
  const handleLOBChange = (value: string) => {
    setSelectedLOB(Number(value));
  };

  // Loading state
  const isLoading = isProcessesLoading || isLOBLoading || isAnalyticsLoading;
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:gap-8 mb-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive insights and metrics for training management
          </p>
        </div>
      </div>

      {/* Primary tabs for different insight types */}
      <Tabs 
        value={insightType} 
        onValueChange={setInsightType} 
        className="space-y-4 mb-6"
      >
        <TabsList className="mb-4">
          <TabsTrigger value="headcount" className="flex items-center">
            <Users className="h-4 w-4 mr-2" />
            Headcount
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center">
            <Briefcase className="h-4 w-4 mr-2" />
            Batch Management
          </TabsTrigger>
          <TabsTrigger value="trainer" className="flex items-center">
            <GraduationCap className="h-4 w-4 mr-2" />
            Trainer Management
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="assessment" className="flex items-center">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Assessment
          </TabsTrigger>
          <TabsTrigger value="certification" className="flex items-center">
            <Award className="h-4 w-4 mr-2" />
            Certification
          </TabsTrigger>
        </TabsList>

        {/* Filter options common to all insight types */}
        <div className="filter-bar p-4 bg-muted/20 rounded-lg mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <Select onValueChange={handleProcessChange}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by process" />
              </SelectTrigger>
              <SelectContent>
                {processes?.map((process: Process) => (
                  <SelectItem key={process.id} value={process.id.toString()}>
                    {process.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1 min-w-[200px]">
            <Select onValueChange={handleLOBChange}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by line of business" />
              </SelectTrigger>
              <SelectContent>
                {lineOfBusinesses?.map((lob: LineOfBusiness) => (
                  <SelectItem key={lob.id} value={lob.id.toString()}>
                    {lob.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1 min-w-[200px]">
            <Select value={timeFilter} onValueChange={(value: any) => setTimeFilter(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="quarter">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Tabs>

      {/* Content for selected insight type */}
      {insightType === 'headcount' && (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Headcount"
              value="750"
              icon={<Users className="h-4 w-4" />}
            />
            <StatsCard
              title="Active Employees"
              value="680"
              icon={<UserRound className="h-4 w-4" />}
            />
            <StatsCard
              title="Trainees"
              value="70"
              icon={<Layers className="h-4 w-4" />}
            />
            <StatsCard
              title="Active-to-Trainee Ratio"
              value="9.7"
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>
        </div>
      )}

      {/* Batch Management Insights */}
      {insightType === 'batch' && (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatsCard
              title="Active Batches"
              value="12"
              icon={<Briefcase className="h-4 w-4" />}
              description="Currently running batches"
            />
            <StatsCard
              title="Total Trainees"
              value="243"
              icon={<Users className="h-4 w-4" />}
              description="Enrolled in active batches"
            />
            <StatsCard
              title="Completion Rate"
              value="87%"
              icon={<CheckCircle2 className="h-4 w-4" />}
              description="Average completion rate"
            />
            <StatsCard
              title="Phase Transitions"
              value="14"
              icon={<TrendingUp className="h-4 w-4" />}
              description="Pending phase transitions"
            />
          </div>

          {/* Batch Overview Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Briefcase className="h-4 w-4 mr-2" />
                Batch Performance Overview
              </CardTitle>
              <CardDescription>Performance metrics for active batches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Trainees</TableHead>
                      <TableHead>Completion %</TableHead>
                      <TableHead>Phase Change %</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">CS-Billing-May-2025</TableCell>
                      <TableCell><Badge variant="outline">In Progress</Badge></TableCell>
                      <TableCell>24</TableCell>
                      <TableCell>78%</TableCell>
                      <TableCell>65%</TableCell>
                      <TableCell>May 1, 2025</TableCell>
                      <TableCell>Jun 15, 2025</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Tech-Support-Jan-2025</TableCell>
                      <TableCell><Badge variant="outline">Near Completion</Badge></TableCell>
                      <TableCell>18</TableCell>
                      <TableCell>92%</TableCell>
                      <TableCell>85%</TableCell>
                      <TableCell>Jan 15, 2025</TableCell>
                      <TableCell>Mar 30, 2025</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Sales-Inbound-Feb-2025</TableCell>
                      <TableCell><Badge variant="outline">In Progress</Badge></TableCell>
                      <TableCell>32</TableCell>
                      <TableCell>64%</TableCell>
                      <TableCell>51%</TableCell>
                      <TableCell>Feb 10, 2025</TableCell>
                      <TableCell>Apr 25, 2025</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trainer Management Insights */}
      {insightType === 'trainer' && (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatsCard
              title="Active Trainers"
              value="8"
              icon={<GraduationCap className="h-4 w-4" />}
            />
            <StatsCard
              title="Avg. Trainee Load"
              value="28"
              icon={<Users className="h-4 w-4" />}
            />
            <StatsCard
              title="Success Rate"
              value="92%"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatsCard
              title="Avg. Batches"
              value="2.5"
              icon={<Briefcase className="h-4 w-4" />}
            />
          </div>

          {/* Trainer Overview Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <GraduationCap className="h-4 w-4 mr-2" />
                Trainer Performance Overview
              </CardTitle>
              <CardDescription>Performance metrics for active trainers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainer</TableHead>
                      <TableHead>Batches</TableHead>
                      <TableHead>Trainees</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Current Load</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">John Smith</TableCell>
                      <TableCell>3</TableCell>
                      <TableCell>42</TableCell>
                      <TableCell>94%</TableCell>
                      <TableCell>High</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Maria Rodriguez</TableCell>
                      <TableCell>2</TableCell>
                      <TableCell>36</TableCell>
                      <TableCell>91%</TableCell>
                      <TableCell>Medium</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">James Chen</TableCell>
                      <TableCell>2</TableCell>
                      <TableCell>27</TableCell>
                      <TableCell>89%</TableCell>
                      <TableCell>Medium</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance Insights */}
      {insightType === 'attendance' && (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatsCard
              title="Avg. Attendance"
              value="92%"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatsCard
              title="Absentee Rate"
              value="8%"
              icon={<Users className="h-4 w-4" />}
            />
            <StatsCard
              title="On-Time Rate"
              value="84%"
              icon={<Calendar className="h-4 w-4" />}
            />
            <StatsCard
              title="Late Arrival Rate"
              value="16%"
              icon={<Clock className="h-4 w-4" />}
            />
          </div>
        </div>
      )}

      {/* Written Assessment Insights */}
      {insightType === 'assessment' && (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatsCard
              title="Avg. Score"
              value="78%"
              icon={<ClipboardCheck className="h-4 w-4" />}
            />
            <StatsCard
              title="Passing Rate"
              value="84%"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatsCard
              title="Top Performers"
              value="32"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatsCard
              title="Need Improvement"
              value="18"
              icon={<Users className="h-4 w-4" />}
            />
          </div>
        </div>
      )}

      {/* Certification Insights */}
      {insightType === 'certification' && (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatsCard
              title="Certification Rate"
              value="76%"
              icon={<Award className="h-4 w-4" />}
            />
            <StatsCard
              title="Avg. Attempts"
              value="1.8"
              icon={<ClipboardCheck className="h-4 w-4" />}
            />
            <StatsCard
              title="First-time Pass"
              value="62%"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatsCard
              title="Pending Cert."
              value="42"
              icon={<Users className="h-4 w-4" />}
            />
          </div>
        </div>
      )}
    </div>
  );
}