import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  Calendar, 
  CheckCircle, 
  ChevronRight, 
  Clock, 
  GraduationCap, 
  LineChart, 
  Loader2, 
  UserRound, 
  UsersRound 
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BatchTimeline } from "./batch-timeline";
import { format, differenceInDays, isAfter, isBefore, isEqual } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

// Type definitions
type BatchPhase = 'planned' | 'induction' | 'training' | 'certification' | 'ojt' | 'ojt_certification' | 'completed';

type BatchAttendanceOverview = {
  totalDays: number;
  completedDays: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: number;
};

type Trainee = {
  id: number;
  status: string;
  userId: number;
  batchId: number;
  fullName: string;
  employeeId: string;
  email: string;
  phoneNumber?: string;
  dateOfJoining?: string;
  attendanceRate?: number;
  currentPhaseProgress?: number;
  overallProgress?: number;
  lastAttendance?: {
    date: string;
    status: string;
  };
};

type Phase = {
  name: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'completed';
  progress: number;
  daysCompleted: number;
  totalDays: number;
};

type BatchMetrics = {
  overallProgress: number;
  currentPhase: BatchPhase;
  currentPhaseProgress: number;
  phases: Phase[];
  daysCompleted: number;
  daysRemaining: number;
  totalDays: number;
  attendanceOverview: BatchAttendanceOverview;
};

type Batch = {
  id: number;
  name: string;
  status: BatchPhase;
  startDate: string;
  endDate: string;
  capacityLimit: number;
  userCount: number;
  trainerId?: number;
  trainer?: {
    id: number;
    fullName: string;
    email?: string;
  };
  process?: {
    id: number;
    name: string;
  };
  location?: {
    id: number;
    name: string;
  };
  lineOfBusiness?: {
    id: number;
    name: string;
  };
  // Dates for each phase
  inductionStartDate?: string;
  inductionEndDate?: string;
  trainingStartDate?: string;
  trainingEndDate?: string;
  certificationStartDate?: string;
  certificationEndDate?: string;
  ojtStartDate?: string;
  ojtEndDate?: string;
  ojtCertificationStartDate?: string;
  ojtCertificationEndDate?: string;
};

// Helper components
const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="flex items-center gap-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-6 w-24 rounded-full" />
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
    
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-64 rounded-lg" />
  </div>
);

// Loading state placeholder for batch content
const LoadingPlaceholder = () => (
  <div className="flex justify-center items-center min-h-[200px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Get status badge variant based on batch phase
// Function to determine batch phase badge variant
const getBatchPhaseColor = (phase: BatchPhase): "default" | "destructive" | "outline" | "secondary" => {
  switch (phase) {
    case 'planned':
      return 'outline';
    case 'induction':
      return 'secondary';
    case 'training':
      return 'default';
    case 'certification':
      return 'destructive';
    case 'ojt':
      return 'secondary';
    case 'ojt_certification':
      return 'secondary';
    case 'completed':
      return 'outline';
    default:
      return 'secondary';
  }
};

// Get formatted phase name
const formatPhaseName = (phase: string): string => {
  switch (phase) {
    case 'planned':
      return 'Planned';
    case 'induction':
      return 'Induction';
    case 'training':
      return 'Training';
    case 'certification':
      return 'Certification';
    case 'ojt':
      return 'OJT';
    case 'ojt_certification':
      return 'OJT Certification';
    case 'completed':
      return 'Completed';
    default:
      return phase.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
  }
};

// Format date properly
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Not set';
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return 'Invalid date';
  }
};

// Generate phase data based on batch information
const generatePhaseData = (batch: Batch): Phase[] => {
  const today = new Date();
  const phases: Phase[] = [];
  
  // Helper to create phase objects
  const createPhase = (
    name: string, 
    startDate?: string, 
    endDate?: string
  ): Phase | null => {
    if (!startDate || !endDate) return null;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = differenceInDays(end, start) + 1;
    
    let status: 'upcoming' | 'active' | 'completed';
    let progress = 0;
    let daysCompleted = 0;
    
    if (isBefore(today, start)) {
      status = 'upcoming';
    } else if (isAfter(today, end)) {
      status = 'completed';
      progress = 100;
      daysCompleted = totalDays;
    } else {
      status = 'active';
      daysCompleted = differenceInDays(today, start) + 1;
      progress = Math.min(Math.round((daysCompleted / totalDays) * 100), 100);
    }
    
    return {
      name,
      startDate,
      endDate,
      status,
      progress,
      daysCompleted,
      totalDays
    };
  };
  
  // Add all phases
  const induction = createPhase('Induction', batch.inductionStartDate, batch.inductionEndDate);
  if (induction) phases.push(induction);
  
  const training = createPhase('Training', batch.trainingStartDate, batch.trainingEndDate);
  if (training) phases.push(training);
  
  const certification = createPhase('Certification', batch.certificationStartDate, batch.certificationEndDate);
  if (certification) phases.push(certification);
  
  const ojt = createPhase('OJT', batch.ojtStartDate, batch.ojtEndDate);
  if (ojt) phases.push(ojt);
  
  const ojtCertification = createPhase('OJT Certification', batch.ojtCertificationStartDate, batch.ojtCertificationEndDate);
  if (ojtCertification) phases.push(ojtCertification);
  
  return phases;
};

