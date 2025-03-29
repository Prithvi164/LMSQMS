import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Users
} from "lucide-react";
import { format } from "date-fns";

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
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: number;
  dailyAttendance: DailyAttendance[];
  phaseAttendance: PhaseAttendance[];
  traineeAttendance: TraineeAttendance[];
};

export function AttendanceBreakdown({ 
  attendanceData 
}: { 
  attendanceData: BatchAttendanceOverview 
}) {
  const [breakdownTab, setBreakdownTab] = useState("overall");
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Attendance Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overall" value={breakdownTab} onValueChange={setBreakdownTab}>
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="overall" className="flex items-center gap-2">
              <BarChart className="h-4 w-4" />
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
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-base font-medium">Overall Attendance Rate</span>
                <span className="text-base font-medium">
                  {attendanceData.attendanceRate}%
                </span>
              </div>
              <Progress 
                value={attendanceData.attendanceRate} 
                className="h-2.5 bg-gray-100"
              />
              
              <div className="grid grid-cols-4 gap-2 mt-2 border rounded p-3">
                <div className="text-center">
                  <div className="h-10 w-10 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="mt-2 text-lg font-semibold">{attendanceData.presentCount}</p>
                  <p className="text-sm text-muted-foreground">Present</p>
                </div>
                <div className="text-center">
                  <div className="h-10 w-10 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <p className="mt-2 text-lg font-semibold">{attendanceData.absentCount}</p>
                  <p className="text-sm text-muted-foreground">Absent</p>
                </div>
                <div className="text-center">
                  <div className="h-10 w-10 mx-auto rounded-full bg-yellow-100 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <p className="mt-2 text-lg font-semibold">{attendanceData.lateCount}</p>
                  <p className="text-sm text-muted-foreground">Late</p>
                </div>
                <div className="text-center">
                  <div className="h-10 w-10 mx-auto rounded-full bg-blue-100 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="mt-2 text-lg font-semibold">{attendanceData.leaveCount}</p>
                  <p className="text-sm text-muted-foreground">Leave</p>
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  {attendanceData.completedDays} days completed out of {attendanceData.totalDays} total training days
                </p>
              </div>
            </div>
          </TabsContent>
          
          {/* Daily attendance tab */}
          <TabsContent value="daily">
            {attendanceData.dailyAttendance.length > 0 ? (
              <div className="border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>Late</TableHead>
                      <TableHead>Leave</TableHead>
                      <TableHead>Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceData.dailyAttendance.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell>{format(new Date(day.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-green-600">{day.presentCount}</TableCell>
                        <TableCell className="text-red-600">{day.absentCount}</TableCell>
                        <TableCell className="text-yellow-600">{day.lateCount}</TableCell>
                        <TableCell className="text-blue-600">{day.leaveCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <span className="mr-2">{day.attendanceRate}%</span>
                            <Progress value={day.attendanceRate} className="h-2 w-16" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No daily attendance data available
              </div>
            )}
          </TabsContent>
          
          {/* Phase attendance tab */}
          <TabsContent value="phase">
            {attendanceData.phaseAttendance.length > 0 ? (
              <div className="border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phase</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>Late</TableHead>
                      <TableHead>Leave</TableHead>
                      <TableHead>Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceData.phaseAttendance.map((phase) => (
                      <TableRow key={phase.phase}>
                        <TableCell>{phase.phase}</TableCell>
                        <TableCell className="text-green-600">{phase.presentCount}</TableCell>
                        <TableCell className="text-red-600">{phase.absentCount}</TableCell>
                        <TableCell className="text-yellow-600">{phase.lateCount}</TableCell>
                        <TableCell className="text-blue-600">{phase.leaveCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <span className="mr-2">{phase.attendanceRate}%</span>
                            <Progress value={phase.attendanceRate} className="h-2 w-16" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No phase attendance data available
              </div>
            )}
          </TabsContent>
          
          {/* Trainee attendance tab */}
          <TabsContent value="trainee">
            {attendanceData.traineeAttendance.length > 0 ? (
              <div className="border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainee</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>Late</TableHead>
                      <TableHead>Leave</TableHead>
                      <TableHead>Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceData.traineeAttendance.map((trainee) => (
                      <TableRow key={trainee.traineeId}>
                        <TableCell>{trainee.traineeName}</TableCell>
                        <TableCell className="text-green-600">{trainee.presentCount}</TableCell>
                        <TableCell className="text-red-600">{trainee.absentCount}</TableCell>
                        <TableCell className="text-yellow-600">{trainee.lateCount}</TableCell>
                        <TableCell className="text-blue-600">{trainee.leaveCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <span className="mr-2">{trainee.attendanceRate}%</span>
                            <Progress value={trainee.attendanceRate} className="h-2 w-16" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No trainee attendance data available
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}