import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  ZAxis,
  Tooltip, 
  Legend, 
  Cell,
  ResponsiveContainer
} from 'recharts';

interface ProcessHeatmapProps {
  title?: string;
  filters?: Record<string, any>;
  colorScheme?: string;
  showLegend?: boolean;
}

type ProcessData = {
  process: string;
  lineOfBusiness: string;
  count: number;
};

// Define color scales for the heatmap based on count values
const COLOR_RANGES = {
  default: ["#e4f1f5", "#aad5e3", "#7fbad1", "#54a0c0", "#297eaf", "#05629e", "#03488e"],
  blues: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#3182bd", "#08519c"],
  greens: ["#f7fcf5", "#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476", "#31a354", "#006d2c"],
  oranges: ["#fff5eb", "#fee6ce", "#fdd0a2", "#fdae6b", "#fd8d3c", "#e6550d", "#a63603"],
  purples: ["#fcfbfd", "#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#756bb1", "#54278f"],
  rainbow: ["#d8f3ff", "#b9f0ff", "#9be9ff", "#7dd6f0", "#5fc3e0", "#41b0cf", "#239ebf"],
};

const getColorScale = (scheme: string, min: number, max: number, value: number) => {
  const colors = COLOR_RANGES[scheme as keyof typeof COLOR_RANGES] || COLOR_RANGES.default;
  const range = max - min || 1;
  const normalizedValue = Math.min(Math.max((value - min) / range, 0), 0.999);
  const index = Math.floor(normalizedValue * colors.length);
  return colors[index];
};

const ProcessHeatmap: React.FC<ProcessHeatmapProps> = ({
  title = 'Process Distribution Heatmap',
  filters = {},
  colorScheme = 'default',
  showLegend = true
}) => {
  // Fetch process heatmap data
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/process-heatmap', filters],
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
          <span className="ml-2">Loading process data...</span>
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
          Error loading process data
        </CardContent>
      </Card>
    );
  }

  const processData: ProcessData[] = data || [];

  if (processData.length === 0) {
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-gray-500">
          No process data available
        </CardContent>
      </Card>
    );
  }

  // Prepare data for the heatmap
  const uniqueProcesses = Array.from(new Set(processData.map(item => item.process)));
  const uniqueLineOfBusinesses = Array.from(new Set(processData.map(item => item.lineOfBusiness)));
  
  // Create mapping for x and y axis positions
  const processToX: Record<string, number> = {};
  const lobToY: Record<string, number> = {};
  
  uniqueProcesses.forEach((process, index) => {
    processToX[process] = index;
  });
  
  uniqueLineOfBusinesses.forEach((lob, index) => {
    lobToY[lob] = index;
  });
  
  // Transform data for the heatmap
  const heatmapData = processData.map(item => ({
    x: processToX[item.process],
    y: lobToY[item.lineOfBusiness],
    process: item.process,
    lineOfBusiness: item.lineOfBusiness,
    count: item.count
  }));
  
  // Find min and max values for color scaling
  const counts = processData.map(item => item.count);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  return (
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart
            margin={{
              top: 20,
              right: 20,
              bottom: 60,
              left: 20,
            }}
          >
            <XAxis 
              type="number" 
              dataKey="x" 
              name="Process" 
              tickCount={uniqueProcesses.length}
              domain={[0, uniqueProcesses.length - 1]}
              tick={({ x, y, payload }) => (
                <text 
                  x={x} 
                  y={y + 10} 
                  textAnchor="middle" 
                  dominantBaseline="middle"
                  style={{ fontSize: '12px' }}
                >
                  {uniqueProcesses[payload.value]}
                </text>
              )}
              angle={-45}
              interval={0}
              height={60}
            />
            <YAxis 
              type="number" 
              dataKey="y" 
              name="Line of Business"
              tickCount={uniqueLineOfBusinesses.length}
              domain={[0, uniqueLineOfBusinesses.length - 1]}
              tick={({ x, y, payload }) => (
                <text 
                  x={x - 10} 
                  y={y} 
                  textAnchor="end" 
                  dominantBaseline="middle"
                  style={{ fontSize: '12px' }}
                >
                  {uniqueLineOfBusinesses[payload.value]}
                </text>
              )}
              width={120}
            />
            <ZAxis dataKey="count" range={[100, 500]} />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(value, name) => {
                if (name === 'count') return [value, 'Count'];
                return [value === 'x' ? 'Process' : 'Line of Business', name];
              }}
              labelFormatter={(_, data) => {
                if (!data || data.length === 0) return '';
                const item = data[0].payload;
                return `${item.process} / ${item.lineOfBusiness}`;
              }}
            />
            {showLegend && <Legend />}
            <Scatter 
              name="Process Heatmap" 
              data={heatmapData}
            >
              {heatmapData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getColorScale(colorScheme, minCount, maxCount, entry.count)} 
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div className="flex justify-center items-center mt-4">
          <div className="flex items-center">
            <div className="text-xs mr-2">Low</div>
            <div className="flex h-2">
              {COLOR_RANGES[colorScheme as keyof typeof COLOR_RANGES || 'default'].map((color, i) => (
                <div 
                  key={i} 
                  style={{ backgroundColor: color, width: '20px', height: '10px' }} 
                />
              ))}
            </div>
            <div className="text-xs ml-2">High</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProcessHeatmap;