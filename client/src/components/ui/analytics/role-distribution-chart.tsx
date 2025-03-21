import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface RoleDistributionChartProps {
  title?: string;
  filters?: Record<string, any>;
  chartType?: 'pie' | 'bar';
  colorScheme?: string;
  showLegend?: boolean;
}

type RoleData = {
  role: string;
  count: number;
};

const COLORS = {
  default: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FECBA6'],
  blues: ['#0088FE', '#2D9CDB', '#56CCF2', '#81E3F9', '#B4F1F9', '#E1FCFD'],
  greens: ['#00C49F', '#27AE60', '#6FCF97', '#A1E3CB', '#D2F2E3'],
  oranges: ['#FF8042', '#F2994A', '#F2C94C', '#FFD572', '#FFEDB6'],
  purples: ['#8884D8', '#9B51E0', '#BB6BD9', '#D8B4FE', '#F2D9FF'],
  rainbow: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'],
};

const getRoleColors = (scheme: string = 'default') => {
  return COLORS[scheme as keyof typeof COLORS] || COLORS.default;
};

const RoleDistributionChart: React.FC<RoleDistributionChartProps> = ({
  title = 'Role Distribution',
  filters = {},
  chartType = 'pie',
  colorScheme = 'default',
  showLegend = true,
}) => {
  // Construct the query string from filters
  const queryString = filters ? 
    `?filters=${encodeURIComponent(JSON.stringify(filters))}` : '';

  // Fetch role distribution data
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/role-distribution', filters],
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading role data...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-red-500">
          Error loading role data
        </CardContent>
      </Card>
    );
  }

  const roleData: RoleData[] = data || [];
  const colors = getRoleColors(colorScheme);

  const renderChart = () => {
    if (chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={roleData}
              cx="50%"
              cy="50%"
              labelLine={true}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
              nameKey="role"
            >
              {roleData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            {showLegend && <Legend />}
            <Tooltip formatter={(value, name) => [value, 'Count']} />
          </PieChart>
        </ResponsiveContainer>
      );
    } else {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={roleData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="role" />
            <YAxis />
            <Tooltip formatter={(value, name) => [value, 'Count']} />
            {showLegend && <Legend />}
            <Bar dataKey="count" name="Count" fill={colors[0]}>
              {roleData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }
  };

  return (
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {roleData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-gray-500">
            No role data available
          </div>
        ) : (
          renderChart()
        )}
      </CardContent>
    </Card>
  );
};

export default RoleDistributionChart;