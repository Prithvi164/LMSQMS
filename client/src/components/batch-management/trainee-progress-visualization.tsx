import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// Types based on the schema
type TraineePhase = 
  | 'training'
  | 'written_assessment'
  | 'refresher_training'
  | 'certification'
  | 'ojt'
  | 'ojt_certification'
  | 'production'
  | 'completed';

type PhaseStatus = 'pending' | 'pass' | 'fail' | 'in_refresher';

type AssessmentType = 'written' | 'certification' | 'ojt_certification';

interface TraineeProgress {
  id: number;
  traineeId: number;
  batchId: number;
  currentPhase: TraineePhase;
  phaseStatus: PhaseStatus;
  nextPhase: TraineePhase;
  trainingStartDate: string;
  writtenAssessmentDate: string | null;
  refresherStartDate: string | null;
  certificationDate: string | null;
  ojtStartDate: string | null;
  ojtCertificationDate: string | null;
  productionDate: string | null;
  completionDate: string | null;
  organizationId: number;
  createdAt: string;
  updatedAt: string;
}

interface Assessment {
  id: number;
  traineeId: number;
  batchId: number;
  type: AssessmentType;
  score: number;
  passingScore: number;
  passed: boolean;
  attemptNumber: number;
  assessmentDate: string;
  organizationId: number;
}

interface RefresherSession {
  id: number;
  traineeId: number;
  batchId: number;
  phaseBeforeRefresher: TraineePhase;
  assessmentId: number;
  startDate: string;
  endDate: string | null;
  trainerNotes: string | null;
  recommendedFocus: string | null;
  completed: boolean;
  organizationId: number;
}

// Phase configuration with labels, colors, and descriptions
const phaseConfig: Record<TraineePhase, {
  label: string;
  color: string;
  description: string;
  icon: React.ReactNode;
}> = {
  training: {
    label: "Training",
    color: "bg-blue-500",
    description: "Initial training phase where trainees learn core skills and knowledge",
    icon: <Clock className="h-5 w-5" />
  },
  written_assessment: {
    label: "Written Assessment",
    color: "bg-amber-500",
    description: "Evaluation of theoretical knowledge through written tests",
    icon: <AlertCircle className="h-5 w-5" />
  },
  refresher_training: {
    label: "Refresher Training",
    color: "bg-purple-500",
    description: "Additional training for trainees who need to strengthen specific areas",
    icon: <Clock className="h-5 w-5" />
  },
  certification: {
    label: "Certification",
    color: "bg-orange-500",
    description: "Formal certification process to validate core competencies",
    icon: <AlertCircle className="h-5 w-5" />
  },
  ojt: {
    label: "On-the-Job Training",
    color: "bg-green-500",
    description: "Practical application of skills in a real work environment",
    icon: <Clock className="h-5 w-5" />
  },
  ojt_certification: {
    label: "OJT Certification",
    color: "bg-emerald-500",
    description: "Final assessment of on-the-job performance",
    icon: <AlertCircle className="h-5 w-5" />
  },
  production: {
    label: "Production",
    color: "bg-teal-500",
    description: "Trainee is working in a live production environment",
    icon: <BadgeCheck className="h-5 w-5" />
  },
  completed: {
    label: "Completed",
    color: "bg-indigo-500",
    description: "Training program successfully completed",
    icon: <BadgeCheck className="h-5 w-5" />
  }
};

// Status configuration
const statusConfig: Record<PhaseStatus, {
  label: string;
  color: string;
  variant: "default" | "outline" | "secondary" | "destructive";
}> = {
  pending: {
    label: "Pending",
    color: "text-yellow-500",
    variant: "outline"
  },
  pass: {
    label: "Passed",
    color: "text-green-500",
    variant: "default"
  },
  fail: {
    label: "Failed",
    color: "text-red-500",
    variant: "destructive"
  },
  in_refresher: {
    label: "In Refresher",
    color: "text-purple-500",
    variant: "secondary"
  }
};

interface TraineeProgressVisualizationProps {
  traineeId: number;
  batchId: number;
}

