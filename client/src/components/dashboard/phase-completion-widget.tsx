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

type PhaseData = {
  planned: number;
  induction: number;
  training: number;
  certification: number;
  ojt: number;
  ojt_certification: number;
  completed: number;
  totalBatches: number;
};

type PhaseCompletionWidgetProps = {
  title: string;
  chartType: ChartType;
  batchIds?: number[];
  className?: string;
};

// Color constants for charts
const COLORS = {
  planned: '#94a3b8',         // slate-400
  induction: '#c084fc',       // purple-400
  training: '#38bdf8',        // sky-400
  certification: '#2dd4bf',   // teal-400
  ojt: '#fb923c',            // orange-400
  ojt_certification: '#f87171', // red-400
  completed: '#4ade80',       // green-400
  background: '#f3f4f6'       // gray-100
};

export function PhaseCompletionWidget({ 
  title, 
  chartType = "bar", 
  batchIds = [], 
  className 
}: PhaseCompletionWidgetProps) {
  const { user } = useAuth();
  
  // State to store aggregated phase data across selected batches
  const [aggregatedData, setAggregatedData] = useState<PhaseData>({
    planned: 0,
    induction: 0,
    training: 0,
    certification: 0,
    ojt: 0,
    ojt_certification: 0,
    completed: 0,
    totalBatches: 0
  });
  
  // If no batch IDs are specified, fetch for all available batches
  const effectiveBatchIds = batchIds.length > 0 
    ? batchIds 
    : undefined; // undefined will make the backend return all batches
  
  // Fetch phase data for the selected batches
  const { data: phaseData, isLoading, error } = useQuery<PhaseData>({
    queryKey: [
      `/api/organizations/${user?.organizationId}/batches/phases`, 
      { batchIds: effectiveBatchIds }
    ],
    enabled: !!user?.organizationId,
    // For now, as the endpoint may not exist yet, set fake data for demonstration
    queryFn: async () => {
      // Simulated API call - would be replaced with real fetch once API is implemented
      const demoData: PhaseData = {
        planned: 3,
        induction: 2,
        training: 5,
        certification: 4,
        ojt: 7,
        ojt_certification: 3,
        completed: 8,
        totalBatches: 32
      };
      return demoData;
    }
  });
  
  // Process data when it's received or batch selection changes
  useEffect(() => {
    if (phaseData) {
      setAggregatedData(phaseData);
    }
  }, [phaseData, batchIds]);
  
  // Format phase names for display
  const formatPhaseName = (phase: string): string => {
    switch (phase) {
      case 'planned': return 'Planned';
      case 'induction': return 'Induction';
      case 'training': return 'Training';
      case 'certification': return 'Certification';
      case 'ojt': return 'OJT';
      case 'ojt_certification': return 'OJT Certification';
      case 'completed': return 'Completed';
      default: return phase;
    }
  };
  
  // Prepare data for recharts based on chart type
  const prepareChartData = () => {
    return [
      { name: formatPhaseName('planned'), value: aggregatedData.planned, color: COLORS.planned },
      { name: formatPhaseName('induction'), value: aggregatedData.induction, color: COLORS.induction },
      { name: formatPhaseName('training'), value: aggregatedData.training, color: COLORS.training },
      { name: formatPhaseName('certification'), value: aggregatedData.certification, color: COLORS.certification },
      { name: formatPhaseName('ojt'), value: aggregatedData.ojt, color: COLORS.ojt },
      { name: formatPhaseName('ojt_certification'), value: aggregatedData.ojt_certification, color: COLORS.ojt_certification },
      { name: formatPhaseName('completed'), value: aggregatedData.completed, color: COLORS.completed }
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
          <p className="text-destructive">Error loading phase data</p>
        </div>
      </div>
    );
  }
  
  return (
    <Card className={`${className}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="text-sm text-muted-foreground">
          Total Batches: {aggregatedData.totalBatches}
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
                <Bar dataKey="value" name="Batches">
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