import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttendanceBreakdown } from '@/components/batch-management/attendance-breakdown';
import { AttendanceFilterPanel } from '@/components/dashboard/attendance-filter-panel';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { 
  CalendarClock,
  Calendar,
  BarChart4,
  UsersRound,
  Save,
  Check
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { WidgetConfig } from './dashboard-configuration.ts';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

// Props for the widget component
interface EnhancedAttendanceBreakdownWidgetProps {
  config?: WidgetConfig;
  className?: string;
  chartOptions?: {
    height?: number;
    width?: string | number;
    responsive?: boolean;
    maintainAspectRatio?: boolean;
    [key: string]: any;
  };
}

// Valid view types
type ViewType = 'overall' | 'daily' | 'phase' | 'trainee';

export function EnhancedAttendanceBreakdownWidget({ 
  config,
  className,
  chartOptions
}: EnhancedAttendanceBreakdownWidgetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Get default view from config if available
  const defaultView = config?.defaultOptions?.view || 'overall';
  
  // State for current view and filters
  const [currentView, setCurrentView] = useState<ViewType>(defaultView as ViewType);
  const [filters, setFilters] = useState<any>({});
  const [saveButtonText, setSaveButtonText] = useState('Save Preferences');
  const [saveButtonIcon, setSaveButtonIcon] = useState(() => <Save className="mr-2 h-4 w-4" />);
  
  // Type definition for attendance data
  type BatchAttendanceOverview = {
    totalDays: number;
    completedDays: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    leaveCount: number;
    attendanceRate: number;
    dailyAttendance: any[];
    phaseAttendance: any[];
    traineeAttendance: any[];
  };
    
  // Query for attendance data based on filters
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery<BatchAttendanceOverview>({
    queryKey: ['/api/attendance/breakdown', filters],
    enabled: !!user && Object.keys(filters).length > 0,
  });
  
  // Mutation for saving user preferences
  const { mutate: savePreferences, isPending: isSaving } = useMutation({
    mutationFn: async (preferences: any) => {
      return fetch('/api/user/attendance-filter-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to save preferences');
        return res.json();
      });
    },
    onSuccess: () => {
      // Show success message
      toast({
        title: 'Preferences Saved',
        description: 'Your filter preferences have been saved successfully.',
        variant: 'default',
      });
      
      // Update button text and icon temporarily to show success
      setSaveButtonText('Saved!');
      setSaveButtonIcon(() => <Check className="mr-2 h-4 w-4" />);
      
      // Revert button text after 2 seconds
      setTimeout(() => {
        setSaveButtonText('Save Preferences');
        setSaveButtonIcon(() => <Save className="mr-2 h-4 w-4" />);
      }, 2000);
      
      // Invalidate the preferences query to reload saved preferences
      queryClient.invalidateQueries({ queryKey: ['/api/user/attendance-filter-preferences'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to save preferences: ' + error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Handler for filter changes from the AttendanceFilterPanel
  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
  };
  
  // Handler for saving user preferences
  const handleSavePreferences = () => {
    if (!user) return;
    
    // Save both the filter preferences and current view
    savePreferences({
      ...filters,
      view: currentView
    });
  };
  
  // Icons for different view tabs
  const viewIcons = {
    overall: <BarChart4 className="h-4 w-4 mr-1" />,
    daily: <Calendar className="h-4 w-4 mr-1" />,
    phase: <CalendarClock className="h-4 w-4 mr-1" />,
    trainee: <UsersRound className="h-4 w-4 mr-1" />
  };
  
  // Helper function to render loading skeleton 
  const renderSkeleton = () => (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-40" />
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col w-full ${className}`}>
      {/* Filter panel at the top */}
      <AttendanceFilterPanel 
        onFilterChange={handleFilterChange}
        className="mb-4" 
      />
      
      <div className="flex justify-between items-center mb-4">
        {/* View tabs on the left */}
        <Tabs 
          value={currentView} 
          onValueChange={(value) => setCurrentView(value as ViewType)}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="overall">
              {viewIcons.overall}
              <span className="hidden sm:inline-block">Overall</span>
            </TabsTrigger>
            <TabsTrigger value="daily">
              {viewIcons.daily}
              <span className="hidden sm:inline-block">Daily</span>
            </TabsTrigger>
            <TabsTrigger value="phase">
              {viewIcons.phase}
              <span className="hidden sm:inline-block">Phase</span>
            </TabsTrigger>
            <TabsTrigger value="trainee">
              {viewIcons.trainee}
              <span className="hidden sm:inline-block">Trainees</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Save preferences button on the right */}
        <Button 
          size="sm" 
          onClick={handleSavePreferences}
          disabled={isSaving || Object.keys(filters).length === 0}
          className="ml-2"
        >
          {isSaving ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : saveButtonIcon}
          {saveButtonText}
        </Button>
      </div>
      
      {/* Loading state */}
      {attendanceLoading && (
        <Card>
          <CardContent className="p-0">
            {renderSkeleton()}
          </CardContent>
        </Card>
      )}
      
      {/* No data state */}
      {!attendanceLoading && (!attendanceData || Object.keys(filters).length === 0) && (
        <Card className="border-dashed">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center text-muted-foreground">
            <div className="mb-4">
              <BarChart4 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <h3 className="text-lg font-medium">No attendance data to display</h3>
            </div>
            <p className="max-w-md">
              {Object.keys(filters).length === 0 
                ? "Select filters above to view attendance data for specific processes, batches, or time periods."
                : "No attendance data found for the selected filters. Try selecting different filters or date ranges."}
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Attendance data display */}
      {!attendanceLoading && attendanceData && (
        <div style={{
          height: chartOptions?.height || config?.chartOptions?.height || 400,
          width: chartOptions?.width || config?.chartOptions?.width || '100%',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <AttendanceBreakdown 
            attendanceData={attendanceData} 
            initialView={currentView}
            className="border rounded-lg overflow-hidden shadow-sm"
            chartOptions={{
              responsive: chartOptions?.responsive !== false,
              maintainAspectRatio: chartOptions?.maintainAspectRatio !== false,
              ...chartOptions
            }}
          />
        </div>
      )}
    </div>
  );
}