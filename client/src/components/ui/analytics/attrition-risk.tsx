import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Legend, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AttritionRiskProps {
  title?: string;
  filters?: Record<string, any>;
  chartType?: 'pie' | 'bar' | 'radar';
  colorScheme?: string;
  showLegend?: boolean;
}

type RiskData = {
  riskLevel: string;
  count: number;
  factors: Record<string, number>;
};

const RISK_COLORS = {
  default: {
    'High Risk': '#d32f2f',
    'Medium Risk': '#ff9800',
    'Low Risk': '#4caf50',
  },
  blues: {
    'High Risk': '#1976d2',
    'Medium Risk': '#42a5f5',
    'Low Risk': '#bbdefb',
  },
  greens: {
    'High Risk': '#2e7d32',
    'Medium Risk': '#66bb6a',
    'Low Risk': '#c8e6c9',
  },
  oranges: {
    'High Risk': '#e64a19',
    'Medium Risk': '#ff7043',
    'Low Risk': '#ffccbc',
  },
  purples: {
    'High Risk': '#5e35b1',
    'Medium Risk': '#9575cd',
    'Low Risk': '#d1c4e9',
  },
  rainbow: {
    'High Risk': '#d32f2f',
    'Medium Risk': '#ff9800',
    'Low Risk': '#4caf50',
  },
};

const FACTOR_COLORS = {
  default: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FECBA6'],
  blues: ['#0088FE', '#2D9CDB', '#56CCF2', '#81E3F9', '#B4F1F9', '#E1FCFD'],
  greens: ['#00C49F', '#27AE60', '#6FCF97', '#A1E3CB', '#D2F2E3'],
  oranges: ['#FF8042', '#F2994A', '#F2C94C', '#FFD572', '#FFEDB6'],
  purples: ['#8884D8', '#9B51E0', '#BB6BD9', '#D8B4FE', '#F2D9FF'],
  rainbow: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'],
};

const getRiskColors = (scheme: string = 'default') => {
  return RISK_COLORS[scheme as keyof typeof RISK_COLORS] || RISK_COLORS.default;
};

const getFactorColors = (scheme: string = 'default') => {
  return FACTOR_COLORS[scheme as keyof typeof FACTOR_COLORS] || FACTOR_COLORS.default;
};

