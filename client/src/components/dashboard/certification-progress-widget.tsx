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
  Legend,
  RadialBarChart,
  RadialBar
} from "recharts";
import { Progress } from "@/components/ui/progress";

type ChartType = "bar" | "pie" | "line";

type CertificationProgressWidgetProps = {
  title: string;
  chartType: ChartType;
  batchIds?: number[];
  className?: string;
};

// Color constants for charts
const COLORS = ['#10b981', '#0ea5e9', '#6366f1', '#f59e0b', '#ef4444'];

export function CertificationProgressWidget({ 
  title, 
  chartType, 
  batchIds, 
  className 
}: CertificationProgressWidgetProps) {
  const { user } = useAuth();
  
  // Mock data for now - in a real implementation, this would fetch from API
  const data = [
    { name: 'Foundation', completed: 100, total: 100 },
    { name: 'Intermediate', completed: 75, total: 100 },
    { name: 'Advanced', completed: 45, total: 100 },
    { name: 'Expert', completed: 10, total: 100 }
  ];
  
  // Pie chart data
  const pieData = [
    { name: 'Certified', value: 35 },
    { name: 'In Progress', value: 45 },
    { name: 'Not Started', value: 20 }
  ];
  
  // Line chart data showing certification progress over time
  const lineData = [
    { month: 'Jan', certified: 10, inProgress: 40, notStarted: 50 },
    { month: 'Feb', certified: 20, inProgress: 45, notStarted: 35 },
    { month: 'Mar', certified: 30, inProgress: 45, notStarted: 25 },
    { month: 'Apr', certified: 35, inProgress: 45, notStarted: 20 }
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
              <Legend />
              <Bar dataKey="completed" name="Completion %" fill="#10b981" />
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
                labelLine={true}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
        
      case "line":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={lineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="certified" name="Certified" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="inProgress" name="In Progress" stroke="#0ea5e9" strokeWidth={2} />
              <Line type="monotone" dataKey="notStarted" name="Not Started" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );
        
      default:
        // Fallback to a simple progress view
        return (
          <div className="space-y-6 py-4">
            {data.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-sm text-muted-foreground">{item.completed}%</span>
                </div>
                <Progress value={item.completed} className="h-2" />
              </div>
            ))}
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