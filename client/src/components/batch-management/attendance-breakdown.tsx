import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  BarChart as BarChartIcon,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  SortAsc,
  SortDesc,
  PieChart,
  LineChart,
  BarChart3,
  Eye,
  X
} from "lucide-react";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from "recharts";

// Type definitions
type DailyAttendance = {
  date: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: number;
  totalTrainees: number;
};

type PhaseAttendance = {
  phase: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: number;
  totalDays: number;
  totalRecords: number;
};

type TraineeAttendance = {
  traineeId: number;
  traineeName: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: number;
};

type BatchAttendanceOverview = {
  totalDays: number;
  completedDays: number;
  // Historical/cumulative attendance counts
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: number;
  // Today's attendance data
  todayAttendance?: {
    presentCount: number;
    absentCount: number;
    lateCount: number;
    leaveCount: number;
    attendanceRate: number;
  };
  dailyAttendance: DailyAttendance[];
  phaseAttendance: PhaseAttendance[];
  traineeAttendance: TraineeAttendance[];
};

// Color constants for charts
const COLORS = {
  present: '#22c55e', // green-500
  absent: '#ef4444',  // red-500
  late: '#eab308',    // yellow-500
  leave: '#3b82f6',   // blue-500
  background: '#f3f4f6' // gray-100
};

type ChartType = 'bar' | 'pie' | 'line';
type SortOrder = 'asc' | 'desc';
type SortField = 'name' | 'present' | 'absent' | 'late' | 'leave' | 'rate';