const AttritionRisk: React.FC<AttritionRiskProps> = ({
  title = 'Attrition Risk Analysis',
  filters = {},
  chartType = 'pie',
  colorScheme = 'default',
  showLegend = true,
}) => {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'factors'>('overview');
  const [selectedRisk, setSelectedRisk] = useState<string | null>(null);

  // Fetch attrition risk data
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/attrition-risk', filters],
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
          <span className="ml-2">Loading attrition data...</span>
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
          Error loading attrition data
        </CardContent>
      </Card>
    );
  }

  const riskData: RiskData[] = data || [];
  const riskColors = getRiskColors(colorScheme);
  const factorColors = getFactorColors(colorScheme);

  if (riskData.length === 0) {
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-gray-500">
          No attrition risk data available
        </CardContent>
      </Card>
    );
  }

  // Prepare overview chart data
  const overviewData = riskData.map(item => ({
    name: item.riskLevel,
    value: item.count
  }));

  // Prepare factor data based on selection
  const prepareFactorData = () => {
    if (selectedRisk) {
      // Show factors for the selected risk level
      const selectedRiskData = riskData.find(item => item.riskLevel === selectedRisk);
      if (selectedRiskData) {
        return Object.entries(selectedRiskData.factors).map(([factor, value]) => ({
          factor,
          value
        }));
      }
    }
    
    // No selection, aggregate all factors
    const factorMap = new Map<string, number>();
    
    riskData.forEach(item => {
      Object.entries(item.factors).forEach(([factor, value]) => {
        const weightedValue = value * (item.riskLevel === 'High Risk' ? 3 : item.riskLevel === 'Medium Risk' ? 2 : 1);
        if (!factorMap.has(factor)) {
          factorMap.set(factor, 0);
        }
        factorMap.set(factor, factorMap.get(factor)! + weightedValue);
      });
    });
    
    return Array.from(factorMap.entries()).map(([factor, value]) => ({
      factor,
      value
    }));
  };

  const factorData = prepareFactorData();

  const renderOverviewChart = () => {
    if (chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={overviewData}
              cx="50%"
              cy="50%"
              labelLine={true}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
              onClick={(data) => setSelectedRisk(data.name === selectedRisk ? null : data.name)}
            >
              {overviewData.map((entry) => (
                <Cell 
                  key={`cell-${entry.name}`} 
                  fill={riskColors[entry.name as keyof typeof riskColors]}
                  stroke={selectedRisk === entry.name ? '#000' : 'none'}
                  strokeWidth={selectedRisk === entry.name ? 2 : 0}
                />
              ))}
            </Pie>
            {showLegend && <Legend />}
            <Tooltip formatter={(value, name) => [value, 'Employees']} />
          </PieChart>
        </ResponsiveContainer>
      );
    } else {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={overviewData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
            onClick={(data) => {
              if (data && data.activePayload && data.activePayload.length > 0) {
                const entry = data.activePayload[0].payload;
                setSelectedRisk(entry.name === selectedRisk ? null : entry.name);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value, name) => [value, 'Employees']} />
            {showLegend && <Legend />}
            <Bar dataKey="value" name="Employees">
              {overviewData.map((entry) => (
                <Cell 
                  key={`cell-${entry.name}`} 
                  fill={riskColors[entry.name as keyof typeof riskColors]}
                  stroke={selectedRisk === entry.name ? '#000' : 'none'}
                  strokeWidth={selectedRisk === entry.name ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }
  };

  const renderFactorChart = () => {
    if (chartType === 'radar') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={factorData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="factor" />
            <PolarRadiusAxis />
            <Radar
              name="Contribution Factor"
              dataKey="value"
              stroke={factorColors[0]}
              fill={factorColors[0]}
              fillOpacity={0.6}
            />
            <Tooltip formatter={(value) => [value, 'Impact Score']} />
            {showLegend && <Legend />}
          </RadarChart>
        </ResponsiveContainer>
      );
    } else {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={factorData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="factor" type="category" width={120} />
            <Tooltip formatter={(value) => [value, 'Impact Score']} />
            {showLegend && <Legend />}
            <Bar dataKey="value" name="Contributing Factor" fill={factorColors[0]}>
              {factorData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={factorColors[index % factorColors.length]} />
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
        <Tabs 
          value={selectedTab} 
          onValueChange={(value) => setSelectedTab(value as 'overview' | 'factors')}
          className="mb-4"
        >
          <TabsList>
            <TabsTrigger value="overview">Risk Overview</TabsTrigger>
            <TabsTrigger value="factors">Contributing Factors</TabsTrigger>
          </TabsList>
        </Tabs>

        {selectedTab === 'overview' ? (
          <>
            {renderOverviewChart()}
            {selectedRisk && (
              <div className="mt-3 text-sm text-center">
                <div className="font-medium">Selected: {selectedRisk}</div>
                <button 
                  className="text-blue-600 hover:underline mt-1"
                  onClick={() => {
                    setSelectedRisk(null);
                    setSelectedTab('factors');
                  }}
                >
                  View contributing factors
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">
                {selectedRisk 
                  ? `Contributing Factors for ${selectedRisk}` 
                  : 'Contributing Factors (All Risk Levels)'}
              </h3>
              {selectedRisk && (
                <button 
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => setSelectedRisk(null)}
                >
                  View all factors
                </button>
              )}
            </div>
            {renderFactorChart()}
          </>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          {riskData.map(risk => (
            <div 
              key={risk.riskLevel}
              className="flex flex-col items-center p-2 rounded-md"
              style={{ backgroundColor: `${riskColors[risk.riskLevel as keyof typeof riskColors]}20` }}
            >
              <div className="text-sm font-medium">{risk.riskLevel}</div>
              <div className="text-2xl font-bold">{risk.count}</div>
              <div className="text-xs text-gray-500">employees</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AttritionRisk;