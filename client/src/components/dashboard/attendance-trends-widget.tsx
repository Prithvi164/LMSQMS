import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { format, subDays } from "date-fns";
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type ChartType = "bar" | "pie" | "line";

type DailyAttendance = {
  date: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: number;
};

type AttendanceTrendsData = {
  dailyAttendance: DailyAttendance[];
  totalDays: number;
  averageAttendanceRate: number;
};

type AttendanceTrendsWidgetProps = {
  title: string;
  chartType: ChartType;
  batchIds?: number[];
  className?: string;
};

// Color constants for charts
const COLORS = {
  present: '#22c55e', // green-500
  absent: '#ef4444',  // red-500
  late: '#eab308',    // yellow-500
  leave: '#3b82f6',   // blue-500
  rate: '#8b5cf6',    // violet-500
  background: '#f3f4f6' // gray-100
};

export function AttendanceTrendsWidget({ 
  title, 
  chartType = "line", 
  batchIds = [], 
  className 
}: AttendanceTrendsWidgetProps) {
  const { user } = useAuth();
  
  // State to store aggregated attendance data across selected batches
  const [aggregatedData, setAggregatedData] = useState<AttendanceTrendsData>({
    dailyAttendance: [],
    totalDays: 0,
    averageAttendanceRate: 0
  });
  
  // If no batch IDs are specified, fetch for all available batches
  const effectiveBatchIds = batchIds.length > 0 
    ? batchIds 
    : undefined; // undefined will make the backend return all batches
  
  // Fetch attendance data for the selected batches
  const { data: trendsData, isLoading, error } = useQuery<AttendanceTrendsData>({
    queryKey: [
      `/api/organizations/${user?.organizationId}/attendance/trends`, 
      { batchIds: effectiveBatchIds }
    ],
    enabled: !!user?.organizationId,
    // For now, as the endpoint may not exist yet, set fake data for demonstration
    queryFn: async () => {
      // Simulated API call - would be replaced with real fetch once API is implemented
      const today = new Date();
      const demoData: AttendanceTrendsData = {
        dailyAttendance: Array.from({ length: 14 }, (_, i) => {
          const day = subDays(today, 13 - i);
          const attendanceRate = 70 + Math.random() * 25; // 70-95%
          const totalTrainees = 30 + Math.floor(Math.random() * 10); // 30-40 trainees
          const presentCount = Math.floor(totalTrainees * (attendanceRate / 100));
          const lateCount = Math.floor((totalTrainees - presentCount) * 0.4);
          const leaveCount = Math.floor((totalTrainees - presentCount) * 0.3);
          const absentCount = totalTrainees - presentCount - lateCount - leaveCount;
          
          return {
            date: format(day, 'yyyy-MM-dd'),
            presentCount,
            absentCount,
            lateCount,
            leaveCount,
            attendanceRate
          };
        }),
        totalDays: 14,
        averageAttendanceRate: 85
      };
      return demoData;
    }
  });
  
  // Process data when it's received or batch selection changes
  useEffect(() => {
    if (trendsData) {
      setAggregatedData(trendsData);
    }
  }, [trendsData, batchIds]);
  
  // Prepare data for recharts
  const prepareChartData = () => {
    return aggregatedData.dailyAttendance.map(day => ({
      date: format(new Date(day.date), 'MMM d'),
      present: day.presentCount,
      absent: day.absentCount,
      late: day.lateCount,
      leave: day.leaveCount,
      rate: Math.round(day.attendanceRate)
    }));
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className={`p-6 rounded-lg border shadow-sm ${className}`}>
        <h3 className="text-lg font-medium mb-2">{title}</h3>
        <div className="h-[250px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className={`p-6 rounded-lg border shadow-sm ${className}`}>
        <h3 className="text-lg font-medium mb-2">{title}</h3>
        <div className="h-[250px] flex items-center justify-center">
          <p className="text-destructive">Error loading attendance trends</p>
        </div>
      </div>
    );
  }
  
  return (
    <Card className={`${className}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="text-sm text-muted-foreground">
          Average Attendance Rate: {aggregatedData.averageAttendanceRate.toFixed(1)}%
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {chartType === "line" && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={prepareChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="present" name="Present" stroke={COLORS.present} strokeWidth={2} />
                <Line type="monotone" dataKey="absent" name="Absent" stroke={COLORS.absent} strokeWidth={2} />
                <Line type="monotone" dataKey="late" name="Late" stroke={COLORS.late} strokeWidth={2} />
                <Line type="monotone" dataKey="leave" name="Leave" stroke={COLORS.leave} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
          
          {chartType === "bar" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prepareChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" name="Present" fill={COLORS.present} />
                <Bar dataKey="absent" name="Absent" fill={COLORS.absent} />
                <Bar dataKey="late" name="Late" fill={COLORS.late} />
                <Bar dataKey="leave" name="Leave" fill={COLORS.leave} />
              </BarChart>
            </ResponsiveContainer>
          )}
          
          {chartType === "pie" && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Pie chart is not applicable for time-series data</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}