import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetConfig } from './dashboard-configuration';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, FileBarChart } from 'lucide-react';
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
  Legend,
  LineChart,
  Line
} from 'recharts';

export interface WidgetFactoryProps {
  widget: WidgetConfig;
  batchIds?: number[];
}

// Factory component that renders the appropriate widget based on its type
export function WidgetFactory({ widget, batchIds = [] }: WidgetFactoryProps) {
  switch (widget.type) {
    case 'assessment-performance':
      return <AssessmentPerformanceWidget widget={widget} batchIds={batchIds} />;
    case 'certification-progress':
      return <CertificationProgressWidget widget={widget} batchIds={batchIds} />;
    case 'attendance-overview':
      return <AttendanceOverviewWidget widget={widget} batchIds={batchIds} />;
    case 'attendance-trends':
      return <AttendanceTrendsWidget widget={widget} batchIds={batchIds} />;
    case 'performance-distribution':
      return <PerformanceDistributionWidget widget={widget} batchIds={batchIds} />;
    case 'phase-completion':
      return <PhaseCompletionWidget widget={widget} batchIds={batchIds} />;
    default:
      return <ErrorDisplay />;
  }
}

// Display error when widget type is not recognized
function ErrorDisplay() {
  return (
    <Alert variant="destructive" className="h-full flex flex-col justify-center">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        Unknown widget type or configuration error
      </AlertDescription>
    </Alert>
  );
}

