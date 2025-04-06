import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileAudio, Info, PlayCircle, StopCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { queryClient } from "@/lib/query-client";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { apiRequest, queryClient } from "../lib/queryClient";

// Define the schema for evaluation submission
const evaluationSchema = z.object({
  overallScore: z.string().min(1, "Overall score is required"),
  summary: z.string().min(1, "Summary is required"),
  feedback: z.string().min(1, "Feedback is required"),
  pillarScores: z.record(z.string()),
  criteriaScores: z.record(z.string()),
  questionResponses: z.record(z.string()),
});

// Define the type for SAS URL response
interface SasUrlResponse {
  sasUrl: string;
  fileInfo?: {
    name: string;
    type: string;
    size?: number;
    duration?: number;
  };
}

export default function ConductEvaluation() {
  // State variables for the component
  const [selectedAudioFile, setSelectedAudioFile] = useState<string>("");
  const [selectedAudioFileDetails, setSelectedAudioFileDetails] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [sasUrl, setSasUrl] = useState<string | null>(null);
  const [isTokenExpired, setIsTokenExpired] = useState(false);
  const [isAudioElementReady, setIsAudioElementReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hasInteractedWithAudio, setHasInteractedWithAudio] = useState(false);

  // References
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();

  // Query to fetch audio files available for evaluation
  const audioFilesQuery = useQuery({
    queryKey: ["/api/azure-audio-files/assigned"],
    onSuccess: (data) => {
      console.log("Assigned audio files:", data);
      if (data && Array.isArray(data) && data.length > 0) {
        // If no file is selected yet, select the first one
        if (!selectedAudioFile) {
          setSelectedAudioFile(data[0].id.toString());
          setSelectedAudioFileDetails(data[0]);
        }
      }
    },
    onError: (error) => {
      console.error("Error fetching assigned audio files:", error);
      toast({
        title: "Error",
        description: "Failed to load assigned audio files. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Query to fetch evaluation template
  const evaluationTemplateQuery = useQuery({
    queryKey: ["/api/evaluation-templates/active"],
  });

  // Query to fetch SAS URL for the selected audio file
  const sasUrlQuery = useQuery({
    queryKey: ["/api/azure-audio-files/sas-url", selectedAudioFile],
    enabled: !!selectedAudioFile,
    onSuccess: (data: SasUrlResponse) => {
      console.log("SAS URL received:", { url: data.sasUrl.substring(0, 50) + "..." });
      setSasUrl(data.sasUrl);
      setIsTokenExpired(false);
      setRetryCount(0);

      // Update the audio element with the new SAS URL
      if (audioRef.current) {
        audioRef.current.src = data.sasUrl;
        audioRef.current.load();
      }
    },
    onError: (error) => {
      console.error("Error fetching SAS URL:", error);
      setAudioError("Failed to get access to the audio file. Please try again.");
      setSasUrl(null);
    },
    refetchInterval: 1000 * 60 * 55, // Refetch every 55 minutes to prevent token expiration
    refetchOnWindowFocus: false,
  });

  // Mutation for submitting evaluation
  const submitEvaluationMutation = useMutation({
    mutationFn: (evaluationData: any) => {
      return apiRequest(`/api/azure-audio-files/${selectedAudioFile}/evaluate`, {
        method: "POST",
        body: JSON.stringify(evaluationData),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Evaluation submitted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/azure-audio-files/assigned"] });
      // Redirect to the dashboard or evaluation list
      setLocation("/audio-assignment-dashboard");
    },
    onError: (error) => {
      console.error("Error submitting evaluation:", error);
      toast({
        title: "Error",
        description: "Failed to submit evaluation. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Effect to handle audio element events
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audioElement.currentTime);
    };

    const handleDurationChange = () => {
      if (audioElement.duration && !isNaN(audioElement.duration)) {
        setDuration(audioElement.duration);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleError = (e: ErrorEvent) => {
      console.error("Audio playback error:", e);
      const error = audioElement.error;
      
      let errorMessage = "Unknown audio playback error";
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = "Audio playback aborted.";
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = "Network error occurred during audio playback.";
            if (sasUrl && sasUrl.includes("se=")) {
              // Check if token expiration might be the issue
              const expiryMatch = sasUrl.match(/se=([^&]+)/);
              if (expiryMatch && expiryMatch[1]) {
                try {
                  const expiryTimestamp = new Date(decodeURIComponent(expiryMatch[1])).getTime();
                  const currentTimestamp = new Date().getTime();
                  
                  if (expiryTimestamp < currentTimestamp) {
                    errorMessage = "Audio access has expired. Refreshing...";
                    setIsTokenExpired(true);
                    setSasUrl(null); // Clear the current URL to force a refresh
                    setRetryCount(prev => prev + 1);
                    // Trigger a refetch of the SAS URL
                    sasUrlQuery.refetch();
                    return;
                  }
                } catch (err) {
                  console.error("Error parsing SAS token expiry:", err);
                }
              }
            }
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = "Audio decoding error. The file might be corrupted.";
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = "Audio format not supported by your browser.";
            break;
        }
      }
      
      setAudioError(errorMessage);
      setIsPlaying(false);
    };

    const handleCanPlayThrough = () => {
      setIsAudioElementReady(true);
      setAudioError(null);
    };

    // Add event listeners
    audioElement.addEventListener("timeupdate", handleTimeUpdate);
    audioElement.addEventListener("durationchange", handleDurationChange);
    audioElement.addEventListener("play", handlePlay);
    audioElement.addEventListener("pause", handlePause);
    audioElement.addEventListener("ended", handleEnded);
    audioElement.addEventListener("error", handleError as EventListener);
    audioElement.addEventListener("canplaythrough", handleCanPlayThrough);

    // Clean up event listeners on unmount
    return () => {
      audioElement.removeEventListener("timeupdate", handleTimeUpdate);
      audioElement.removeEventListener("durationchange", handleDurationChange);
      audioElement.removeEventListener("play", handlePlay);
      audioElement.removeEventListener("pause", handlePause);
      audioElement.removeEventListener("ended", handleEnded);
      audioElement.removeEventListener("error", handleError as EventListener);
      audioElement.removeEventListener("canplaythrough", handleCanPlayThrough);
    };
  }, [sasUrl, sasUrlQuery]);

  // Effect to handle token expiration and auto-refresh
  useEffect(() => {
    if (isTokenExpired && retryCount <= 3) {
      console.log(`SAS token expired. Retry attempt ${retryCount}/3`);
      
      // Wait a moment before retrying
      const retryTimeout = setTimeout(() => {
        console.log("Retrying SAS URL fetch...");
        sasUrlQuery.refetch();
      }, 2000);
      
      return () => clearTimeout(retryTimeout);
    }
    
    if (retryCount > 3) {
      console.error("Failed to refresh SAS token after multiple attempts");
      setAudioError("Unable to refresh audio access after multiple attempts. Please reload the page.");
    }
  }, [isTokenExpired, retryCount, sasUrlQuery]);

  // Effect to update audio element when SAS URL changes
  useEffect(() => {
    if (sasUrl && audioRef.current) {
      audioRef.current.src = sasUrl;
      audioRef.current.load();
      
      // If we were playing before, try to resume playback
      if (isPlaying && hasInteractedWithAudio) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Error resuming playback after SAS refresh:", error);
          });
        }
      }
    }
  }, [sasUrl, isPlaying, hasInteractedWithAudio]);

  // Set up form for evaluation submission
  const form = useForm<z.infer<typeof evaluationSchema>>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: {
      overallScore: "",
      summary: "",
      feedback: "",
      pillarScores: {},
      criteriaScores: {},
      questionResponses: {},
    },
  });

  // Handle play/pause button
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    setHasInteractedWithAudio(true);
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Error playing audio:", error);
          setAudioError(`Error playing audio: ${error.message}`);
        });
      }
    }
  };

  // Format time for display
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Handle seeking in the audio
  const handleSeek = (value: number[]) => {
    if (!audioRef.current || !duration) return;
    
    const seekTime = (value[0] / 100) * duration;
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  // Handle changing the selected audio file
  const handleAudioFileChange = (value: string) => {
    setSelectedAudioFile(value);
    const selectedFile = audioFilesQuery.data?.find((file: any) => file.id.toString() === value);
    setSelectedAudioFileDetails(selectedFile || null);
    
    // Reset audio states
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAudioError(null);
    setSasUrl(null);
    setIsAudioElementReady(false);
    
    // Stop the current audio playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  // Handle evaluation form submission
  const handleSubmit = () => {
    form.handleSubmit((data) => {
      console.log("Form data to submit:", data);
      
      const evaluationData = {
        ...data,
        audioFileId: selectedAudioFile,
      };
      
      submitEvaluationMutation.mutate(evaluationData);
    })();
  };

  // Get template data
  const template = evaluationTemplateQuery.data || {};

  // Render the component
  return (
    <div className="container mx-auto py-6 max-w-7xl space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Conduct Evaluation</h1>
      
      <audio ref={audioRef} className="hidden" />
      
      <Tabs defaultValue="audio" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="standard">Standard Evaluation</TabsTrigger>
          <TabsTrigger value="audio">Audio Evaluation</TabsTrigger>
        </TabsList>
        
        <TabsContent value="standard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Standard Evaluation</CardTitle>
              <CardDescription>
                Evaluate a standard submission or interaction.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Standard evaluation functionality will be implemented in future updates.</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="audio" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audio File Evaluation</CardTitle>
              <CardDescription>
                Select an audio file to evaluate from your assigned list.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-4">
                    <Label htmlFor="audioFileSelect">Audio Files Assigned to You</Label>
                    <Select
                      value={selectedAudioFile}
                      onValueChange={handleAudioFileChange}
                    >
                      <SelectTrigger id="audioFileSelect">
                        <SelectValue placeholder="Select an audio file" />
                      </SelectTrigger>
                      <SelectContent>
                        {audioFilesQuery.isLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading audio files...
                          </SelectItem>
                        ) : audioFilesQuery.isError ? (
                          <SelectItem value="error" disabled>
                            Error loading audio files
                          </SelectItem>
                        ) : audioFilesQuery.data?.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No audio files assigned to you
                          </SelectItem>
                        ) : (
                          audioFilesQuery.data?.map((file: any) => (
                            <SelectItem key={file.id} value={file.id.toString()}>
                              {file.originalFilename || file.filename || `Audio File #${file.id}`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Two-column layout for audio player and evaluation form */}
          {selectedAudioFileDetails && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Audio Player Column - Takes 4/12 of the width on large screens */}
              <div className="lg:col-span-4">
                <Card className="sticky top-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileAudio className="h-5 w-5" />
                      {selectedAudioFileDetails.originalFilename ||
                        selectedAudioFileDetails.filename ||
                        `Audio File #${selectedAudioFileDetails.id}`}
                    </CardTitle>
                    <CardDescription>
                      Duration: {selectedAudioFileDetails.duration
                        ? formatTime(selectedAudioFileDetails.duration)
                        : "Unknown"} | 
                      Language: {selectedAudioFileDetails.language || "Not specified"} | 
                      Version: {selectedAudioFileDetails.version || "1.0"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {audioError && (
                      <div className="text-destructive text-sm bg-destructive/10 p-2 rounded">
                        {audioError}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                      <Slider
                        value={[duration ? (currentTime / duration) * 100 : 0]}
                        onValueChange={handleSeek}
                        disabled={!isAudioElementReady || !duration}
                      />
                    </div>
                    
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={togglePlayPause}
                        disabled={!isAudioElementReady || !!audioError}
                        className="h-12 w-12 rounded-full"
                      >
                        {isPlaying ? (
                          <StopCircle className="h-6 w-6" />
                        ) : (
                          <PlayCircle className="h-6 w-6" />
                        )}
                      </Button>
                    </div>
                    
                    {sasUrlQuery.isLoading && (
                      <div className="text-center text-sm text-muted-foreground">
                        <Progress value={30} className="h-1 mb-2" />
                        Loading audio file...
                      </div>
                    )}
                    
                    {!isAudioElementReady && sasUrl && !audioError && (
                      <div className="text-center text-sm text-muted-foreground">
                        <Progress value={60} className="h-1 mb-2" />
                        Preparing audio player...
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground">
                    <div className="w-full">
                      <p className="mb-1">Audio file metadata:</p>
                      <div className="grid grid-cols-2 gap-1">
                        <span>File ID:</span>
                        <span>{selectedAudioFileDetails.id}</span>
                        {selectedAudioFileDetails.callDate && (
                          <>
                            <span>Call Date:</span>
                            <span>{new Date(selectedAudioFileDetails.callDate).toLocaleDateString()}</span>
                          </>
                        )}
                        {selectedAudioFileDetails.agentId && (
                          <>
                            <span>Agent ID:</span>
                            <span>{selectedAudioFileDetails.agentId}</span>
                          </>
                        )}
                        {selectedAudioFileDetails.callType && (
                          <>
                            <span>Call Type:</span>
                            <span>{selectedAudioFileDetails.callType}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              </div>
              
              {/* Evaluation Form Column - Takes 8/12 of the width on large screens */}
              <div className="lg:col-span-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Evaluation Form</CardTitle>
                    <CardDescription>
                      Evaluate the audio file based on the criteria below
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <div className="space-y-6">
                        {/* Pillars Section */}
                        {template.pillars && template.pillars.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold mb-4">Performance Pillars</h3>
                            <div className="space-y-4">
                              {template.pillars.map((pillar: any) => (
                                <FormField
                                  key={pillar.id}
                                  control={form.control}
                                  name={`pillarScores.${pillar.id}`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <div className="flex items-center justify-between">
                                        <FormLabel className="text-base flex items-center gap-2">
                                          {pillar.name}
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Info className="h-4 w-4 text-muted-foreground" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p className="max-w-xs">{pillar.description}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </FormLabel>
                                        <div className="w-32">
                                          <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Score" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="1">1 - Poor</SelectItem>
                                              <SelectItem value="2">2 - Below Expectations</SelectItem>
                                              <SelectItem value="3">3 - Meets Expectations</SelectItem>
                                              <SelectItem value="4">4 - Exceeds Expectations</SelectItem>
                                              <SelectItem value="5">5 - Outstanding</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      <FormDescription>
                                        {pillar.description}
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Criteria Section */}
                        {template.criteria && template.criteria.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold mb-4">Evaluation Criteria</h3>
                            <Accordion type="multiple" className="w-full">
                              {template.criteria.map((criterion: any) => (
                                <AccordionItem key={criterion.id} value={criterion.id.toString()}>
                                  <AccordionTrigger className="text-base">
                                    {criterion.name}
                                    {form.watch(`criteriaScores.${criterion.id}`) && (
                                      <Badge variant="outline" className="ml-2">
                                        Score: {form.watch(`criteriaScores.${criterion.id}`)}
                                      </Badge>
                                    )}
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="space-y-4 p-2">
                                      <p className="text-sm text-muted-foreground">{criterion.description}</p>
                                      <FormField
                                        control={form.control}
                                        name={`criteriaScores.${criterion.id}`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Score</FormLabel>
                                            <FormControl>
                                              <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="flex space-x-2"
                                              >
                                                {[1, 2, 3, 4, 5].map((score) => (
                                                  <FormItem
                                                    key={score}
                                                    className="flex items-center space-x-1 space-y-0"
                                                  >
                                                    <FormControl>
                                                      <RadioGroupItem value={score.toString()} />
                                                    </FormControl>
                                                    <FormLabel className="text-sm font-normal">
                                                      {score}
                                                    </FormLabel>
                                                  </FormItem>
                                                ))}
                                              </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              ))}
                            </Accordion>
                          </div>
                        )}

                        {/* Questions Section */}
                        {template.questions && template.questions.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold mb-4">Evaluation Questions</h3>
                            <div className="space-y-6">
                              {template.questions.map((question: any) => (
                                <FormField
                                  key={question.id}
                                  control={form.control}
                                  name={`questionResponses.${question.id}`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>{question.text}</FormLabel>
                                      <FormControl>
                                        {question.type === "text" ? (
                                          <Textarea
                                            placeholder="Enter your response"
                                            className="min-h-[80px]"
                                            {...field}
                                          />
                                        ) : question.type === "yesno" ? (
                                          <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex space-x-4"
                                          >
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                              <FormControl>
                                                <RadioGroupItem value="yes" />
                                              </FormControl>
                                              <FormLabel className="font-normal">Yes</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                              <FormControl>
                                                <RadioGroupItem value="no" />
                                              </FormControl>
                                              <FormLabel className="font-normal">No</FormLabel>
                                            </FormItem>
                                          </RadioGroup>
                                        ) : question.type === "rating" ? (
                                          <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex space-x-2"
                                          >
                                            {[1, 2, 3, 4, 5].map((score) => (
                                              <FormItem
                                                key={score}
                                                className="flex items-center space-x-1 space-y-0"
                                              >
                                                <FormControl>
                                                  <RadioGroupItem value={score.toString()} />
                                                </FormControl>
                                                <FormLabel className="text-sm font-normal">
                                                  {score}
                                                </FormLabel>
                                              </FormItem>
                                            ))}
                                          </RadioGroup>
                                        ) : null}
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Overall Score and Comments */}
                        <div className="space-y-6 pt-4">
                          <FormField
                            control={form.control}
                            name="overallScore"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Overall Score</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select overall score" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="1">1 - Poor</SelectItem>
                                    <SelectItem value="2">2 - Below Expectations</SelectItem>
                                    <SelectItem value="3">3 - Meets Expectations</SelectItem>
                                    <SelectItem value="4">4 - Exceeds Expectations</SelectItem>
                                    <SelectItem value="5">5 - Outstanding</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="summary"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Summary</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Provide a brief summary of the evaluation"
                                    className="min-h-[80px]"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  A concise summary of the call and agent performance
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="feedback"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Feedback for Agent</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Provide detailed feedback for the agent"
                                    className="min-h-[120px]"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Include specific strengths, areas for improvement, and actionable suggestions
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </Form>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={() => setLocation("/audio-assignment-dashboard")}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={submitEvaluationMutation.isPending}
                    >
                      {submitEvaluationMutation.isPending
                        ? "Submitting..."
                        : "Submit Evaluation"}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}