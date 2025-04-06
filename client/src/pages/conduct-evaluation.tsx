import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Play, Pause, SkipBack, SkipForward, Headphones, Volume2, FileAudio } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export default function ConductEvaluation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [selectedTrainee, setSelectedTrainee] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<number, any>>({});
  const [evaluationType, setEvaluationType] = useState<'standard' | 'audio'>('standard');
  
  // Audio player states
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  
  // Parse URL parameters
  useEffect(() => {
    if (!user) return;
    
    // Get URL parameters
    const params = new URLSearchParams(window.location.search);
    const batchId = params.get('batchId');
    const traineeId = params.get('traineeId');
    
    // Set batch ID if provided in URL
    if (batchId) {
      const batchIdNum = parseInt(batchId);
      setSelectedBatch(batchIdNum);
    }
    
    // Set trainee ID if provided in URL (but only after trainees are loaded)
    if (traineeId) {
      const traineeIdNum = parseInt(traineeId);
      setSelectedTrainee(traineeIdNum);
    }
  }, [user]);

  // Fetch active batches
  const { data: batches } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });

  // Fetch trainees for selected batch
  const { data: trainees } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${selectedBatch}/trainees`],
    enabled: !!selectedBatch && !!user?.organizationId,
  });

  // Fetch active templates
  const { data: templates } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
    select: (data) => data.filter((t: any) => t.status === "active"),
    enabled: !!user?.organizationId,
  });

  // Get selected template details
  const { data: selectedTemplateDetails } = useQuery({
    queryKey: [`/api/evaluation-templates/${selectedTemplate}`],
    enabled: !!selectedTemplate,
  });

  // Query for fetching assigned audio files for the quality analyst
  const { data: assignedAudioFiles, isLoading: loadingAudioFiles } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/audio-file-allocations/assigned-to-me`],
    enabled: !!user?.organizationId && user?.role === 'quality_analyst',
  });

  // Get audio file details when selected
  const { data: selectedAudioFileDetails } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/audio-files/${selectedAudioFile}`],
    enabled: !!selectedAudioFile && !!user?.organizationId,
    onSuccess: (data) => {
      if (data && data.fileUrl) {
        setAudioUrl(data.fileUrl);
      }
    }
  });

  // Submit evaluation
  const submitEvaluationMutation = useMutation({
    mutationFn: async (evaluation: any) => {
      const response = await fetch("/api/evaluations", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify(evaluation),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit evaluation");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // If we're evaluating an audio file, update its status to 'evaluated'
      if (evaluationType === 'audio' && selectedAudioFile) {
        updateAudioFileStatusMutation.mutate({
          audioFileId: selectedAudioFile,
          status: 'evaluated',
          evaluationId: data.id
        });
      } else {
        // For standard evaluations
        queryClient.invalidateQueries({
          queryKey: [`/api/organizations/${user?.organizationId}/evaluations`],
        });
        toast({
          title: "Success",
          description: "Evaluation submitted successfully",
        });
        setScores({});
        setSelectedBatch(null);
        setSelectedTrainee(null);
        setSelectedTemplate(null);
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Update audio file status mutation
  const updateAudioFileStatusMutation = useMutation({
    mutationFn: async ({ audioFileId, status, evaluationId }: { audioFileId: number, status: string, evaluationId: number }) => {
      const response = await fetch(`/api/audio-files/${audioFileId}/status`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status, evaluationId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update audio file status");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/audio-file-allocations/assigned-to-me`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/audio-files`],
      });
      toast({
        title: "Success",
        description: "Audio evaluation submitted successfully",
      });
      setScores({});
      setSelectedAudioFile(null);
      setSelectedTemplate(null);
      setAudioUrl(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleScoreChange = (parameterId: number, value: any) => {
    setScores((prev) => ({
      ...prev,
      [parameterId]: {
        ...prev[parameterId],
        score: value,
      },
    }));
  };

  const handleCommentChange = (parameterId: number, comment: string) => {
    setScores((prev) => ({
      ...prev,
      [parameterId]: {
        ...prev[parameterId],
        comment,
      },
    }));
  };

  const handleNoReasonSelect = (parameterId: number, reason: string) => {
    setScores((prev) => ({
      ...prev,
      [parameterId]: {
        ...prev[parameterId],
        noReason: reason,
      },
    }));
  };

  const calculateScore = () => {
    if (!selectedTemplateDetails) return 0;

    let totalScore = 0;
    let totalWeight = 0;

    selectedTemplateDetails.pillars.forEach((pillar: any) => {
      pillar.parameters.forEach((param: any) => {
        if (param.weightageEnabled && scores[param.id]?.score) {
          const paramScore =
            param.ratingType === "yes_no_na"
              ? scores[param.id].score === "yes"
                ? 100
                : 0
              : parseFloat(scores[param.id].score);

          totalScore += param.weightage * paramScore;
          totalWeight += param.weightage;
        }
      });
    });

    return totalWeight > 0 ? (totalScore / totalWeight).toFixed(2) : 0;
  };

  const handleSubmit = () => {
    if (!selectedBatch || !selectedTrainee || !selectedTemplate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select batch, trainee and template",
      });
      return;
    }

    const evaluation = {
      templateId: selectedTemplate,
      traineeId: selectedTrainee,
      batchId: selectedBatch,
      evaluatorId: user?.id,
      scores: Object.entries(scores).map(([parameterId, value]) => ({
        parameterId: parseInt(parameterId),
        ...value,
      })),
      finalScore: calculateScore(),
    };

    submitEvaluationMutation.mutate(evaluation);
  };

  // Reset dependent fields when batch changes
  const handleBatchChange = (batchId: string) => {
    setSelectedBatch(parseInt(batchId));
    setSelectedTrainee(null);
    setSelectedTemplate(null);
    setScores({});
  };

  // Audio player controls
  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleVolumeChange = (newValue: number[]) => {
    const value = newValue[0];
    setVolume(value);
    if (audioRef.current) {
      audioRef.current.volume = value;
    }
  };

  const handleSliderChange = (newValue: number[]) => {
    const value = newValue[0];
    setCurrentTime(value);
    if (audioRef.current) {
      audioRef.current.currentTime = value;
    }
  };

  // Audio file selection handler
  const handleAudioFileSelect = (audioFileId: string) => {
    setSelectedAudioFile(parseInt(audioFileId));
    setScores({});
  };

  // Audio evaluation submission
  const handleAudioSubmit = () => {
    if (!selectedAudioFile || !selectedTemplate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select an audio file and template",
      });
      return;
    }

    const evaluation = {
      templateId: selectedTemplate,
      audioFileId: selectedAudioFile,
      evaluatorId: user?.id,
      scores: Object.entries(scores).map(([parameterId, value]) => ({
        parameterId: parseInt(parameterId),
        ...value,
      })),
      finalScore: calculateScore(),
    };

    submitEvaluationMutation.mutate(evaluation);
  };

  // Format time display for audio player
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Tabs defaultValue="standard" onValueChange={(value) => setEvaluationType(value as 'standard' | 'audio')}>
        <TabsList className="mb-4">
          <TabsTrigger value="standard">Standard Evaluation</TabsTrigger>
          <TabsTrigger value="audio">Audio Evaluation</TabsTrigger>
        </TabsList>
        
        <TabsContent value="standard" className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Conduct Standard Evaluation</h1>
            <div className="flex gap-4">
              {/* Batch Selection */}
              <div className="w-[200px]">
                <Select onValueChange={handleBatchChange} value={selectedBatch?.toString()}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches?.map((batch: any) => (
                      <SelectItem key={batch.id} value={batch.id.toString()}>
                        {batch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Trainee Selection - Only enabled if batch is selected */}
              <div className="w-[200px]">
                <Select 
                  onValueChange={(value) => setSelectedTrainee(parseInt(value))}
                  value={selectedTrainee?.toString()}
                  disabled={!selectedBatch}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Trainee" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainees?.map((trainee: any) => (
                      <SelectItem key={trainee.id} value={trainee.id.toString()}>
                        {trainee.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Selection - Only enabled if trainee is selected */}
              <div className="w-[200px]">
                <Select 
                  onValueChange={(value) => setSelectedTemplate(parseInt(value))}
                  value={selectedTemplate?.toString()}
                  disabled={!selectedTrainee}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template: any) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="audio" className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Conduct Audio Evaluation</h1>
            <div className="flex gap-4">
              {/* Audio File Selection */}
              <div className="w-[250px]">
                <Select 
                  onValueChange={handleAudioFileSelect}
                  value={selectedAudioFile?.toString()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Audio File" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedAudioFiles?.filter((file: any) => file.status === 'allocated').map((file: any) => (
                      <SelectItem key={file.audioFileId} value={file.audioFileId.toString()}>
                        {file.audioFile?.originalFilename || `File #${file.audioFileId}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Selection */}
              <div className="w-[200px]">
                <Select 
                  onValueChange={(value) => setSelectedTemplate(parseInt(value))}
                  value={selectedTemplate?.toString()}
                  disabled={!selectedAudioFile}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template: any) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Audio Player */}
          {selectedAudioFileDetails && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileAudio className="h-5 w-5" />
                  {selectedAudioFileDetails.originalFilename || `Audio File #${selectedAudioFileDetails.id}`}
                </CardTitle>
                <CardDescription>
                  Duration: {selectedAudioFileDetails.duration || 'Unknown'} | 
                  Language: {selectedAudioFileDetails.language || 'Unknown'} | 
                  Version: {selectedAudioFileDetails.version || 'N/A'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Hidden audio element */}
                  <audio 
                    ref={audioRef}
                    src={audioUrl || ''} 
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                  />
                  
                  {/* Custom audio player UI */}
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{formatTime(currentTime)}</span>
                      <span className="text-sm">{formatTime(duration)}</span>
                    </div>
                    
                    <Slider
                      value={[currentTime]}
                      max={duration || 100}
                      step={0.1}
                      onValueChange={handleSliderChange}
                      className="w-full"
                    />
                    
                    <div className="flex justify-center items-center gap-4 mt-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (audioRef.current) {
                            audioRef.current.currentTime = Math.max(0, currentTime - 10);
                          }
                        }}
                      >
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="default"
                        size="icon"
                        onClick={handlePlayPause}
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (audioRef.current) {
                            audioRef.current.currentTime = Math.min(duration, currentTime + 10);
                          }
                        }}
                      >
                        <SkipForward className="h-4 w-4" />
                      </Button>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Volume2 className="h-4 w-4" />
                        <Slider
                          value={[volume]}
                          max={1}
                          step={0.01}
                          onValueChange={handleVolumeChange}
                          className="w-24"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {selectedTemplateDetails && (
        <div className="space-y-6">
          {selectedTemplateDetails.pillars.map((pillar: any) => (
            <Card key={pillar.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{pillar.name}</span>
                  <Badge variant="outline">{pillar.weightage}%</Badge>
                </CardTitle>
                <CardDescription>{pillar.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {pillar.parameters.map((param: any) => (
                    <Card key={param.id}>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-base">
                            {param.name}
                            {param.isFatal && (
                              <Badge variant="destructive" className="ml-2">
                                Fatal
                              </Badge>
                            )}
                          </CardTitle>
                          {param.weightageEnabled && (
                            <Badge variant="outline">{param.weightage}%</Badge>
                          )}
                        </div>
                        <CardDescription>{param.description}</CardDescription>
                        {param.guidelines && (
                          <div className="mt-2 text-sm bg-muted p-2 rounded">
                            <strong>Guidelines:</strong> {param.guidelines}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {param.ratingType === "yes_no_na" ? (
                            <div className="space-y-4">
                              <Select
                                onValueChange={(value) =>
                                  handleScoreChange(param.id, value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Rating" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                  <SelectItem value="na">N/A</SelectItem>
                                </SelectContent>
                              </Select>

                              {scores[param.id]?.score === "no" &&
                                param.noReasons && (
                                  <Select
                                    onValueChange={(value) =>
                                      handleNoReasonSelect(param.id, value)
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select Reason" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {param.noReasons.map(
                                        (reason: string, idx: number) => (
                                          <SelectItem
                                            key={idx}
                                            value={reason}
                                          >
                                            {reason}
                                          </SelectItem>
                                        )
                                      )}
                                    </SelectContent>
                                  </Select>
                                )}
                            </div>
                          ) : param.ratingType === "numeric" ? (
                            <Input
                              type="number"
                              min="1"
                              max="5"
                              placeholder="Score (1-5)"
                              onChange={(e) =>
                                handleScoreChange(param.id, e.target.value)
                              }
                            />
                          ) : (
                            <Select
                              onValueChange={(value) =>
                                handleScoreChange(param.id, value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Rating" />
                              </SelectTrigger>
                              <SelectContent>
                                {param.customRatingOptions?.map(
                                  (option: string, idx: number) => (
                                    <SelectItem key={idx} value={option}>
                                      {option}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          )}

                          {(param.requiresComment ||
                            scores[param.id]?.score === "no") && (
                            <Textarea
                              placeholder="Add comments..."
                              onChange={(e) =>
                                handleCommentChange(param.id, e.target.value)
                              }
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>Final Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{calculateScore()}%</div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            {evaluationType === 'audio' ? (
              <Button
                onClick={handleAudioSubmit}
                disabled={submitEvaluationMutation.isPending || updateAudioFileStatusMutation.isPending}
              >
                {submitEvaluationMutation.isPending || updateAudioFileStatusMutation.isPending
                  ? "Submitting..."
                  : "Submit Audio Evaluation"}
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitEvaluationMutation.isPending}
              >
                {submitEvaluationMutation.isPending
                  ? "Submitting..."
                  : "Submit Evaluation"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}