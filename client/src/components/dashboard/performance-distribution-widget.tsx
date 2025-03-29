import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Cell 
} from "recharts";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type ChartType = "bar" | "pie" | "line";

type PerformanceData = {
  excellent: number;
  good: number;
  average: number;
  belowAverage: number;
  poor: number;
  averageScore: number;
};

type PerformanceDistributionWidgetProps = {
  title: string;
  chartType: ChartType;
  batchIds?: number[];
  className?: string;
};

// Color constants for charts
const COLORS = {
  excellent: '#22c55e', // green-500
  good: '#3b82f6',     // blue-500
  average: '#f59e0b',  // amber-500
  belowAverage: '#fb923c', // orange-400
  poor: '#ef4444',     // red-500
  background: '#f3f4f6' // gray-100
};

export function PerformanceDistributionWidget({ 
  title, 
  chartType = "bar", 
  batchIds = [], 
  className 
}: PerformanceDistributionWidgetProps) {
  const { user } = useAuth();
  
  // State to store aggregated performance data across selected batches
  const [aggregatedData, setAggregatedData] = useState<PerformanceData>({
    excellent: 0,
    good: 0,
    average: 0,
    belowAverage: 0,
    poor: 0,
    averageScore: 0
  });
  
  // If no batch IDs are specified, fetch for all available batches
  const effectiveBatchIds = batchIds.length > 0 
    ? batchIds 
    : undefined; // undefined will make the backend return all batches
  
  // Fetch performance data for the selected batches
  const { data: performanceData, isLoading, error } = useQuery<PerformanceData>({
    queryKey: [
      `/api/organizations/${user?.organizationId}/performance/distribution`, 
      { batchIds: effectiveBatchIds }
    ],
    enabled: !!user?.organizationId,
    // For now, as the endpoint may not exist yet, set fake data for demonstration
    queryFn: async () => {
      // Simulated API call - would be replaced with real fetch once API is implemented
      const demoData: PerformanceData = {
        excellent: 15,
        good: 25,
        average: 40,
        belowAverage: 12,
        poor: 8,
        averageScore: 78.5
      };
      return demoData;
    }
  });
  
  // Process data when it's received or batch selection changes
  useEffect(() => {
    if (performanceData) {
      setAggregatedData(performanceData);
    }
  }, [performanceData, batchIds]);
  
  // Prepare data for recharts based on chart type
  const prepareChartData = () => {
    return [
      { name: 'Excellent', value: aggregatedData.excellent, color: COLORS.excellent },
      { name: 'Good', value: aggregatedData.good, color: COLORS.good },
      { name: 'Average', value: aggregatedData.average, color: COLORS.average },
      { name: 'Below Average', value: aggregatedData.belowAverage, color: COLORS.belowAverage },
      { name: 'Poor', value: aggregatedData.poor, color: COLORS.poor }
    ];
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
          <p className="text-destructive">Error loading performance data</p>
        </div>
      </div>
    );
  }
  
  return (
    <Card className={`${className}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="text-sm text-muted-foreground">
          Average Score: {aggregatedData.averageScore.toFixed(1)}%
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {chartType === "bar" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prepareChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="Count">
                  {prepareChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          
          {chartType === "pie" && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={prepareChartData()}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {prepareChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
          
          {chartType === "line" && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Line chart is not applicable for this data type</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}