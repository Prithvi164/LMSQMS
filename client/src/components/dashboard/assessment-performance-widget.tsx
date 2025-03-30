import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";

type ChartType = "bar" | "pie" | "line";

type AssessmentPerformanceWidgetProps = {
  title: string;
  chartType: ChartType;
  batchIds?: number[];
  className?: string;
};

// Color constants for charts
const COLORS = ['#4f46e5', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef'];
const LINE_COLORS = ['#4f46e5', '#06b6d4', '#10b981'];

export function AssessmentPerformanceWidget({ 
  title, 
  chartType, 
  batchIds, 
  className 
}: AssessmentPerformanceWidgetProps) {
  const { user } = useAuth();
  
  // Mock data for now - in a real implementation, this would fetch from API
  const data = [
    { name: 'Customer Service', score: 85 },
    { name: 'Product Knowledge', score: 78 },
    { name: 'Systems & Tools', score: 92 },
    { name: 'Communication', score: 88 },
    { name: 'Problem Solving', score: 76 }
  ];
  
  // Line chart data showing progress over time
  const lineData = [
    { week: 'Week 1', average: 65, highest: 78, lowest: 52 },
    { week: 'Week 2', average: 72, highest: 85, lowest: 58 },
    { week: 'Week 3', average: 78, highest: 90, lowest: 65 },
    { week: 'Week 4', average: 83, highest: 95, lowest: 70 },
    { week: 'Week 5', average: 85, highest: 98, lowest: 73 }
  ];
  
  // Pie chart data showing distribution of scores
  const pieData = [
    { name: 'Excellent (90-100%)', value: 35 },
    { name: 'Good (80-89%)', value: 40 },
    { name: 'Average (70-79%)', value: 15 },
    { name: 'Below Average (60-69%)', value: 8 },
    { name: 'Poor (<60%)', value: 2 }
  ];
  
  const renderChart = () => {
    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="score" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        );
        
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value}%`, 'Distribution']} />
            </PieChart>
          </ResponsiveContainer>
        );
        
      case "line":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={lineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="average" stroke={LINE_COLORS[0]} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="highest" stroke={LINE_COLORS[1]} />
              <Line type="monotone" dataKey="lowest" stroke={LINE_COLORS[2]} />
            </LineChart>
          </ResponsiveContainer>
        );
        
      default:
        return (
          <div className="h-[250px] flex items-center justify-center bg-muted rounded">
            <span className="text-muted-foreground">No data available</span>
          </div>
        );
    }
  };
  
  return (
    <div className={className}>
      {renderChart()}
    </div>
  );
}