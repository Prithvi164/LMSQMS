import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { formatIST } from '@/lib/date-utils';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Sector } from 'recharts';
import AttendanceFilterPanel from './attendance-filter-panel';
import AttendanceBreakdown from '../batch-management/attendance-breakdown';
import { useUser } from '@/hooks/use-auth';

// Define types
type BreakdownViewType = 'overall' | 'daily' | 'phase' | 'trainee';
type DateRange = { from: Date; to: Date } | undefined;

interface EnhancedAttendanceBreakdownWidgetProps {
  title?: string;
  description?: string;
  defaultTab?: string;
}

export function EnhancedAttendanceBreakdownWidget({
  title = "Attendance Breakdown",
  description = "Detailed attendance analysis with multiple views",
  defaultTab = "view"
}: EnhancedAttendanceBreakdownWidgetProps) {
  const user = useUser();

  // Define the filter state
  const [filters, setFilters] = useState<{
    viewType: BreakdownViewType;
    processIds: number[];
    batchIds: number[];
    locationIds: number[];
    lineOfBusinessIds: number[];
    dateRange: DateRange;
  }>({
    viewType: 'overall',
    processIds: [],
    batchIds: [],
    locationIds: [],
    lineOfBusinessIds: [],
    dateRange: undefined
  });

  // Convert date range to string format for API
  const getDateRangeParams = () => {
    if (!filters.dateRange) return {};
    return {
      from: formatIST(filters.dateRange.from, 'yyyy-MM-dd'),
      to: formatIST(filters.dateRange.to, 'yyyy-MM-dd')
    };
  };

  // Build the query parameters based on selected filters
  const buildQueryParams = () => {
    const params: Record<string, string> = {};
    
    if (filters.processIds.length > 0) {
      params.processes = filters.processIds.join(',');
    }
    
    if (filters.batchIds.length > 0) {
      params.batches = filters.batchIds.join(',');
    }
    
    if (filters.locationIds.length > 0) {
      params.locations = filters.locationIds.join(',');
    }
    
    if (filters.lineOfBusinessIds.length > 0) {
      params.lineOfBusinesses = filters.lineOfBusinessIds.join(',');
    }
    
    if (filters.dateRange) {
      const { from, to } = getDateRangeParams();
      params.from = from;
      params.to = to;
    }
    
    return params;
  };

  // Handle filter changes from the filter panel
  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  // Query for attendance data based on filters and view type
  const {
    data: attendanceData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['/api/attendance/breakdown', filters],
    queryFn: async () => {
      const params = buildQueryParams();
      const queryString = new URLSearchParams(params).toString();
      const endpoint = `/api/attendance/breakdown/${filters.viewType}${queryString ? `?${queryString}` : ''}`;
      
      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to fetch attendance data');
        }
        return await response.json();
      } catch (error) {
        console.error('Error fetching attendance data:', error);
        throw error;
      }
    },
    enabled: user !== null, // Only run the query if the user is logged in
    // The above endpoint doesn't exist yet, so this will error in development
    // This is a placeholder for when the backend is implemented
    // Remove this query or mock it if needed for now
    onError: (error: any) => {
      // Silently handle error - we'll show placeholder until backend is ready
      console.log('Note: Attendance breakdown API endpoint not implemented yet');
    }
  });

  // Function to render the appropriate attendance view based on the filter selection
  const renderAttendanceView = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col space-y-3">
          <Skeleton className="h-[240px] w-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-[80%]" />
          </div>
        </div>
      );
    }

    if (error) {
      // For development without the backend, render a placeholder
      return (
        <div className="p-4 border border-muted rounded-md">
          <p className="text-center font-medium">
            Attendance data will appear here based on your filter selections.
          </p>
          <p className="text-center text-muted-foreground mt-2">
            View Type: {filters.viewType}
          </p>
          <p className="text-center text-muted-foreground mt-1">
            Selected Filters: {Object.entries(filters)
              .filter(([key, value]) => {
                if (key === 'viewType') return false;
                if (Array.isArray(value) && value.length > 0) return true;
                if (key === 'dateRange' && value) return true;
                return false;
              })
              .map(([key, value]) => {
                if (key === 'dateRange' && value) {
                  return `Date Range: ${formatIST(value.from, 'MMM dd')} - ${formatIST(value.to, 'MMM dd')}`;
                }
                return `${key.replace('Ids', '')}: ${Array.isArray(value) ? value.length : 0}`;
              })
              .join(', ')}
          </p>
          
          {/* Fallback to show the batch-specific component when a batch is selected */}
          {filters.batchIds.length === 1 && (
            <div className="mt-4">
              <AttendanceBreakdown 
                batchId={filters.batchIds[0]} 
              />
            </div>
          )}
        </div>
      );
    }

    // When we have data, render the appropriate view based on the viewType
    switch (filters.viewType) {
      case 'overall':
        return (
          <div className="mt-4">
            {/* Overall attendance summary with pie chart */}
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={attendanceData?.summary}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label
                >
                  {attendanceData?.summary.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );

      case 'daily':
        return (
          <div className="mt-4">
            {/* Daily attendance chart */}
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceData?.daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" fill="#8884d8" name="Present" />
                <Bar dataKey="absent" fill="#82ca9d" name="Absent" />
                <Bar dataKey="late" fill="#ffc658" name="Late" />
                <Bar dataKey="leave" fill="#ff8042" name="Leave" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'phase':
        return (
          <div className="mt-4">
            {/* Phase-wise attendance chart */}
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceData?.phases}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="phase" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="attendanceRate" fill="#8884d8" name="Attendance %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'trainee':
        return (
          <div className="mt-4">
            {/* Trainee-wise attendance breakdown */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {attendanceData?.trainees.map((trainee: any) => (
                <div key={trainee.id} className="flex justify-between items-center p-2 border-b">
                  <span className="font-medium">{trainee.name}</span>
                  <div className="flex space-x-4">
                    <span className="text-sm">Present: {trainee.presentCount}</span>
                    <span className="text-sm">Absent: {trainee.absentCount}</span>
                    <span className="text-sm">Rate: {trainee.attendanceRate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="view">View</TabsTrigger>
            <TabsTrigger value="filter">Filters</TabsTrigger>
          </TabsList>
          
          <TabsContent value="filter">
            <AttendanceFilterPanel onFilterChange={handleFilterChange} />
          </TabsContent>
          
          <TabsContent value="view">
            {/* Show active filters as badges */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-1">Active Filters:</h4>
              <div className="flex flex-wrap gap-2">
                <div className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-md">
                  View: {filters.viewType}
                </div>
                
                {filters.processIds.length > 0 && (
                  <div className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-md">
                    Processes: {filters.processIds.length}
                  </div>
                )}
                
                {filters.batchIds.length > 0 && (
                  <div className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-md">
                    Batches: {filters.batchIds.length}
                  </div>
                )}
                
                {filters.locationIds.length > 0 && (
                  <div className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-md">
                    Locations: {filters.locationIds.length}
                  </div>
                )}
                
                {filters.lineOfBusinessIds.length > 0 && (
                  <div className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-md">
                    Line of Business: {filters.lineOfBusinessIds.length}
                  </div>
                )}
                
                {filters.dateRange && (
                  <div className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-md">
                    Date: {formatIST(filters.dateRange.from, 'MMM dd')} - {formatIST(filters.dateRange.to, 'MMM dd')}
                  </div>
                )}
              </div>
            </div>

            {renderAttendanceView()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}