export function TraineeProgressVisualization({ traineeId, batchId }: TraineeProgressVisualizationProps) {
  const [isAssessmentHistoryOpen, setIsAssessmentHistoryOpen] = useState(false);
  const [isRefresherHistoryOpen, setIsRefresherHistoryOpen] = useState(false);
  const { toast } = useToast();

  // Fetch trainee progress data
  const { data: progress, isLoading: progressLoading, error: progressError } = useQuery<TraineeProgress>({
    queryKey: [`/api/batches/${batchId}/trainees/${traineeId}/progress`],
    enabled: !!traineeId && !!batchId,
  });

  // Fetch assessment history
  const { data: assessments = [], isLoading: assessmentsLoading } = useQuery<Assessment[]>({
    queryKey: [`/api/batches/${batchId}/trainees/${traineeId}/assessments`],
    enabled: !!traineeId && !!batchId,
  });

  // Fetch refresher session history
  const { data: refresherSessions = [], isLoading: refreshersLoading } = useQuery<RefresherSession[]>({
    queryKey: [`/api/batches/${batchId}/trainees/${traineeId}/refresher-sessions`],
    enabled: !!traineeId && !!batchId,
  });

  if (progressLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trainee Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-muted-foreground">Loading progress data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (progressError || !progress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trainee Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-destructive">Error loading progress data. Progress tracking may not be initialized for this trainee.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Define the phase order for visualization
  const phaseOrder: TraineePhase[] = [
    'training',
    'written_assessment',
    'certification',
    'ojt',
    'ojt_certification',
    'production',
    'completed'
  ];

  // Calculate progress percentage through the phases
  const currentPhaseIndex = phaseOrder.indexOf(progress.currentPhase);
  const progressPercentage = Math.round((currentPhaseIndex / (phaseOrder.length - 1)) * 100);

  // Generate phase visualization
  const renderPhaseTimeline = () => {
    return (
      <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-z-10 before:bg-gray-200">
        {phaseOrder.map((phase, index) => {
          const isPastPhase = phaseOrder.indexOf(progress.currentPhase) > index;
          const isCurrentPhase = progress.currentPhase === phase;
          
          // Determine phase date to display
          let phaseDate: string | null = null;
          switch (phase) {
            case 'training':
              phaseDate = progress.trainingStartDate;
              break;
            case 'written_assessment':
              phaseDate = progress.writtenAssessmentDate;
              break;
            case 'certification':
              phaseDate = progress.certificationDate;
              break;
            case 'ojt':
              phaseDate = progress.ojtStartDate;
              break;
            case 'ojt_certification':
              phaseDate = progress.ojtCertificationDate;
              break;
            case 'production':
              phaseDate = progress.productionDate;
              break;
            case 'completed':
              phaseDate = progress.completionDate;
              break;
          }

          return (
            <div key={phase} className="relative flex items-start gap-4">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isPastPhase ? phaseConfig[phase].color : isCurrentPhase ? "bg-blue-100 border-2 border-blue-500" : "bg-gray-100"} shrink-0`}>
                <span className={`${isPastPhase ? "text-white" : isCurrentPhase ? "text-blue-500" : "text-gray-400"}`}>
                  {phaseConfig[phase].icon}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center">
                  <h3 className={`text-sm font-medium ${isCurrentPhase ? "text-blue-600" : isPastPhase ? "text-gray-900" : "text-gray-500"}`}>
                    {phaseConfig[phase].label}
                  </h3>
                  {isCurrentPhase && (
                    <Badge className="ml-2" variant={statusConfig[progress.phaseStatus].variant}>
                      {statusConfig[progress.phaseStatus].label}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {phaseConfig[phase].description}
                </p>
                {phaseDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Date: {format(new Date(phaseDate), 'MMM d, yyyy')}
                  </p>
                )}
                
                {/* Show assessment results for assessment phases */}
                {(phase === 'written_assessment' || phase === 'certification' || phase === 'ojt_certification') && (
                  <div className="mt-2">
                    {assessments.filter(a => {
                      switch (phase) {
                        case 'written_assessment': return a.type === 'written';
                        case 'certification': return a.type === 'certification';
                        case 'ojt_certification': return a.type === 'ojt_certification';
                        default: return false;
                      }
                    }).slice(0, 1).map(assessment => (
                      <div key={assessment.id} className="flex items-center mt-1">
                        <span className={`text-xs ${assessment.passed ? "text-green-500" : "text-red-500"} mr-2`}>
                          {assessment.passed ? "Passed" : "Failed"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Score: {assessment.score}/{assessment.passingScore}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Trainee Progress</CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsAssessmentHistoryOpen(true)}
            >
              Assessments
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsRefresherHistoryOpen(true)}
            >
              Refresher Sessions
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            {/* Overall progress indicator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm font-medium">{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            {/* Current phase information */}
            <div className="p-4 bg-gray-50 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Current Phase</h3>
                  <p className="text-lg font-semibold mt-1">
                    {phaseConfig[progress.currentPhase].label}
                  </p>
                </div>
                <div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={statusConfig[progress.phaseStatus].variant}>
                          {statusConfig[progress.phaseStatus].label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {progress.phaseStatus === 'in_refresher' 
                          ? "Trainee is currently in a refresher session"
                          : progress.phaseStatus === 'pending'
                          ? "Trainee is waiting for assessment"
                          : progress.phaseStatus === 'pass'
                          ? "Trainee has passed this phase"
                          : "Trainee has failed assessment and needs refresher training"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              
              <div className="mt-2">
                <h4 className="text-xs text-muted-foreground">Next Phase</h4>
                <p className="text-sm font-medium mt-1">{phaseConfig[progress.nextPhase].label}</p>
              </div>
            </div>

            {/* Phase timeline visualization */}
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-4">Training Journey</h3>
              {renderPhaseTimeline()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assessment History Dialog */}
      <Dialog open={isAssessmentHistoryOpen} onOpenChange={setIsAssessmentHistoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assessment History</DialogTitle>
            <DialogDescription>
              Complete record of trainee's assessment attempts
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 max-h-96 overflow-y-auto">
            {assessmentsLoading ? (
              <p className="text-center py-4 text-sm text-muted-foreground">Loading assessments...</p>
            ) : assessments.length === 0 ? (
              <p className="text-center py-4 text-sm text-muted-foreground">No assessments recorded yet</p>
            ) : (
              <div className="space-y-4">
                {assessments.map(assessment => (
                  <div key={assessment.id} className="p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-medium">
                          {assessment.type === 'written' ? 'Written Assessment'
                            : assessment.type === 'certification' ? 'Certification'
                            : 'OJT Certification'}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(assessment.assessmentDate), 'MMMM d, yyyy')}
                        </p>
                      </div>
                      <Badge variant={assessment.passed ? "default" : "destructive"}>
                        {assessment.passed ? "Passed" : "Failed"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Score</p>
                        <p className="font-medium">{assessment.score}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Passing Score</p>
                        <p className="font-medium">{assessment.passingScore}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Attempt</p>
                        <p className="font-medium">{assessment.attemptNumber}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Refresher Session History Dialog */}
      <Dialog open={isRefresherHistoryOpen} onOpenChange={setIsRefresherHistoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Refresher Session History</DialogTitle>
            <DialogDescription>
              Record of trainee's refresher training sessions
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 max-h-96 overflow-y-auto">
            {refreshersLoading ? (
              <p className="text-center py-4 text-sm text-muted-foreground">Loading refresher sessions...</p>
            ) : refresherSessions.length === 0 ? (
              <p className="text-center py-4 text-sm text-muted-foreground">No refresher sessions recorded</p>
            ) : (
              <div className="space-y-4">
                {refresherSessions.map(session => (
                  <div key={session.id} className="p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-medium">
                          Refresher for {phaseConfig[session.phaseBeforeRefresher].label}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Start: {format(new Date(session.startDate), 'MMM d, yyyy')}
                        </p>
                        {session.endDate && (
                          <p className="text-xs text-muted-foreground">
                            End: {format(new Date(session.endDate), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                      <Badge variant={session.completed ? "default" : "outline"}>
                        {session.completed ? "Completed" : "In Progress"}
                      </Badge>
                    </div>
                    {(session.trainerNotes || session.recommendedFocus) && (
                      <div className="mt-2 text-xs">
                        <Tabs defaultValue="notes">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="notes">Trainer Notes</TabsTrigger>
                            <TabsTrigger value="focus">Recommended Focus</TabsTrigger>
                          </TabsList>
                          <TabsContent value="notes" className="mt-2">
                            {session.trainerNotes ? (
                              <p className="whitespace-pre-line">{session.trainerNotes}</p>
                            ) : (
                              <p className="text-muted-foreground">No notes provided</p>
                            )}
                          </TabsContent>
                          <TabsContent value="focus" className="mt-2">
                            {session.recommendedFocus ? (
                              <p className="whitespace-pre-line">{session.recommendedFocus}</p>
                            ) : (
                              <p className="text-muted-foreground">No focus areas specified</p>
                            )}
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}