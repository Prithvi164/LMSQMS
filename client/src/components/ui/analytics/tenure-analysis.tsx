import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Line,
  LineChart,
  ComposedChart
} from 'recharts';

interface TenureAnalysisProps {
  title?: string;
  filters?: Record<string, any>;
  chartType?: 'bar' | 'line' | 'composed';
  colorScheme?: string;
  showLegend?: boolean;
}

type TenureData = {
  range: string;
  count: number;
  avg: number;
};

const COLORS = {
  default: {
    primary: '#0088FE',
    secondary: '#00C49F'
  },
  blues: {
    primary: '#0088FE',
    secondary: '#2D9CDB'
  },
  greens: {
    primary: '#00C49F',
    secondary: '#27AE60'
  },
  oranges: {
    primary: '#FF8042',
    secondary: '#F2994A'
  },
  purples: {
    primary: '#8884D8',
    secondary: '#9B51E0'
  },
  rainbow: {
    primary: '#FF6384',
    secondary: '#36A2EB'
  }
};

const getColors = (scheme: string = 'default') => {
  return COLORS[scheme as keyof typeof COLORS] || COLORS.default;
};

const TenureAnalysis: React.FC<TenureAnalysisProps> = ({
  title = 'Tenure Analysis',
  filters = {},
  chartType = 'composed',
  colorScheme = 'default',
  showLegend = true,
}) => {
  // Fetch tenure analysis data
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/tenure-analysis', filters],
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
          <span className="ml-2">Loading tenure data...</span>
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
          Error loading tenure data
        </CardContent>
      </Card>
    );
  }

  const tenureData: TenureData[] = data || [];
  const colors = getColors(colorScheme);

  if (tenureData.length === 0) {
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-gray-500">
          No tenure data available
        </CardContent>
      </Card>
    );
  }

  const renderChart = () => {
    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={tenureData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis />
            <Tooltip />
            {showLegend && <Legend />}
            <Bar dataKey="count" name="Employee Count" fill={colors.primary} />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={tenureData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            {showLegend && <Legend />}
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="count" 
              name="Employee Count" 
              stroke={colors.primary} 
              activeDot={{ r: 8 }} 
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="avg" 
              name="Average Tenure (months)" 
              stroke={colors.secondary} 
            />
          </LineChart>
        </ResponsiveContainer>
      );
    } else {
      // Composed chart (default)
      return (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={tenureData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            {showLegend && <Legend />}
            <Bar 
              yAxisId="left"
              dataKey="count" 
              name="Employee Count" 
              fill={colors.primary} 
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="avg" 
              name="Average Tenure (months)" 
              stroke={colors.secondary} 
            />
          </ComposedChart>
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
        {renderChart()}
      </CardContent>
    </Card>
  );
};

export default TenureAnalysis;