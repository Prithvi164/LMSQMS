import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Legend, Cell } from 'recharts';
import { BarChart, Bar, CartesianGrid } from 'recharts';

interface LocationDistributionMapProps {
  title?: string;
  filters?: Record<string, any>;
  chartType?: 'map' | 'bar';
  colorScheme?: string;
  showLegend?: boolean;
}

type LocationData = {
  location: string;
  count: number;
  coordinates?: { lat: number; lng: number };
};

const COLORS = {
  default: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FECBA6'],
  blues: ['#0088FE', '#2D9CDB', '#56CCF2', '#81E3F9', '#B4F1F9', '#E1FCFD'],
  greens: ['#00C49F', '#27AE60', '#6FCF97', '#A1E3CB', '#D2F2E3'],
  oranges: ['#FF8042', '#F2994A', '#F2C94C', '#FFD572', '#FFEDB6'],
  purples: ['#8884D8', '#9B51E0', '#BB6BD9', '#D8B4FE', '#F2D9FF'],
  rainbow: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'],
};

const getLocationColors = (scheme: string = 'default') => {
  return COLORS[scheme as keyof typeof COLORS] || COLORS.default;
};

const LocationDistributionMap: React.FC<LocationDistributionMapProps> = ({
  title = 'Location Distribution',
  filters = {},
  chartType = 'map',
  colorScheme = 'default',
  showLegend = true,
}) => {
  // Construct the query string from filters
  const queryString = filters ? 
    `?filters=${encodeURIComponent(JSON.stringify(filters))}` : '';

  // Fetch location distribution data
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/location-distribution', filters],
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
          <span className="ml-2">Loading location data...</span>
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
          Error loading location data
        </CardContent>
      </Card>
    );
  }

  const locationData: LocationData[] = data || [];
  const colors = getLocationColors(colorScheme);

  const renderBarChart = () => {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={locationData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="location" />
          <YAxis />
          <Tooltip formatter={(value, name) => [value, 'Employee Count']} />
          {showLegend && <Legend />}
          <Bar dataKey="count" name="Employee Count" fill={colors[0]}>
            {locationData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderMapChart = () => {
    // Filter out entries without coordinates
    const filteredData = locationData.filter(entry => entry.coordinates);
    
    // Check if we have any valid map data
    if (filteredData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
          <p>No location coordinate data available</p>
          <p className="text-sm mt-2">Showing bar chart instead</p>
          {renderBarChart()}
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart
          margin={{
            top: 20,
            right: 20,
            bottom: 20,
            left: 20,
          }}
        >
          <CartesianGrid />
          <XAxis 
            type="number" 
            dataKey="coordinates.lng" 
            name="Longitude" 
            domain={[-180, 180]} 
            label={{ value: 'Longitude', position: 'bottom' }}
          />
          <YAxis 
            type="number" 
            dataKey="coordinates.lat" 
            name="Latitude" 
            domain={[-90, 90]} 
            label={{ value: 'Latitude', angle: -90, position: 'left' }}
          />
          <ZAxis dataKey="count" range={[50, 500]} name="Employees" />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(value, name, props) => {
              if (name === 'Employees') return [value, 'Count'];
              return [value, name];
            }}
            labelFormatter={(label) => {
              const item = filteredData.find(
                item => 
                  item.coordinates?.lng === label[0] && 
                  item.coordinates?.lat === label[1]
              );
              return item ? item.location : '';
            }}
          />
          {showLegend && <Legend />}
          <Scatter 
            name="Locations" 
            data={filteredData} 
            fill={colors[0]}
          >
            {filteredData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {locationData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-gray-500">
            No location data available
          </div>
        ) : chartType === 'map' ? renderMapChart() : renderBarChart()}
      </CardContent>
    </Card>
  );
};

export default LocationDistributionMap;