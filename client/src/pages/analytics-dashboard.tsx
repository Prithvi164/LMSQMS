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
  Calendar
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

export default function AnalyticsDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedProcess, setSelectedProcess] = useState<number | null>(null);
  const [selectedLOB, setSelectedLOB] = useState<number | null>(null);

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
    retry: 2,
    // Add a success handler to debug the response data
    onSuccess: (data) => {
      console.log('Analytics data received:', data);
    },
    onError: (error) => {
      console.error('Error fetching analytics data:', error);
    }
  });
  
  // Debug information
  useEffect(() => {
    console.log('Current tab:', selectedTab);
    console.log('Selected process:', selectedProcess);
    console.log('Selected LOB:', selectedLOB);
    console.log('Is analytics loading:', isAnalyticsLoading);
    console.log('Analytics error:', analyticsError);
  }, [selectedTab, selectedProcess, selectedLOB, isAnalyticsLoading, analyticsError]);

  // Format data for role pie chart
  const formatRoleData = (data: ProcessHeadcountAnalytics | ProcessHeadcountAnalytics[]) => {
    if (!data) return [{ name: 'No Data Available', value: 1 }];
    
    if (Array.isArray(data)) {
      // For overview, aggregate roles across all processes
      const aggregatedRoles: { [key: string]: number } = {};
      data.forEach(process => {
        if (process?.byRole) {
          Object.entries(process.byRole).forEach(([role, count]) => {
            aggregatedRoles[role] = (aggregatedRoles[role] || 0) + (count || 0);
          });
        }
      });
      
      const roleData = Object.entries(aggregatedRoles).map(([name, value]) => ({ name, value }));
      return roleData.length > 0 ? roleData : [{ name: 'No Data Available', value: 1 }];
    } else {
      // For single process
      const roleData = Object.entries(data.byRole || {}).map(([name, value]) => ({ name, value: value || 0 }));
      return roleData.length > 0 ? roleData : [{ name: 'No Data Available', value: 1 }];
    }
  };

  // Format data for location pie chart
  const formatLocationData = (data: ProcessHeadcountAnalytics | ProcessHeadcountAnalytics[]) => {
    if (!data) return [{ name: 'No Data Available', value: 1 }];
    
    if (Array.isArray(data)) {
      // For overview, aggregate locations across all processes
      const aggregatedLocations: { [key: string]: number } = {};
      data.forEach(process => {
        if (process?.byLocation) {
          Object.entries(process.byLocation).forEach(([location, count]) => {
            aggregatedLocations[location] = (aggregatedLocations[location] || 0) + (count || 0);
          });
        }
      });
      
      const locationData = Object.entries(aggregatedLocations).map(([name, value]) => ({ name, value }));
      return locationData.length > 0 ? locationData : [{ name: 'No Data Available', value: 1 }];
    } else {
      // For single process
      const locationData = Object.entries(data.byLocation || {}).map(([name, value]) => ({ name, value: value || 0 }));
      return locationData.length > 0 ? locationData : [{ name: 'No Data Available', value: 1 }];
    }
  };

  // Format data for headcount projection line chart
  const formatProjectionData = (data: ProcessHeadcountAnalytics | ProcessHeadcountAnalytics[]) => {
    if (!data) return [{ date: new Date().toISOString(), expectedHeadcount: 0 }];
    
    if (Array.isArray(data)) {
      // Combine projections from all processes
      const projectionMap = new Map<string, number>();
      
      data.forEach(process => {
        if (process?.projection && Array.isArray(process.projection)) {
          process.projection.forEach(proj => {
            if (proj?.date && typeof proj.expectedHeadcount === 'number') {
              const currentValue = projectionMap.get(proj.date) || 0;
              projectionMap.set(proj.date, currentValue + proj.expectedHeadcount);
            }
          });
        }
      });
      
      // If there's no data, return a placeholder with today's date and zero headcount
      if (projectionMap.size === 0) {
        return [{ date: new Date().toISOString(), expectedHeadcount: 0 }];
      }
      
      // Convert map to array and sort by date
      return Array.from(projectionMap, ([date, expectedHeadcount]) => ({ date, expectedHeadcount }))
        .sort((a, b) => {
          try {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          } catch (e) {
            // If we can't parse the date, return 0 (no change in order)
            return 0;
          }
        });
    } else {
      // Check if projection exists and is an array
      if (!data.projection || !Array.isArray(data.projection) || data.projection.length === 0) {
        return [{ date: new Date().toISOString(), expectedHeadcount: 0 }];
      }
      
      // Return projection for single process, sorted by date
      return [...data.projection]
        .filter(proj => proj?.date && typeof proj.expectedHeadcount === 'number') // Only include valid entries
        .sort((a, b) => {
          try {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          } catch (e) {
            // If we can't parse the date, return 0 (no change in order)
            return 0;
          }
        });
    }
  };

  // Format data for process comparison bar chart
  const formatProcessComparisonData = (data: ProcessHeadcountAnalytics[]) => {
    if (!data || !Array.isArray(data)) return [];
    
    return data.map(process => ({
      name: process?.processName || 'Unknown Process',
      total: process?.totalHeadcount || 0,
      active: process?.byCategory?.active || 0,
      trainee: process?.byCategory?.trainee || 0
    }));
  };

  // Calculate active-to-trainee ratio for process
  const calculateActiveToTraineeRatio = (data: ProcessHeadcountAnalytics | ProcessHeadcountAnalytics[]) => {
    if (!data) return 'N/A';
    
    if (Array.isArray(data)) {
      let totalActive = 0;
      let totalTrainee = 0;
      
      data.forEach(process => {
        if (process?.byCategory) {
          totalActive += process.byCategory.active || 0;
          totalTrainee += process.byCategory.trainee || 0;
        }
      });
      
      return totalTrainee > 0 ? (totalActive / totalTrainee).toFixed(2) : 'N/A';
    } else {
      return data.byCategory?.trainee > 0 
        ? ((data.byCategory?.active || 0) / data.byCategory.trainee).toFixed(2)
        : 'N/A';
    }
  };

  // Get total headcount
  const getTotalHeadcount = (data: ProcessHeadcountAnalytics | ProcessHeadcountAnalytics[]) => {
    if (!data) return 0;
    
    if (Array.isArray(data)) {
      return data.reduce((sum, process) => sum + (process?.totalHeadcount || 0), 0);
    } else {
      return data.totalHeadcount || 0;
    }
  };

  // Get active and trainee totals
  const getCategoryTotals = (data: ProcessHeadcountAnalytics | ProcessHeadcountAnalytics[]) => {
    if (!data) return { active: 0, trainee: 0 };
    
    if (Array.isArray(data)) {
      let totalActive = 0;
      let totalTrainee = 0;
      
      data.forEach(process => {
        if (process?.byCategory) {
          totalActive += process.byCategory.active || 0;
          totalTrainee += process.byCategory.trainee || 0;
        }
      });
      
      return { active: totalActive, trainee: totalTrainee };
    } else {
      return data.byCategory || { active: 0, trainee: 0 };
    }
  };

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
            View headcount analytics and projections across processes
          </p>
        </div>
      </div>

      <Tabs
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="process">Process</TabsTrigger>
          <TabsTrigger value="lob">Line of Business</TabsTrigger>
        </TabsList>

        {selectedTab === 'process' && (
          <div className="my-4">
            <Select onValueChange={handleProcessChange}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select a process" />
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
        )}

        {selectedTab === 'lob' && (
          <div className="my-4">
            <Select onValueChange={handleLOBChange}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select a line of business" />
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
        )}

        {/* Ensure data is loaded and selected view (if needed) is chosen before displaying content */}
        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-6 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : analyticsError ? (
          <div className="p-6 text-center">
            <div className="text-red-500 mb-4">Error loading analytics data</div>
            <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto max-h-[200px]">
              {analyticsError.toString()}
            </pre>
          </div>
        ) : !analyticsData ? (
          <div className="p-6 text-center">
            <div className="text-amber-500 mb-4">No analytics data available</div>
            <p>There might be no users assigned to the selected process or filters.</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <StatsCard
                title="Total Headcount"
                value={getTotalHeadcount(analyticsData).toString()}
                icon={<Users className="h-4 w-4" />}
              />
              <StatsCard
                title="Active Employees"
                value={getCategoryTotals(analyticsData).active.toString()}
                icon={<UserRound className="h-4 w-4" />}
              />
              <StatsCard
                title="Trainees"
                value={getCategoryTotals(analyticsData).trainee.toString()}
                icon={<Layers className="h-4 w-4" />}
              />
              <StatsCard
                title="Active-to-Trainee Ratio"
                value={calculateActiveToTraineeRatio(analyticsData)}
                icon={<TrendingUp className="h-4 w-4" />}
              />
            </div>

            {/* Charts - in tabs */}
            <Tabs defaultValue="breakdown" className="space-y-4">
              <TabsList>
                <TabsTrigger value="breakdown">Breakdowns</TabsTrigger>
                <TabsTrigger value="projections">Projections</TabsTrigger>
                {selectedTab === 'overview' && <TabsTrigger value="comparison">Process Comparison</TabsTrigger>}
              </TabsList>

              <TabsContent value="breakdown" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Role Distribution Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <UserRound className="h-4 w-4 mr-2" />
                        Role Distribution
                      </CardTitle>
                      <CardDescription>Headcount breakdown by role</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={formatRoleData(analyticsData)}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {formatRoleData(analyticsData).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Location Distribution Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2" />
                        Location Distribution
                      </CardTitle>
                      <CardDescription>Headcount breakdown by location</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={formatLocationData(analyticsData)}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {formatLocationData(analyticsData).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="projections">
                {/* Headcount Projection Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <LineChartIcon className="h-4 w-4 mr-2" />
                      Headcount Projection (Next 90 Days)
                    </CardTitle>
                    <CardDescription>Expected headcount changes based on last working days and batch handovers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={formatProjectionData(analyticsData)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(date) => new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="expectedHeadcount" 
                          stroke="#8884d8" 
                          activeDot={{ r: 8 }} 
                          name="Expected Headcount"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              {selectedTab === 'overview' && (
                <TabsContent value="comparison">
                  {/* Process Comparison Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <BarChart2 className="h-4 w-4 mr-2" />
                        Process Comparison
                      </CardTitle>
                      <CardDescription>Headcount comparison across processes</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={formatProcessComparisonData(analyticsData as ProcessHeadcountAnalytics[])}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="active" fill="#8884d8" name="Active" />
                          <Bar dataKey="trainee" fill="#82ca9d" name="Trainee" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </Tabs>
    </div>
  );
}