// Calculate overall batch metrics
const calculateBatchMetrics = (batch: Batch, trainees: Trainee[] = []): BatchMetrics => {
  const today = new Date();
  const startDate = new Date(batch.startDate);
  const endDate = new Date(batch.endDate);
  const totalDays = differenceInDays(endDate, startDate) + 1;
  
  let daysCompleted = 0;
  let daysRemaining = 0;
  
  if (isBefore(today, startDate)) {
    // Batch hasn't started yet
    daysRemaining = totalDays;
  } else if (isAfter(today, endDate)) {
    // Batch has ended
    daysCompleted = totalDays;
  } else {
    // Batch is in progress
    daysCompleted = differenceInDays(today, startDate) + 1;
    daysRemaining = differenceInDays(endDate, today);
  }
  
  const overallProgress = Math.min(Math.round((daysCompleted / totalDays) * 100), 100);
  
  // Generate phase data
  const phases = generatePhaseData(batch);
  
  // Determine current phase and its progress
  const currentPhase = batch.status as BatchPhase;
  const currentPhaseObj = phases.find(p => p.name.toLowerCase() === currentPhase.replace('_', ' '));
  const currentPhaseProgress = currentPhaseObj?.progress || 0;
  
  // Calculate attendance statistics from actual trainee data
  const attendanceStats = {
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    leaveCount: 0,
    totalCount: trainees.length,
    attendanceRate: 0
  };
  
  // Process attendance from trainees array
  trainees.forEach(trainee => {
    const status = trainee.status?.toLowerCase() || '';
    if (status === 'present') {
      attendanceStats.presentCount++;
    } else if (status === 'absent') {
      attendanceStats.absentCount++;
    } else if (status === 'late') {
      attendanceStats.lateCount++;
    } else if (status === 'leave') {
      attendanceStats.leaveCount++;
    }
  });
  
  // Calculate attendance rate
  if (attendanceStats.totalCount > 0) {
    attendanceStats.attendanceRate = Math.round((attendanceStats.presentCount / attendanceStats.totalCount) * 100);
  }
  
  // Create attendance overview with calculated data
  const attendanceOverview = {
    totalDays: daysCompleted,
    completedDays: daysCompleted,
    presentCount: attendanceStats.presentCount,
    absentCount: attendanceStats.absentCount,
    lateCount: attendanceStats.lateCount,
    leaveCount: attendanceStats.leaveCount,
    attendanceRate: attendanceStats.attendanceRate
  };
  
  return {
    overallProgress,
    currentPhase,
    currentPhaseProgress,
    phases,
    daysCompleted,
    daysRemaining,
    totalDays,
    attendanceOverview
  };
};

// Phase progress indicator component
const PhaseProgressCard = ({ phase }: { phase: Phase }) => {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">{phase.name}</h3>
        <Badge 
          variant={phase.status === 'active' ? 'default' : 
                 phase.status === 'completed' ? 'outline' : 'outline'}
          className={phase.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : ''}
        >
          {phase.status.charAt(0).toUpperCase() + phase.status.slice(1)}
        </Badge>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatDate(phase.startDate)}</span>
          <span>{formatDate(phase.endDate)}</span>
        </div>
        <Progress value={phase.progress} className="h-2" />
        <div className="flex justify-between text-xs">
          <span>{phase.daysCompleted} / {phase.totalDays} days</span>
          <span className="font-medium">{phase.progress}%</span>
        </div>
      </div>
    </div>
  );
};

