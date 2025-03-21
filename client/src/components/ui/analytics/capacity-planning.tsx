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
  Cell
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CapacityPlanningProps {
  title?: string;
  filters?: Record<string, any>;
  colorScheme?: string;
  showLegend?: boolean;
}

type CapacityData = {
  role: string;
  location: string;
  process: string;
  current: number;
  target: number;
};

const COLORS = {
  default: { current: '#0088FE', target: '#00C49F', gap: '#FF8042' },
  blues: { current: '#0088FE', target: '#2D9CDB', gap: '#56CCF2' },
  greens: { current: '#00C49F', target: '#27AE60', gap: '#6FCF97' },
  oranges: { current: '#FF8042', target: '#F2994A', gap: '#F2C94C' },
  purples: { current: '#8884D8', target: '#9B51E0', gap: '#BB6BD9' },
  rainbow: { current: '#FF6384', target: '#36A2EB', gap: '#FFCE56' },
};

const getColors = (scheme: string = 'default') => {
  return COLORS[scheme as keyof typeof COLORS] || COLORS.default;
};

const CapacityPlanning: React.FC<CapacityPlanningProps> = ({
  title = 'Capacity Planning',
  filters = {},
  colorScheme = 'default',
  showLegend = true,
}) => {
  const [view, setView] = useState<'role' | 'location' | 'process'>('role');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // Fetch capacity planning data
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/capacity-planning', filters],
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
          <span className="ml-2">Loading capacity data...</span>
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
          Error loading capacity data
        </CardContent>
      </Card>
    );
  }

  const capacityData: CapacityData[] = data || [];
  const colors = getColors(colorScheme);

  if (capacityData.length === 0) {
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-gray-500">
          No capacity data available
        </CardContent>
      </Card>
    );
  }

  // Process the data based on the selected view and filter
  const processData = () => {
    // First filter by selected item if any
    let filteredData = capacityData;
    if (selectedItem) {
      switch (view) {
        case 'role':
          filteredData = capacityData.filter(item => item.role === selectedItem);
          break;
        case 'location':
          filteredData = capacityData.filter(item => item.location === selectedItem);
          break;
        case 'process':
          filteredData = capacityData.filter(item => item.process === selectedItem);
          break;
      }
    }

    // Then aggregate data based on the view
    if (view === 'role') {
      const roleMap = new Map<string, { current: number, target: number }>();
      
      filteredData.forEach(item => {
        if (!roleMap.has(item.role)) {
          roleMap.set(item.role, { current: 0, target: 0 });
        }
        const entry = roleMap.get(item.role)!;
        entry.current += item.current;
        entry.target += item.target;
      });
      
      return Array.from(roleMap.entries()).map(([role, data]) => ({
        name: role,
        current: data.current,
        target: data.target,
        gap: data.target - data.current
      }));
    } else if (view === 'location') {
      const locationMap = new Map<string, { current: number, target: number }>();
      
      filteredData.forEach(item => {
        if (!locationMap.has(item.location)) {
          locationMap.set(item.location, { current: 0, target: 0 });
        }
        const entry = locationMap.get(item.location)!;
        entry.current += item.current;
        entry.target += item.target;
      });
      
      return Array.from(locationMap.entries()).map(([location, data]) => ({
        name: location,
        current: data.current,
        target: data.target,
        gap: data.target - data.current
      }));
    } else {
      const processMap = new Map<string, { current: number, target: number }>();
      
      filteredData.forEach(item => {
        if (!processMap.has(item.process)) {
          processMap.set(item.process, { current: 0, target: 0 });
        }
        const entry = processMap.get(item.process)!;
        entry.current += item.current;
        entry.target += item.target;
      });
      
      return Array.from(processMap.entries()).map(([process, data]) => ({
        name: process,
        current: data.current,
        target: data.target,
        gap: data.target - data.current
      }));
    }
  };

  const chartData = processData();

  // Get unique options for the filter dropdown
  const getFilterOptions = () => {
    const uniqueValues = new Set<string>();
    
    capacityData.forEach(item => {
      switch (view) {
        case 'role':
          uniqueValues.add(item.role);
          break;
        case 'location':
          uniqueValues.add(item.location);
          break;
        case 'process':
          uniqueValues.add(item.process);
          break;
      }
    });
    
    return Array.from(uniqueValues);
  };

  const filterOptions = getFilterOptions();

  return (
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <Tabs 
            defaultValue="role" 
            value={view} 
            onValueChange={(v) => {
              setView(v as 'role' | 'location' | 'process');
              setSelectedItem(null);  // Reset selection when view changes
            }}
          >
            <TabsList>
              <TabsTrigger value="role">By Role</TabsTrigger>
              <TabsTrigger value="location">By Location</TabsTrigger>
              <TabsTrigger value="process">By Process</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Select
            value={selectedItem || ''}
            onValueChange={(value) => setSelectedItem(value || null)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={`Filter by ${view}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All {view}s</SelectItem>
              {filterOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'current') return [value, 'Current Headcount'];
                if (name === 'target') return [value, 'Target Headcount'];
                if (name === 'gap') return [value, 'Gap'];
                return [value, name];
              }}
            />
            {showLegend && <Legend />}
            <Bar dataKey="current" name="Current" fill={colors.current} />
            <Bar dataKey="target" name="Target" fill={colors.target} />
            <Bar dataKey="gap" name="Gap" fill={colors.gap}>
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.gap > 0 ? colors.gap : '#d32f2f'} 
                />
              ))}
            </Bar>
            <ReferenceLine y={0} stroke="#000" />
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
            <div className="text-sm font-medium mb-1">Total Current</div>
            <div className="text-2xl font-bold">
              {chartData.reduce((sum, item) => sum + item.current, 0)}
            </div>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
            <div className="text-sm font-medium mb-1">Total Target</div>
            <div className="text-2xl font-bold">
              {chartData.reduce((sum, item) => sum + item.target, 0)}
            </div>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
            <div className="text-sm font-medium mb-1">Total Gap</div>
            <div className="text-2xl font-bold">
              {chartData.reduce((sum, item) => sum + item.gap, 0)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CapacityPlanning;