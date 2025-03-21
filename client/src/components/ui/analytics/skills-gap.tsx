import React, { useState } from 'react';
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
  ReferenceLine,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SkillsGapProps {
  title?: string;
  filters?: Record<string, any>;
  chartType?: 'bar' | 'radar';
  colorScheme?: string;
  showLegend?: boolean;
}

type SkillData = {
  process: string;
  skill: string;
  required: number;
  available: number;
};

const COLORS = {
  default: { required: '#0088FE', available: '#00C49F', gap: '#FF8042' },
  blues: { required: '#0088FE', available: '#2D9CDB', gap: '#56CCF2' },
  greens: { required: '#00C49F', available: '#27AE60', gap: '#6FCF97' },
  oranges: { required: '#FF8042', available: '#F2994A', gap: '#F2C94C' },
  purples: { required: '#8884D8', available: '#9B51E0', gap: '#BB6BD9' },
  rainbow: { required: '#FF6384', available: '#36A2EB', gap: '#FFCE56' },
};

const getColors = (scheme: string = 'default') => {
  return COLORS[scheme as keyof typeof COLORS] || COLORS.default;
};

const SkillsGap: React.FC<SkillsGapProps> = ({
  title = 'Skills Gap Analysis',
  filters = {},
  chartType = 'bar',
  colorScheme = 'default',
  showLegend = true,
}) => {
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null);

  // Fetch skills gap data
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/skills-gap', filters],
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
          <span className="ml-2">Loading skills data...</span>
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
          Error loading skills data
        </CardContent>
      </Card>
    );
  }

  const skillsData: SkillData[] = data || [];
  const colors = getColors(colorScheme);

  if (skillsData.length === 0) {
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-gray-500">
          No skills gap data available
        </CardContent>
      </Card>
    );
  }

  // Get processes list for filter
  const processes = Array.from(new Set(skillsData.map(item => item.process)));

  // Filter data by selected process
  const filteredData = selectedProcess
    ? skillsData.filter(item => item.process === selectedProcess)
    : skillsData;

  // Calculate gap for display
  const displayData = filteredData.map(item => ({
    skill: item.skill,
    process: item.process,
    required: item.required,
    available: item.available,
    gap: item.required - item.available
  }));

  const renderBarChart = () => {
    return (
      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={displayData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 60,
          }}
          barGap={0}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="skill" 
            angle={-45} 
            textAnchor="end" 
            interval={0} 
            height={60}
          />
          <YAxis />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'required') return [value, 'Required Level'];
              if (name === 'available') return [value, 'Available Level'];
              if (name === 'gap') return [value, 'Gap'];
              return [value, name];
            }}
          />
          {showLegend && <Legend />}
          <Bar dataKey="required" name="Required" fill={colors.required} />
          <Bar dataKey="available" name="Available" fill={colors.available} />
          <Bar dataKey="gap" name="Gap" fill={colors.gap}>
            {displayData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.gap > 0 ? colors.gap : '#4caf50'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderRadarChart = () => {
    // Radar chart works best with fewer data points, so we'll show just the top gaps if there are too many
    const radarData = displayData
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
      .slice(0, 8);

    return (
      <ResponsiveContainer width="100%" height={350}>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="skill" />
          <PolarRadiusAxis />
          <Radar
            name="Required"
            dataKey="required"
            stroke={colors.required}
            fill={colors.required}
            fillOpacity={0.3}
          />
          <Radar
            name="Available"
            dataKey="available"
            stroke={colors.available}
            fill={colors.available}
            fillOpacity={0.3}
          />
          <Tooltip />
          {showLegend && <Legend />}
        </RadarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card className="w-full h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>{title}</CardTitle>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Process:</span>
          <Select
            value={selectedProcess || ''}
            onValueChange={(value) => setSelectedProcess(value || null)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Processes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Processes</SelectItem>
              {processes.map((process) => (
                <SelectItem key={process} value={process}>
                  {process}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {chartType === 'radar' ? renderRadarChart() : renderBarChart()}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
            <div className="text-sm font-medium mb-1">Avg. Required Level</div>
            <div className="text-2xl font-bold">
              {(displayData.reduce((sum, item) => sum + item.required, 0) / displayData.length).toFixed(1)}
            </div>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
            <div className="text-sm font-medium mb-1">Avg. Available Level</div>
            <div className="text-2xl font-bold">
              {(displayData.reduce((sum, item) => sum + item.available, 0) / displayData.length).toFixed(1)}
            </div>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
            <div className="text-sm font-medium mb-1">Avg. Gap</div>
            <div className="text-2xl font-bold">
              {(displayData.reduce((sum, item) => sum + item.gap, 0) / displayData.length).toFixed(1)}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">Top Skills Gaps</h3>
          <div className="space-y-2">
            {displayData
              .sort((a, b) => b.gap - a.gap)
              .slice(0, 3)
              .map((item, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-1/3 pr-2">{item.skill}</div>
                  <div className="w-2/3 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${Math.min(100, (item.available / item.required) * 100)}%`,
                        backgroundColor: colors.available
                      }}
                    ></div>
                  </div>
                  <div className="ml-2 text-sm">{item.available}/{item.required}</div>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SkillsGap;