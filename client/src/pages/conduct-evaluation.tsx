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
  
  // Log the assigned audio files to help with debugging
  console.log("Assigned audio files:", assignedAudioFiles);

  // Get audio file details when selected
  // Fetch audio file details
  const { data: selectedAudioFileDetails } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/audio-files/${selectedAudioFile}`],
    enabled: !!selectedAudioFile && !!user?.organizationId,
    onSuccess: (data) => {
      console.log("Audio file details loaded:", data);
      // We'll get the SAS URL separately, not using data.fileUrl directly
    },
    onError: (error) => {
      console.error("Error fetching audio file details:", error);
      // Fallback to legacy endpoint if the organization-specific endpoint fails
      queryClient.fetchQuery({
        queryKey: [`/api/audio-files/${selectedAudioFile}`],
        queryFn: async () => {
          const response = await fetch(`/api/audio-files/${selectedAudioFile}`);
          if (!response.ok) {
            throw new Error('Failed to fetch audio file details');
          }
          return response.json();
        }
      });
    }
  });
  
  // Define interface for SAS URL response
  interface SasUrlResponse {
    sasUrl: string;
    fileInfo?: {
      name: string;
      type: string;
      size?: number;
      duration?: number;
    };
  }

  // Fetch SAS URL for audio file with enhanced error handling and typing
  const sasUrlQuery = useQuery<SasUrlResponse, Error>({
    queryKey: [`/api/azure-audio-sas/${selectedAudioFile}`],
    enabled: !!selectedAudioFile,
    onSuccess: (data) => {
      console.log("Audio SAS URL generated for file ID:", selectedAudioFile);
      
      if (!data) {
        console.error("SAS URL response is empty or undefined");
        toast({
          variant: "destructive",
          title: "Audio Access Error",
          description: "Received an empty response when requesting audio access. Please try again."
        });
        return;
      }
      
      if (!data.sasUrl) {
        console.error("SAS URL is missing in response:", data);
        toast({
          variant: "destructive",
          title: "Audio Access Error",
          description: "The secure access URL is missing or invalid. Please select the file again."
        });
        return;
      }
      
      console.log("Setting audio URL to SAS URL for file ID:", selectedAudioFile);
      
      // Get file info if available from the enhanced API response
      if (data.fileInfo) {
        console.log("Received file info with SAS URL:", data.fileInfo);
        // If the API provided a duration, we can set it directly
        if (data.fileInfo.duration) {
          setDuration(data.fileInfo.duration);
        }
      }
      
      // Clear previous audio state first
      if (audioRef.current) {
        try {
          // First pause any current playback
          audioRef.current.pause();
          
          // Set the new URL 
          setAudioUrl(data.sasUrl);
          
          // Configure audio element with content type if available
          if (data.fileInfo?.type) {
            console.log(`Setting audio content type: ${data.fileInfo.type}`);
            try {
              // Some browsers need this for proper MIME type recognition
              audioRef.current.setAttribute('type', data.fileInfo.type);
            } catch (typeError) {
              console.warn("Error setting audio type attribute:", typeError);
              // Non-critical error, continue
            }
          }
          
          // Configure error handling for the audio element
          audioRef.current.onerror = (e) => {
            const error = audioRef.current?.error;
            const errorMessage = error ? 
              `Code: ${error.code}, Message: ${error.message}` : 
              'Unknown audio error';
            
            console.error("Audio error:", errorMessage, e);
            
            // Log detailed error information for debugging
            if (error) {
              switch(error.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                  console.error("Audio loading aborted by the user");
                  break;
                case MediaError.MEDIA_ERR_NETWORK:
                  console.error("Network error while loading audio");
                  break;
                case MediaError.MEDIA_ERR_DECODE:
                  console.error("Audio decoding error - file may be corrupted");
                  break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                  console.error("Audio format not supported by the browser");
                  break;
              }
            }
            
            toast({
              variant: "destructive",
              title: "Audio Playback Error",
              description: `There was a problem playing this audio file. Please try again.`
            });
          };
          
          // Use a small timeout to ensure state updates before loading the audio
          setTimeout(() => {
            if (audioRef.current) {
              try {
                audioRef.current.load();
                console.log("Audio element loaded with new SAS URL for file ID:", selectedAudioFile);
              } catch (loadError) {
                console.error("Error loading audio with new SAS URL:", loadError);
                toast({
                  variant: "destructive",
                  title: "Audio Loading Error",
                  description: "Error loading the audio file. Please try selecting it again."
                });
              }
            }
          }, 200); // Increased timeout to ensure DOM updates
        } catch (pauseError) {
          console.error("Error pausing audio before setting new SAS URL:", pauseError);
          // Continue anyway since we're replacing the URL
          setAudioUrl(data.sasUrl);
        }
      } else {
        console.log("Audio ref not available, just setting the URL state");
        setAudioUrl(data.sasUrl);
      }
    },
    onError: (error) => {
      console.error("Error generating SAS URL for file ID:", selectedAudioFile, error);
      toast({
        variant: "destructive",
        title: "Audio Access Error",
        description: `Could not generate secure access URL for the audio file: ${error.message}. Please try selecting a different file.`
      });
      // Reset audio URL state on error
      setAudioUrl(null);
    },
    retry: 1, // Retry once if failed
    retryDelay: 1000, // Wait 1 second between retries
    staleTime: 5 * 60 * 1000, // 5 minutes - SAS tokens typically last longer than this
    cacheTime: 10 * 60 * 1000, // 10 minutes
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

  // Enhanced audio player controls with better error handling and auto-recovery
  const handlePlayPause = async () => {
    if (!audioRef.current || !audioUrl) {
      console.warn("Play attempted without audio reference or URL:", {
        hasAudioRef: !!audioRef.current,
        hasAudioUrl: !!audioUrl
      });
      
      toast({
        variant: "destructive",
        title: "Playback Error",
        description: "Audio file not loaded or unavailable. Please try selecting a different file."
      });
      return;
    }
    
    try {
      if (isPlaying) {
        // Handle pause - this operation is generally safe
        console.log("Pausing audio playback");
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        console.log("Attempting to start audio playback", {
          selected: selectedAudioFile,
          currentTime: audioRef.current.currentTime,
          duration: audioRef.current.duration,
          readyState: audioRef.current.readyState
        });
        
        // MEDIA_ELEMENT_READY_STATE reference:
        // 0 = HAVE_NOTHING - no information available
        // 1 = HAVE_METADATA - metadata loaded but no data available
        // 2 = HAVE_CURRENT_DATA - data for current position available
        // 3 = HAVE_FUTURE_DATA - data for current and future position available
        // 4 = HAVE_ENOUGH_DATA - enough data available to start playing
        
        // Check if we need to reload the audio element first
        if (audioRef.current.readyState < 2) {
          console.log("Audio not sufficiently loaded, reloading first");
          try {
            audioRef.current.load();
            // Wait a moment for loading
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (loadError) {
            console.error("Error pre-loading audio:", loadError);
          }
        }
        
        // Set a timeout flag to detect if the play promise takes too long
        let timeoutFlag = true;
        
        // Start a timeout to detect if the play operation is hanging
        const timeoutId = setTimeout(() => {
          if (timeoutFlag) {
            // If we reach here, the play promise hasn't resolved in time
            console.warn("Play operation timed out, refreshing audio source");
            
            if (audioRef.current) {
              // Attempt to force a reload by cycling the URL
              const currentUrl = audioUrl;
              setAudioUrl(null);
              
              // Short delay before setting the URL again
              setTimeout(() => {
                setAudioUrl(currentUrl);
                setTimeout(() => {
                  if (audioRef.current) {
                    try {
                      audioRef.current.load();
                    } catch (e) {
                      console.error("Failed to reload audio after timeout:", e);
                    }
                  }
                }, 200);
              }, 200);
            }
            
            toast({
              title: "Playback Issue",
              description: "The audio is taking too long to start. Refreshing the player...",
              duration: 3000,
            });
          }
        }, 3000); // 3 second timeout
        
        // Attempt to play the audio
        try {
          const playPromise = audioRef.current.play();
          // Modern browsers return a promise from play()
          if (playPromise !== undefined) {
            await playPromise;
            console.log("Audio playback started successfully");
          }
          
          // If we get here, play was successful
          timeoutFlag = false;
          clearTimeout(timeoutId);
          setIsPlaying(true);
        } catch (playError) {
          // Specific handling for play errors which can be caused by:
          // 1. User interaction requirements not being met
          // 2. Network errors
          // 3. Audio format errors
          console.error("Error during audio play() operation:", playError);
          clearTimeout(timeoutId);
          
          // Check if this might be an expired SAS URL
          if (selectedAudioFile && audioUrl && audioUrl.includes('sig=')) {
            console.log("Detected potential SAS token issue, requesting new token");
            // Get a fresh SAS URL
            queryClient.invalidateQueries({
              queryKey: [`/api/azure-audio-sas/${selectedAudioFile}`],
              exact: true
            });
            
            toast({
              title: "Refreshing Audio Access",
              description: "Audio access token may have expired. Refreshing access...",
              duration: 3000,
            });
          } else {
            // Generic play error
            toast({
              variant: "destructive",
              title: "Playback Error",
              description: "Could not play the audio file. Try selecting it again or refresh the page."
            });
          }
          
          throw playError; // Re-throw to be caught by outer catch
        }
      }
    } catch (error) {
      console.error("Error handling audio playback:", error);
      
      // Attempt to recover from common errors
      if (audioRef.current) {
        // Force reload the audio element
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.load();
          console.log("Attempted recovery by reloading audio element");
        } catch (reloadError) {
          console.error("Failed to reload audio element during recovery:", reloadError);
        }
      }
      
      // Always ensure we're in a non-playing state after an error
      setIsPlaying(false);
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
    // First reset all audio-related states
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setScores({});
    setAudioUrl(null); // Clear previous audio URL
    
    // Ensure any current audio is properly stopped first
    if (audioRef.current) {
      try {
        // Stop playback
        audioRef.current.pause();
        
        // Reset source and reload to clear any existing buffered data
        audioRef.current.src = "";
        audioRef.current.load();
      } catch (error) {
        console.error("Error resetting audio player:", error);
      }
    }
    
    // Only after cleanup, set the new audio file ID
    setTimeout(() => {
      setSelectedAudioFile(parseInt(audioFileId));
      console.log("Selected audio file ID:", audioFileId);
    }, 100);
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
                    {assignedAudioFiles && assignedAudioFiles.length > 0 ? 
                      assignedAudioFiles.map((file: any) => (
                        <SelectItem key={file.audioFileId || file.id} value={(file.audioFileId || file.id).toString()}>
                          {file.audioFile?.originalFilename || file.originalFilename || file.filename || `Audio File #${file.audioFileId || file.id}`}
                        </SelectItem>
                      )) : 
                      <SelectItem value="no-files" disabled>No audio files assigned</SelectItem>
                    }
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
                  {selectedAudioFileDetails.originalFilename || selectedAudioFileDetails.filename || `Audio File #${selectedAudioFileDetails.id}`}
                </CardTitle>
                <CardDescription>
                  Duration: {selectedAudioFileDetails.duration || 'Unknown'} | 
                  Language: {selectedAudioFileDetails.language || 'Unknown'} | 
                  Version: {selectedAudioFileDetails.version || 'N/A'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Hidden audio element with comprehensive MIME type support and enhanced error handling */}
                  <audio 
                    ref={audioRef}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                    onError={(e) => {
                      // Log detailed error information for debugging
                      const target = e.currentTarget as HTMLAudioElement;
                      const errorCode = target.error?.code;
                      const errorMessage = target.error?.message;
                      
                      console.error("Audio player error:", {
                        code: errorCode,
                        message: errorMessage,
                        audioUrl: audioUrl?.substring(0, 100) + '...',
                        selectedAudioFile
                      });
                      
                      // Error code reference:
                      // MEDIA_ERR_ABORTED (1): Fetching process aborted by user
                      // MEDIA_ERR_NETWORK (2): Error occurred when downloading
                      // MEDIA_ERR_DECODE (3): Error occurred when decoding
                      // MEDIA_ERR_SRC_NOT_SUPPORTED (4): Audio not supported
                      
                      // Determine error type for better user feedback
                      let errorType = "unknown";
                      if (errorCode === MediaError.MEDIA_ERR_NETWORK) {
                        errorType = "network";
                      } else if (errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                        errorType = "format";
                      } else if (errorCode === MediaError.MEDIA_ERR_DECODE) {
                        errorType = "decode";
                      }
                      
                      // Is this likely a SAS token expiration issue?
                      const isSasError = (
                        errorType === "network" || 
                        errorType === "format" || 
                        (audioUrl && audioUrl.includes('sig=') && audioUrl.includes('se='))
                      );
                      
                      if (isSasError && selectedAudioFile) {
                        console.log("Detected potential SAS token expiration for file:", selectedAudioFile);
                        
                        // Inform user we're refreshing the audio access
                        toast({
                          title: "Audio Access Expired",
                          description: "The secure access link has expired. Refreshing audio access...",
                          duration: 3000,
                        });
                        
                        // Clear current audio URL
                        setAudioUrl(null);
                        
                        // Force refresh the query to get a new SAS URL with short delay
                        setTimeout(() => {
                          queryClient.invalidateQueries({
                            queryKey: [`/api/azure-audio-sas/${selectedAudioFile}`],
                            exact: true
                          });
                        }, 500);
                      } else if (errorType === "format" || errorType === "decode") {
                        // This is likely a file format issue
                        toast({
                          variant: "destructive",
                          title: "Audio Format Error",
                          description: "This audio file format is not supported by your browser. Try using a different browser or contact support."
                        });
                      } else {
                        // Generic error message for other issues
                        toast({
                          variant: "destructive",
                          title: "Audio Playback Error",
                          description: "Could not play the audio file. Try selecting it again or contact support if the issue persists."
                        });
                      }
                      
                      // Always ensure we're in a non-playing state after an error
                      setIsPlaying(false);
                    }}
                    preload="auto"
                    controls
                    style={{ display: 'none' }}
                  >
                    {audioUrl && (
                      <>
                        {/* Comprehensive list of MIME types for maximum browser compatibility */}
                        <source src={audioUrl} type="audio/mpeg" />
                        <source src={audioUrl} type="audio/mp3" />
                        <source src={audioUrl} type="audio/wav" />
                        <source src={audioUrl} type="audio/wave" />
                        <source src={audioUrl} type="audio/x-wav" />
                        <source src={audioUrl} type="audio/webm" />
                        <source src={audioUrl} type="audio/ogg" />
                        <source src={audioUrl} type="audio/mp4" />
                        <source src={audioUrl} type="audio/x-m4a" />
                        <source src={audioUrl} type="audio/aac" />
                        <source src={audioUrl} type="audio/x-ms-wma" />
                        <source src={audioUrl} type="audio/flac" />
                        {/* Fallback message for browsers without audio support */}
                        <p>Your browser doesn't support HTML5 audio. Here is a <a href={audioUrl} target="_blank" rel="noopener noreferrer">link to the audio</a> instead.</p>
                      </>
                    )}
                  </audio>
                  
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