// Loading state for widgets while data is being fetched
function LoadingDisplay() {
  return (
    <div className="h-full flex flex-col space-y-4 justify-center p-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

// Assessment Performance Widget
function AssessmentPerformanceWidget({ widget, batchIds }: WidgetFactoryProps) {
  // API endpoint to fetch assessment performance data
  const batchIdsParam = batchIds.length > 0 ? batchIds.join(',') : '';
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/assessment-performance', batchIdsParam],
    enabled: !!batchIdsParam,
  });

  if (isLoading) return <LoadingDisplay />;
  
  if (error || !data) {
    return (
      <Alert variant="destructive" className="h-full flex flex-col justify-center">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error loading data</AlertTitle>
        <AlertDescription>
          Failed to load assessment performance data
        </AlertDescription>
      </Alert>
    );
  }
  
  // If empty data, provide a placeholder
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <FileBarChart className="h-12 w-12 mb-2" />
        <h3 className="font-medium">No assessment data available</h3>
        <p className="text-sm mt-1">Assessment data will appear here once trainees complete their assessments</p>
      </div>
    );
  }
  
  // Transform data for chart display
  const chartData = Object.entries(data).map(([assessmentName, score], index) => ({
    name: assessmentName,
    score: Number(score),
    fill: `hsl(${index * 45}, 70%, 50%)`,
  }));
  
  return (
    <div className="h-full flex flex-col">
      <CardContent className="flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
          {widget.chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="score"
                label={({ name, score }) => `${name}: ${score}%`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
            </PieChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="score" name="Score (%)" radius={[5, 5, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </div>
  );
}

// Certification Progress Widget
function CertificationProgressWidget({ widget, batchIds }: WidgetFactoryProps) {
  // API endpoint to fetch certification progress data
  const batchIdsParam = batchIds.length > 0 ? batchIds.join(',') : '';
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/certification-progress', batchIdsParam],
    enabled: !!batchIdsParam,
  });

  if (isLoading) return <LoadingDisplay />;
  
  if (error || !data) {
    return (
      <Alert variant="destructive" className="h-full flex flex-col justify-center">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error loading data</AlertTitle>
        <AlertDescription>
          Failed to load certification progress data
        </AlertDescription>
      </Alert>
    );
  }
  
  // If empty data, provide a placeholder
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <FileBarChart className="h-12 w-12 mb-2" />
        <h3 className="font-medium">No certification data available</h3>
        <p className="text-sm mt-1">Certification progress will appear here once certifications are assigned</p>
      </div>
    );
  }
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
  
  // For pie chart, use the status counts
  const pieData = [
    { name: 'Completed', value: data.completed || 0, color: COLORS[0] },
    { name: 'In Progress', value: data.inProgress || 0, color: COLORS[1] },
    { name: 'Not Started', value: data.notStarted || 0, color: COLORS[2] }
  ];
  
  const totalCertifications = (data.completed || 0) + (data.inProgress || 0) + (data.notStarted || 0);
  const completionPercentage = totalCertifications > 0 
    ? Math.round((data.completed || 0) / totalCertifications * 100) 
    : 0;
  
  return (
    <div className="h-full flex flex-col">
      <CardContent className="flex-1 p-2">
        {totalCertifications === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
            <h3 className="font-medium">No certification data yet</h3>
            <p className="text-sm mt-1">Data will appear once certifications are assigned</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-2">
              <p className="text-sm font-medium">Overall Completion: {completionPercentage}%</p>
              <p className="text-xs text-muted-foreground">
                {data.completed || 0} of {totalCertifications} certifications completed
              </p>
            </div>
            <ResponsiveContainer width="100%" height="85%">
              {widget.chartType === 'bar' ? (
                <BarChart data={pieData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" name="Certifications" radius={[5, 5, 0, 0]}>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              )}
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </div>
  );
}

// Attendance Overview Widget
function AttendanceOverviewWidget({ widget, batchIds }: WidgetFactoryProps) {
  // API endpoint to fetch attendance overview data
  const batchIdsParam = batchIds.length > 0 ? batchIds.join(',') : '';
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/attendance-overview', batchIdsParam],
    enabled: !!batchIdsParam,
  });

  if (isLoading) return <LoadingDisplay />;
  
  if (error || !data) {
    return (
      <Alert variant="destructive" className="h-full flex flex-col justify-center">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error loading data</AlertTitle>
        <AlertDescription>
          Failed to load attendance data
        </AlertDescription>
      </Alert>
    );
  }
  
  // If empty data, provide a placeholder
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <FileBarChart className="h-12 w-12 mb-2" />
        <h3 className="font-medium">No attendance data available</h3>
        <p className="text-sm mt-1">Attendance data will appear here once recorded</p>
      </div>
    );
  }
  
  const COLORS = ['#4CAF50', '#f44336', '#FFC107'];
  
  // For attendance overview
  const overviewData = [
    { name: 'Present', value: data.present || 0, color: COLORS[0] },
    { name: 'Absent', value: data.absent || 0, color: COLORS[1] },
    { name: 'Late', value: data.late || 0, color: COLORS[2] }
  ];
  
  const total = (data.present || 0) + (data.absent || 0) + (data.late || 0);
  const presentPercentage = total > 0 ? Math.round((data.present || 0) / total * 100) : 0;
  const absentPercentage = total > 0 ? Math.round((data.absent || 0) / total * 100) : 0;
  const latePercentage = total > 0 ? Math.round((data.late || 0) / total * 100) : 0;
  
  return (
    <div className="h-full flex flex-col">
      <CardContent className="flex-1 p-2">
        {total === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
            <h3 className="font-medium">No attendance data yet</h3>
            <p className="text-sm mt-1">Data will appear once attendance is recorded</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-2 text-xs space-y-1">
              <p className="text-sm font-medium">Attendance Summary</p>
              <p className="text-xs"><span className="font-medium text-green-600">Present:</span> {presentPercentage}% ({data.present}/{total})</p>
              <p className="text-xs"><span className="font-medium text-red-600">Absent:</span> {absentPercentage}% ({data.absent}/{total})</p>
              <p className="text-xs"><span className="font-medium text-amber-600">Late:</span> {latePercentage}% ({data.late}/{total})</p>
            </div>
            
            <ResponsiveContainer width="100%" height="75%">
              {widget.chartType === 'bar' ? (
                <BarChart data={overviewData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" name="Count" radius={[5, 5, 0, 0]}>
                    {overviewData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={overviewData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {overviewData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} sessions`} />
                </PieChart>
              )}
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </div>
  );
}

// Attendance Trends Widget
function AttendanceTrendsWidget({ widget, batchIds }: WidgetFactoryProps) {
  // API endpoint to fetch attendance trends data
  const batchIdsParam = batchIds.length > 0 ? batchIds.join(',') : '';
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/attendance-trends', batchIdsParam],
    enabled: !!batchIdsParam,
  });

  if (isLoading) return <LoadingDisplay />;
  
  if (error || !data) {
    return (
      <Alert variant="destructive" className="h-full flex flex-col justify-center">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error loading data</AlertTitle>
        <AlertDescription>
          Failed to load attendance trends data
        </AlertDescription>
      </Alert>
    );
  }
  
  // If empty data, provide a placeholder
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <FileBarChart className="h-12 w-12 mb-2" />
        <h3 className="font-medium">No attendance trend data available</h3>
        <p className="text-sm mt-1">Trends will appear as attendance is recorded over time</p>
      </div>
    );
  }
  
  // For trend data, we'll use the line chart to show attendance over time
  return (
    <div className="h-full flex flex-col">
      <CardContent className="flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="present" 
              stroke="#4CAF50" 
              activeDot={{ r: 8 }} 
              name="Present"
            />
            <Line 
              type="monotone" 
              dataKey="absent" 
              stroke="#f44336" 
              name="Absent"
            />
            <Line 
              type="monotone" 
              dataKey="late" 
              stroke="#FFC107" 
              name="Late"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </div>
  );
}

// Performance Distribution Widget
function PerformanceDistributionWidget({ widget, batchIds }: WidgetFactoryProps) {
  // API endpoint to fetch performance distribution data
  const batchIdsParam = batchIds.length > 0 ? batchIds.join(',') : '';
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/performance-distribution', batchIdsParam],
    enabled: !!batchIdsParam,
  });

  if (isLoading) return <LoadingDisplay />;
  
  if (error || !data) {
    return (
      <Alert variant="destructive" className="h-full flex flex-col justify-center">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error loading data</AlertTitle>
        <AlertDescription>
          Failed to load performance distribution data
        </AlertDescription>
      </Alert>
    );
  }
  
  // If empty data, provide a placeholder
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <FileBarChart className="h-12 w-12 mb-2" />
        <h3 className="font-medium">No performance data available</h3>
        <p className="text-sm mt-1">Performance distribution will appear once assessments are completed</p>
      </div>
    );
  }
  
  // For distribution chart, we'll use a bar chart showing score ranges
  const distributionData = data.map((entry, index) => ({
    ...entry,
    fill: `hsl(${index * 25}, 70%, 50%)`,
  }));
  
  return (
    <div className="h-full flex flex-col">
      <CardContent className="flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
          {widget.chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value} trainees`} />
              <Legend />
            </PieChart>
          ) : (
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip formatter={(value) => `${value} trainees`} />
              <Bar dataKey="count" name="Trainees" radius={[5, 5, 0, 0]}>
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </div>
  );
}

// Phase Completion Widget
function PhaseCompletionWidget({ widget, batchIds }: WidgetFactoryProps) {
  // API endpoint to fetch phase completion data
  const batchIdsParam = batchIds.length > 0 ? batchIds.join(',') : '';
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/phase-completion', batchIdsParam],
    enabled: !!batchIdsParam,
  });

  if (isLoading) return <LoadingDisplay />;
  
  if (error || !data) {
    return (
      <Alert variant="destructive" className="h-full flex flex-col justify-center">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error loading data</AlertTitle>
        <AlertDescription>
          Failed to load phase completion data
        </AlertDescription>
      </Alert>
    );
  }
  
  // If empty data, provide a placeholder
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <FileBarChart className="h-12 w-12 mb-2" />
        <h3 className="font-medium">No phase data available</h3>
        <p className="text-sm mt-1">Phase completion data will appear here once phases begin</p>
      </div>
    );
  }
  
  // For phase completion, convert to appropriate chart format
  const phaseData = data.map((phase, index) => ({
    ...phase,
    fill: `hsl(${index * 30}, 70%, 50%)`,
  }));
  
  return (
    <div className="h-full flex flex-col">
      <CardContent className="flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
          {widget.chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={phaseData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percentComplete }) => `${name}: ${percentComplete}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="daysComplete"
              >
                {phaseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name, props) => [`${props.payload.percentComplete}%`, 'Completion']} />
              <Legend />
            </PieChart>
          ) : (
            <BarChart data={phaseData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value, name, props) => [`${props.payload.percentComplete}%`, 'Completion']} />
              <Bar dataKey="percentComplete" name="% Complete" radius={[5, 5, 0, 0]}>
                {phaseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </div>
  );
}