// Main batch dashboard component
export function BatchDashboard({ batchId }: { batchId: number | string }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("overview");
  
  // Fetch batch data
  const { 
    data: batch, 
    isLoading: batchLoading, 
    error: batchError 
  } = useQuery<Batch>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}`],
    enabled: !!user?.organizationId && !!batchId,
  });
  
  // Fetch batch trainees data
  const { 
    data: trainees = [], 
    isLoading: traineesLoading 
  } = useQuery<Trainee[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`],
    enabled: !!user?.organizationId && !!batchId && !!batch,
  });
  
  // Remove duplicate function as it's now implemented in calculateBatchMetrics
  
  // Calculate batch metrics if batch data is available
  const batchMetrics = batch ? calculateBatchMetrics(batch, trainees) : null;
  
  if (batchLoading) {
    return <DashboardSkeleton />;
  }
  
  if (batchError || !batch) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <p className="text-lg font-medium">Failed to load batch information</p>
            <p className="text-muted-foreground">
              There was an error loading the batch details. Please try again later.
            </p>
            <Button 
              variant="outline" 
              onClick={() => navigate("/batch-management")}
              className="mt-2"
            >
              Return to Batch Management
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const phaseVariant = getBatchPhaseColor(batch.status as BatchPhase);
  
  return (
    <div className="space-y-6">
      {/* Header with batch overview */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{batch.name}</h1>
            <Badge variant={phaseVariant} className="capitalize">
              {formatPhaseName(batch.status)}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            <span>{batch.process?.name}</span>
            {batch.location && <span> • {batch.location.name}</span>}
            {batch.lineOfBusiness && <span> • {batch.lineOfBusiness.name}</span>}
          </div>
        </div>
        
        <div className="flex gap-2 items-center">
          {batch.trainer && (
            <div className="flex items-center bg-muted rounded-full px-3 py-1 text-sm">
              <GraduationCap className="h-4 w-4 mr-2" />
              <span>Trainer: {batch.trainer.fullName}</span>
            </div>
          )}
          <Badge variant="outline" className="text-sm">
            {trainees.length} / {batch.capacityLimit} Trainees
          </Badge>
        </div>
      </div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Overall Progress Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Overall Progress</CardTitle>
            <CardDescription>From {formatDate(batch.startDate)} to {formatDate(batch.endDate)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-base font-medium">{batchMetrics?.overallProgress || 0}% Complete</span>
                <span className="text-sm text-muted-foreground">
                  {batchMetrics?.daysCompleted || 0} of {batchMetrics?.totalDays || 0} days
                </span>
              </div>
              <Progress value={batchMetrics?.overallProgress || 0} className="h-2.5 bg-gray-100" />
              
              <div className="grid grid-cols-2 gap-px mt-4 border rounded overflow-hidden">
                <div className="bg-white p-4 text-center">
                  <p className="text-base font-medium mb-1">Completed</p>
                  <p className="text-3xl font-bold">{batchMetrics?.daysCompleted || 0}</p>
                  <p className="text-sm text-muted-foreground">Days</p>
                </div>
                <div className="bg-white p-4 text-center">
                  <p className="text-base font-medium mb-1">Remaining</p>
                  <p className="text-3xl font-bold">{batchMetrics?.daysRemaining || 0}</p>
                  <p className="text-sm text-muted-foreground">Days</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Current Phase Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Current Phase</CardTitle>
            <CardDescription>
              {formatPhaseName(batchMetrics?.currentPhase || 'planned')} Phase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-base font-medium">{batchMetrics?.currentPhaseProgress || 0}% Complete</span>
                <Badge variant={phaseVariant} className="capitalize">
                  {formatPhaseName(batchMetrics?.currentPhase || 'planned')}
                </Badge>
              </div>
              <Progress value={batchMetrics?.currentPhaseProgress || 0} className="h-2.5 bg-gray-100" />
              
              <div className="mt-4">
                {batchMetrics?.currentPhase === 'planned' ? (
                  <div className="flex items-center justify-center h-[80px] border rounded">
                    <p className="text-sm text-muted-foreground">Batch not yet started</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-px border rounded overflow-hidden">
                    <div className="bg-white p-4 text-center">
                      <p className="text-base font-medium mb-1">Start Date</p>
                      <p className="text-lg font-bold">
                        {formatDate(getCurrentPhaseStartDate(batch))}
                      </p>
                    </div>
                    <div className="bg-white p-4 text-center">
                      <p className="text-base font-medium mb-1">End Date</p>
                      <p className="text-lg font-bold">
                        {formatDate(getCurrentPhaseEndDate(batch))}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Attendance Overview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Attendance Overview</CardTitle>
            <CardDescription>Current batch attendance statistics</CardDescription>
          </CardHeader>
          <CardContent>
            {batchMetrics?.attendanceOverview.totalDays === 0 ? (
              <div className="flex items-center justify-center h-[104px] border rounded">
                <p className="text-sm text-muted-foreground">No attendance data yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-base font-medium">Attendance Rate</span>
                  <span className="text-base font-medium">
                    {batchMetrics?.attendanceOverview.attendanceRate || 0}%
                  </span>
                </div>
                <Progress 
                  value={batchMetrics?.attendanceOverview.attendanceRate || 0} 
                  className="h-2.5 bg-gray-100"
                />
                
                <div className="grid grid-cols-4 gap-2 mt-2 border rounded p-3">
                  <div className="text-center">
                    <div className="h-10 w-10 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="mt-2 text-lg font-semibold">{batchMetrics?.attendanceOverview.presentCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Present</p>
                  </div>
                  <div className="text-center">
                    <div className="h-10 w-10 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <p className="mt-2 text-lg font-semibold">{batchMetrics?.attendanceOverview.absentCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Absent</p>
                  </div>
                  <div className="text-center">
                    <div className="h-10 w-10 mx-auto rounded-full bg-yellow-100 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                    <p className="mt-2 text-lg font-semibold">{batchMetrics?.attendanceOverview.lateCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Late</p>
                  </div>
                  <div className="text-center">
                    <div className="h-10 w-10 mx-auto rounded-full bg-blue-100 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="mt-2 text-lg font-semibold">{batchMetrics?.attendanceOverview.leaveCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Leave</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Detailed Content Tabs */}
      <Card>
        <CardHeader className="pb-0">
          <h3 className="text-lg font-medium">Batch Details</h3>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="trainees">Trainees</TabsTrigger>
              <TabsTrigger value="phases">Phases</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
            
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Batch Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Batch Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Batch Name</dt>
                    <dd className="font-medium">{batch.name}</dd>
                    
                    <dt className="text-muted-foreground">Process</dt>
                    <dd className="font-medium">{batch.process?.name || 'Not assigned'}</dd>
                    
                    <dt className="text-muted-foreground">Location</dt>
                    <dd className="font-medium">{batch.location?.name || 'Not assigned'}</dd>
                    
                    <dt className="text-muted-foreground">Business Line</dt>
                    <dd className="font-medium">{batch.lineOfBusiness?.name || 'Not assigned'}</dd>
                    
                    <dt className="text-muted-foreground">Capacity</dt>
                    <dd className="font-medium">{trainees.length} / {batch.capacityLimit}</dd>
                    
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="font-medium">
                      <Badge variant={phaseVariant} className="capitalize">
                        {formatPhaseName(batch.status)}
                      </Badge>
                    </dd>
                    
                    <dt className="text-muted-foreground">Start Date</dt>
                    <dd className="font-medium">{formatDate(batch.startDate)}</dd>
                    
                    <dt className="text-muted-foreground">End Date</dt>
                    <dd className="font-medium">{formatDate(batch.endDate)}</dd>
                    
                    <dt className="text-muted-foreground">Trainer</dt>
                    <dd className="font-medium">{batch.trainer?.fullName || 'Not assigned'}</dd>
                  </dl>
                </CardContent>
              </Card>
              
              {/* Phases Timeline  */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Training Phases</CardTitle>
                </CardHeader>
                <CardContent>
                  {batchMetrics?.phases && batchMetrics.phases.length > 0 ? (
                    <div className="space-y-3">
                      {batchMetrics.phases.map((phase, index) => (
                        <div key={index} className="flex items-center">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center 
                            ${phase.status === 'completed' ? 'bg-green-100' : 
                            phase.status === 'active' ? 'bg-blue-100' : 
                            'bg-gray-100'}`}>
                            {phase.status === 'completed' ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : phase.status === 'active' ? (
                              <Clock className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Calendar className="h-4 w-4 text-gray-600" />
                            )}
                          </div>
                          <div className="ml-4 flex-1">
                            <div className="flex justify-between items-center">
                              <p className="text-sm font-medium">{phase.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(phase.startDate)} - {formatDate(phase.endDate)}
                              </p>
                            </div>
                            <Progress 
                              value={phase.progress} 
                              className="h-1 mt-1"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[200px]">
                      <p className="text-sm text-muted-foreground">No phases configured</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Trainee Preview */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Trainee Roster</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveTab("trainees")}
                  className="text-xs h-8"
                >
                  View All
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </CardHeader>
              <CardContent>
                {traineesLoading ? (
                  <LoadingPlaceholder />
                ) : trainees.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <UsersRound className="mx-auto h-12 w-12 opacity-20 mb-2" />
                    <p>No trainees have been added to this batch yet.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Employee ID</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-right">Attendance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trainees.slice(0, 5).map((trainee) => (
                          <TableRow key={trainee.id}>
                            <TableCell className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {trainee.fullName.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{trainee.fullName}</span>
                            </TableCell>
                            <TableCell>{trainee.employeeId}</TableCell>
                            <TableCell className="text-sm truncate max-w-[180px]">
                              {trainee.email}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">
                                {trainee.attendanceRate || 85}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        
                        {trainees.length > 5 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setActiveTab("trainees")}
                                className="text-xs"
                              >
                                View all {trainees.length} trainees
                                <ChevronRight className="ml-1 h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Trainees Tab */}
          <TabsContent value="trainees">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trainees</CardTitle>
                <CardDescription>
                  {trainees.length} trainees enrolled in this batch
                </CardDescription>
              </CardHeader>
              <CardContent>
                {traineesLoading ? (
                  <LoadingPlaceholder />
                ) : trainees.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <UsersRound className="mx-auto h-12 w-12 opacity-20 mb-2" />
                    <p>No trainees have been added to this batch yet.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Employee ID</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Joining Date</TableHead>
                          <TableHead className="text-right">Progress</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trainees.map((trainee) => (
                          <TableRow key={trainee.id}>
                            <TableCell className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {trainee.fullName.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{trainee.fullName}</span>
                            </TableCell>
                            <TableCell>{trainee.employeeId}</TableCell>
                            <TableCell className="text-sm truncate max-w-[180px]">
                              {trainee.email}
                            </TableCell>
                            <TableCell>{trainee.phoneNumber || '-'}</TableCell>
                            <TableCell>{formatDate(trainee.dateOfJoining)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Progress 
                                  value={trainee.overallProgress || 60} 
                                  className="h-2 w-16" 
                                />
                                <span className="text-sm">
                                  {trainee.overallProgress || 60}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Phases Tab */}
          <TabsContent value="phases">
            <div className="space-y-6">
              {batchMetrics?.phases && batchMetrics.phases.length > 0 ? (
                <>
                  {/* Current Phase Detail */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Current Phase</CardTitle>
                      <CardDescription>
                        {formatPhaseName(batchMetrics.currentPhase)} ({batchMetrics.currentPhaseProgress}% complete)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <Progress value={batchMetrics.currentPhaseProgress} className="h-2" />
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="border rounded p-4 text-center">
                            <p className="text-sm text-muted-foreground mb-1">Current Phase</p>
                            <Badge variant={phaseVariant} className="capitalize">
                              {formatPhaseName(batchMetrics.currentPhase)}
                            </Badge>
                          </div>
                          
                          <div className="border rounded p-4 text-center">
                            <p className="text-sm text-muted-foreground mb-1">Start Date</p>
                            <p className="text-lg font-medium">
                              {formatDate(getCurrentPhaseStartDate(batch))}
                            </p>
                          </div>
                          
                          <div className="border rounded p-4 text-center">
                            <p className="text-sm text-muted-foreground mb-1">End Date</p>
                            <p className="text-lg font-medium">
                              {formatDate(getCurrentPhaseEndDate(batch))}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* All Phases */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {batchMetrics.phases.map((phase, index) => (
                      <PhaseProgressCard key={index} phase={phase} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="mx-auto h-12 w-12 opacity-20 mb-2" />
                  <p>No phases have been configured for this batch.</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <div className="text-center py-12">
              <LineChart className="mx-auto h-12 w-12 opacity-20 mb-2" />
              <p className="text-muted-foreground">Detailed attendance view will be implemented soon.</p>
              <p className="text-sm text-muted-foreground">
                This tab will show attendance records, trends and analytics.
              </p>
            </div>
          </TabsContent>
          
          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <BatchTimeline batchId={batchId.toString()} />
          </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to get current phase start date
function getCurrentPhaseStartDate(batch: Batch): string | undefined {
  switch (batch.status) {
    case 'induction':
      return batch.inductionStartDate;
    case 'training':
      return batch.trainingStartDate;
    case 'certification':
      return batch.certificationStartDate;
    case 'ojt':
      return batch.ojtStartDate;
    case 'ojt_certification':
      return batch.ojtCertificationStartDate;
    default:
      return batch.startDate;
  }
}

// Helper function to get current phase end date
function getCurrentPhaseEndDate(batch: Batch): string | undefined {
  switch (batch.status) {
    case 'induction':
      return batch.inductionEndDate;
    case 'training':
      return batch.trainingEndDate;
    case 'certification':
      return batch.certificationEndDate;
    case 'ojt':
      return batch.ojtEndDate;
    case 'ojt_certification':
      return batch.ojtCertificationEndDate;
    default:
      return batch.endDate;
  }
}