// Attendance detail dialog component
function AttendanceDetailDialog({ 
  title, 
  children, 
  trigger,
  description
}: { 
  title: string;
  children: React.ReactNode;
  trigger: React.ReactNode;
  description?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// Detail table component
const DetailTable = ({ details }: { details: { label: string; value: any; color?: string }[] }) => (
  <Table>
    <TableBody>
      {details.map((item, index) => (
        <TableRow key={index}>
          <TableCell className="font-medium">{item.label}</TableCell>
          <TableCell 
            className={item.color ? "font-bold" : ""}
            style={{ color: item.color }}
          >
            {item.value}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export function AttendanceBreakdown({ 
  attendanceData 
}: { 
  attendanceData: BatchAttendanceOverview 
}) {
  const [breakdownTab, setBreakdownTab] = useState("overall");
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [sortField, setSortField] = useState<SortField>('rate');
  
  // Prepare data for charts
  const prepareOverallChartData = () => {
    return [
      { name: 'Present', value: attendanceData.presentCount, color: COLORS.present },
      { name: 'Absent', value: attendanceData.absentCount, color: COLORS.absent },
      { name: 'Late', value: attendanceData.lateCount, color: COLORS.late },
      { name: 'Leave', value: attendanceData.leaveCount, color: COLORS.leave }
    ];
  };

  // Chart control panel component
  const ChartControls = ({ onChangeChartType }: { onChangeChartType: (type: ChartType) => void }) => (
    <div className="flex flex-wrap gap-2 mb-4 justify-between items-center">
      <div className="flex gap-2">
        <Button 
          variant={chartType === 'bar' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => onChangeChartType('bar')}
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Bar
        </Button>
        <Button 
          variant={chartType === 'pie' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => onChangeChartType('pie')}
        >
          <PieChart className="h-4 w-4 mr-2" />
          Pie
        </Button>
        <Button 
          variant={chartType === 'line' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => onChangeChartType('line')}
        >
          <LineChart className="h-4 w-4 mr-2" />
          Line
        </Button>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">Attendance Breakdown</CardTitle>
          <CardDescription>Interactive attendance analytics and drill-down</CardDescription>
        </div>
        
        {/* Legend badges */}
        <div className="flex gap-2 flex-wrap justify-end">
          <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Present</Badge>
          <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Absent</Badge>
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Late</Badge>
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Leave</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overall" value={breakdownTab} onValueChange={setBreakdownTab}>
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="overall" className="flex items-center gap-2">
              <BarChartIcon className="h-4 w-4" />
              <span>Overall</span>
            </TabsTrigger>
            <TabsTrigger value="daily" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Daily</span>
            </TabsTrigger>
            <TabsTrigger value="phase" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Phase</span>
            </TabsTrigger>
            <TabsTrigger value="trainee" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Trainee</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Overall attendance tab */}
          <TabsContent value="overall">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-medium">Overall Attendance Rate</span>
                  <span className="text-base font-medium">
                    {attendanceData.attendanceRate}%
                  </span>
                </div>
                <Progress 
                  value={attendanceData.attendanceRate} 
                  className="h-2.5 bg-gray-100 mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {attendanceData.completedDays} days completed out of {attendanceData.totalDays} total training days
                </p>
              </div>
              
              {/* Today's Attendance section */}
              {attendanceData.todayAttendance && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-semibold">Today's Attendance</h3>
                    <Badge variant="outline" className="bg-gray-50">
                      {format(new Date(), 'MMM d, yyyy')}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border rounded-lg p-4 bg-gray-50">
                    <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                      <div className="h-12 w-12 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      </div>
                      <p className="mt-2 text-lg font-semibold">{attendanceData.todayAttendance.presentCount}</p>
                      <p className="text-xs text-muted-foreground">Present Today</p>
                    </div>

                    <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                      <div className="h-12 w-12 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                        <X className="h-6 w-6 text-red-600" />
                      </div>
                      <p className="mt-2 text-lg font-semibold">{attendanceData.todayAttendance.absentCount}</p>
                      <p className="text-xs text-muted-foreground">Absent Today</p>
                    </div>

                    <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                      <div className="h-12 w-12 mx-auto rounded-full bg-yellow-100 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-yellow-600" />
                      </div>
                      <p className="mt-2 text-lg font-semibold">{attendanceData.todayAttendance.lateCount}</p>
                      <p className="text-xs text-muted-foreground">Late Today</p>
                    </div>

                    <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                      <div className="h-12 w-12 mx-auto rounded-full bg-blue-100 flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-blue-600" />
                      </div>
                      <p className="mt-2 text-lg font-semibold">{attendanceData.todayAttendance.leaveCount}</p>
                      <p className="text-xs text-muted-foreground">Leave Today</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Overall/Historical Attendance section */}
              <div className="space-y-4 mt-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-semibold">Overall Attendance (Cumulative)</h3>
                  <Badge variant="outline" className="bg-blue-50 text-blue-800">
                    Historical Data
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border rounded-lg p-4">
                  <AttendanceDetailDialog
                    title="Present Attendance Details"
                    description="Analysis of present attendance records"
                    trigger={
                      <div className="text-center cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
                        <div className="h-12 w-12 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        </div>
                        <p className="mt-2 text-lg font-semibold">{attendanceData.presentCount}</p>
                        <p className="text-xs text-muted-foreground">Present</p>
                        <Button variant="link" size="sm" className="mt-1 h-auto p-0">Details</Button>
                      </div>
                    }
                  >
                    <DetailTable
                      details={[
                        { label: 'Total Present Records', value: attendanceData.presentCount, color: COLORS.present },
                        { label: 'Total Records', value: attendanceData.presentCount + attendanceData.absentCount + attendanceData.lateCount + attendanceData.leaveCount },
                        { label: 'Present Percentage', value: `${attendanceData.attendanceRate}%`, color: COLORS.present }
                      ]}
                    />
                  </AttendanceDetailDialog>
                  
                  <AttendanceDetailDialog
                    title="Absent Attendance Details"
                    description="Analysis of absent attendance records"
                    trigger={
                      <div className="text-center cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
                        <div className="h-12 w-12 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                          <AlertCircle className="h-6 w-6 text-red-600" />
                        </div>
                        <p className="mt-2 text-lg font-semibold">{attendanceData.absentCount}</p>
                        <p className="text-xs text-muted-foreground">Absent</p>
                        <Button variant="link" size="sm" className="mt-1 h-auto p-0">Details</Button>
                      </div>
                    }
                  >
                    <DetailTable
                      details={[
                        { label: 'Total Absent Records', value: attendanceData.absentCount, color: COLORS.absent },
                        { label: 'Total Records', value: attendanceData.presentCount + attendanceData.absentCount + attendanceData.lateCount + attendanceData.leaveCount },
                        { label: 'Absent Percentage', value: `${Math.round((attendanceData.absentCount / (attendanceData.presentCount + attendanceData.absentCount + attendanceData.lateCount + attendanceData.leaveCount)) * 100)}%`, color: COLORS.absent }
                      ]}
                    />
                  </AttendanceDetailDialog>
                  
                  <AttendanceDetailDialog
                    title="Late Attendance Details"
                    description="Analysis of late attendance records"
                    trigger={
                      <div className="text-center cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
                        <div className="h-12 w-12 mx-auto rounded-full bg-yellow-100 flex items-center justify-center">
                          <Clock className="h-6 w-6 text-yellow-600" />
                        </div>
                        <p className="mt-2 text-lg font-semibold">{attendanceData.lateCount}</p>
                        <p className="text-xs text-muted-foreground">Late</p>
                        <Button variant="link" size="sm" className="mt-1 h-auto p-0">Details</Button>
                      </div>
                    }
                  >
                    <DetailTable
                      details={[
                        { label: 'Total Late Records', value: attendanceData.lateCount, color: COLORS.late },
                        { label: 'Total Records', value: attendanceData.presentCount + attendanceData.absentCount + attendanceData.lateCount + attendanceData.leaveCount },
                        { label: 'Late Percentage', value: `${Math.round((attendanceData.lateCount / (attendanceData.presentCount + attendanceData.absentCount + attendanceData.lateCount + attendanceData.leaveCount)) * 100)}%`, color: COLORS.late }
                      ]}
                    />
                  </AttendanceDetailDialog>
                  
                  <AttendanceDetailDialog
                    title="Leave Attendance Details"
                    description="Analysis of leave attendance records"
                    trigger={
                      <div className="text-center cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
                        <div className="h-12 w-12 mx-auto rounded-full bg-blue-100 flex items-center justify-center">
                          <Calendar className="h-6 w-6 text-blue-600" />
                        </div>
                        <p className="mt-2 text-lg font-semibold">{attendanceData.leaveCount}</p>
                        <p className="text-xs text-muted-foreground">Leave</p>
                        <Button variant="link" size="sm" className="mt-1 h-auto p-0">Details</Button>
                      </div>
                    }
                  >
                    <DetailTable
                      details={[
                        { label: 'Total Leave Records', value: attendanceData.leaveCount, color: COLORS.leave },
                        { label: 'Total Records', value: attendanceData.presentCount + attendanceData.absentCount + attendanceData.lateCount + attendanceData.leaveCount },
                        { label: 'Leave Percentage', value: `${Math.round((attendanceData.leaveCount / (attendanceData.presentCount + attendanceData.absentCount + attendanceData.lateCount + attendanceData.leaveCount)) * 100)}%`, color: COLORS.leave }
                      ]}
                    />
                  </AttendanceDetailDialog>
                </div>
              </div>
                
              <div className="mt-4">
                <ChartControls onChangeChartType={setChartType} />
                <div>
                  {chartType === 'pie' ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={prepareOverallChartData()}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {prepareOverallChartData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : chartType === 'line' ? (
                    <div className="text-center p-6 border rounded-lg bg-gray-50">
                      <p className="text-muted-foreground">Line chart is available for time-series data</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={prepareOverallChartData()}
                        layout="vertical"
                        margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          width={100}
                        />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" name="Count">
                          {prepareOverallChartData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="daily">
            <div className="p-6 text-center border rounded-lg bg-gray-50">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Daily attendance breakdown view will be available soon</p>
            </div>
          </TabsContent>
          
          <TabsContent value="phase">
            <div className="p-6 text-center border rounded-lg bg-gray-50">
              <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Phase attendance breakdown view will be available soon</p>
            </div>
          </TabsContent>
          
          <TabsContent value="trainee">
            <div className="p-6 text-center border rounded-lg bg-gray-50">
              <Users className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Trainee attendance breakdown view will be available soon</p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}