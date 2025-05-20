import { useState, useEffect, useRef, useMemo } from "react";
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
import { usePermissions } from "@/hooks/use-permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Headphones,
  Volume2,
  FileAudio,
  Clock,
  Globe,
  Tag,
  ClipboardCheck,
  ClipboardList,
  Check,
  Search,
  Filter,
  Edit,
  Eye,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Users,
  Scale,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function ConductEvaluation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [selectedTrainee, setSelectedTrainee] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<number | null>(
    null,
  );
  const [scores, setScores] = useState<Record<number, any>>({});
  const [evaluationType, setEvaluationType] = useState<"standard" | "audio" | "completed">(
    "standard",
  );
  // Track if the evaluation is for certification purpose
  const [isCertification, setIsCertification] = useState<boolean>(false);
  
  // States for completed evaluations view
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<number | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedScores, setEditedScores] = useState<Record<number, any>>({});
  const [completedEvalType, setCompletedEvalType] = useState<"all" | "standard" | "audio">("all");
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [evaluationDetailsData, setEvaluationDetailsData] = useState<any>(null);
  const [evaluationFilters, setEvaluationFilters] = useState({
    templateId: "",
    traineeId: "",
    batchId: "",
    status: "all",
    dateRange: "all",
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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
    const batchId = params.get("batchId");
    const traineeId = params.get("traineeId");
    const typeParam = params.get("evaluationType");

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

    // Set evaluation type if provided in URL
    if (typeParam === "standard" || typeParam === "audio") {
      console.log(`Setting evaluation type from URL parameter: ${typeParam}`);
      setEvaluationType(typeParam);
    } else if (typeParam === "certification") {
      // If certification is specified, use standard type with certification flag
      console.log(`Setting evaluation type to standard with certification purpose`);
      setEvaluationType("standard");
      setIsCertification(true);
    }
    
    // Check if purpose parameter is set to certification
    const purposeParam = params.get("purpose");
    if (purposeParam === "certification") {
      console.log("Setting certification purpose flag");
      setIsCertification(true);
    }
  }, [user]);

  // Fetch active batches
  const { data: batches } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });

  // Fetch trainees for selected batch
  const { data: trainees } = useQuery({
    queryKey: [
      `/api/organizations/${user?.organizationId}/batches/${selectedBatch}/trainees`,
    ],
    enabled: !!selectedBatch && !!user?.organizationId,
  });

  // Fetch active templates
  const { data: templates } = useQuery({
    queryKey: [
      `/api/organizations/${user?.organizationId}/evaluation-templates`,
      selectedBatch, // Add selectedBatch to query key to refresh when batch changes
    ],
    select: (data) => {
      // Log all templates received from the server
      console.log("All templates:", data);
      console.log("Selected batch ID:", selectedBatch);
      
      const filteredTemplates = data.filter((t: any) => {
        // First filter by active status
        const isActive = t.status === "active";
        
        // Then filter by batch ID if one is selected
        const matchesBatch = selectedBatch 
          ? t.batchId === selectedBatch 
          : true; // If no batch selected, show all active templates
        
        // For certification purpose, filter templates that are certification templates
        const isCertificationTemplate = t.name?.toLowerCase().includes('certification') || 
          t.description?.toLowerCase().includes('certification') ||
          (t.tags && t.tags.includes('certification')) ||
          (t.metadata && t.metadata.purpose === 'certification');
        
        // If certification purpose is set, only include certification templates
        const matchesPurpose = isCertification 
          ? isCertificationTemplate
          : true; // For regular evaluations, show all templates

        // Log matching info for debugging
        if (selectedBatch) {
          console.log(`Template ${t.id} (${t.name}): Active=${isActive}, BatchID=${t.batchId}, Matches selected batch=${matchesBatch}, Certification=${isCertificationTemplate}, Matches purpose=${matchesPurpose}`);
        }
        
        return isActive && matchesBatch && matchesPurpose;
      });
      
      // Log the templates that will be shown in the dropdown
      console.log("Filtered templates for dropdown:", filteredTemplates);
      
      return filteredTemplates;
    },
    enabled: !!user?.organizationId,
  });

  // Get selected template details
  const { data: selectedTemplateDetails } = useQuery({
    queryKey: [`/api/evaluation-templates/${selectedTemplate}`],
    enabled: !!selectedTemplate,
  });

  // Query for fetching assigned audio files for the quality analyst
  const { data: assignedAudioFiles, isLoading: loadingAudioFiles } = useQuery({
    queryKey: [
      `/api/organizations/${user?.organizationId}/audio-file-allocations/assigned-to-me`,
    ],
    enabled: !!user?.organizationId && user?.role === "quality_analyst",
    // The backend now returns all files (allocated, evaluated, archived), so we need to filter here
    select: (data) => {
      if (!data) return [];
      // Only show files with status "allocated" for evaluation in the dropdown
      // Files with status "evaluated" or "archived" are filtered out here
      // Need to check BOTH allocation and file status to be "allocated"
      return data.filter((file: any) => {
        // Check allocation status
        const allocationStatus = file.status === "allocated";
        
        // Check audio file status - require it to also be "allocated"
        const fileStatus = file.audioFile && file.audioFile.status === "allocated";
        
        // Must satisfy BOTH conditions (allocation AND file must be allocated)
        return allocationStatus && fileStatus;
      });
    }
  });

  // Log the assigned audio files to help with debugging
  console.log("Assigned audio files:", assignedAudioFiles);
  
  // Query to load completed evaluations with fallback strategy
  const {
    data: evaluationsResponse,
    isLoading: loadingEvaluations,
    error: evaluationsError,
    refetch: refetchEvaluations
  } = useQuery({
    queryKey: ["/api/evaluations"],
    enabled: !!user && evaluationType === "completed",
    retry: 2,
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: false,
    // Add proper error handling
    onError: (error: any) => {
      console.error("Error loading evaluations:", error);
      toast({
        title: "Error loading evaluations",
        description: error.message || "Failed to load evaluations. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Creating a function to transform evaluation data into the format we need
  const transformEvaluationData = (evaluation: any) => {
    // Calculate if evaluation passed based on final_score and feedback_threshold
    const isPassed = evaluation.final_score >= (evaluation.feedback_threshold || 0);
    
    return {
      id: evaluation.id,
      templateId: evaluation.template_id, 
      traineeId: evaluation.trainee_id,
      batchId: evaluation.batch_id,
      createdAt: evaluation.created_at,
      finalScore: evaluation.final_score,
      evaluationType: evaluation.evaluation_type,
      isPassed: isPassed,
      audioFileId: evaluation.audio_file_id,
      // Include related entities if they exist in the evaluation object
      template: evaluation.template_name ? 
        { id: evaluation.template_id, name: evaluation.template_name } : 
        undefined,
      trainee: evaluation.trainee_name ?
        { id: evaluation.trainee_id, fullName: evaluation.trainee_name } :
        undefined,
      audioFile: evaluation.filename ? 
        { id: evaluation.audio_file_id, name: evaluation.filename } :
        undefined,
    };
  };
  
  // State variables for evaluation details are already declared above
  
  // Function to fetch evaluation details - enhanced with debug and better data handling
  const fetchEvaluationDetails = async (evaluationId: number) => {
    setLoadingDetails(true);
    setEvaluationDetailsData(null);
    
    try {
      console.log("Fetching details for evaluation ID:", evaluationId);
      
      // Use direct fetch instead of queryClient to ensure we get fresh data
      const response = await fetch(`/api/evaluations/${evaluationId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch evaluation details: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Evaluation details raw response:", data);
      
      // Check if we have the expected data structure with evaluation data
      if (!data || !data.evaluation) {
        console.error("Invalid response structure - missing evaluation data");
        throw new Error("Failed to load evaluation data");
      }
      
      // Process the evaluation details to group scores by pillar
      if (data.evaluation.scores && data.evaluation.scores.length > 0) {
        console.log("Processing scores for grouping, found", data.evaluation.scores.length, "scores");
        const groupedScores: any[] = [];
        const scoresByPillar: Record<string, any[]> = {};
        
        // Group scores by pillar ID
        data.evaluation.scores.forEach((score: any) => {
          const pillarId = score.parameter?.pillarId;
          const key = pillarId ? pillarId.toString() : 'unassigned';
          
          if (!scoresByPillar[key]) {
            scoresByPillar[key] = [];
          }
          scoresByPillar[key].push(score);
        });
        
        // Create the grouped structure
        Object.entries(scoresByPillar).forEach(([pillarIdStr, scores]) => {
          // Skip the 'unassigned' key if it's empty
          if (pillarIdStr === 'unassigned' && scores.length === 0) {
            return;
          }
          
          if (pillarIdStr !== 'unassigned') {
            const pillarId = parseInt(pillarIdStr);
            const pillar = data.evaluation.template?.pillars?.find(
              (p: any) => p.id === pillarId
            );
            
            groupedScores.push({
              pillar: pillar || { id: pillarId, name: `Section ${pillarId}` },
              scores: scores
            });
          } else {
            // Add unassigned scores as a separate group
            groupedScores.push({
              pillar: null,
              scores: scores
            });
          }
        });
        
        console.log("Created grouped scores structure with", groupedScores.length, "groups");
        setEvaluationDetailsData({
          evaluation: data.evaluation,
          groupedScores
        });
      } else {
        console.log("No scores found in evaluation data, using empty groupedScores");
        setEvaluationDetailsData({ 
          evaluation: data.evaluation, 
          groupedScores: [] 
        });
      }
      
      // If this was called when opening the View Dialog, make sure it's open
      if (selectedEvaluationId === evaluationId) {
        setDetailsDialogOpen(true);
      }
    } catch (error) {
      console.error("Error fetching evaluation details:", error);
      toast({
        title: "Error",
        description: "Failed to load evaluation details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingDetails(false);
    }
  };
  
  // We're using direct onClick handlers in the button, so this function is not needed

  // Process evaluations data to ensure we have a valid array
  const evaluations = useMemo(() => {
    // Log the response to diagnose the issue
    console.log("Evaluations API response:", evaluationsResponse);
    
    try {
      // First try to use the real API data
      if (evaluationsResponse) {
        // Handle potential data structure differences
        if (Array.isArray(evaluationsResponse)) {
          console.log("Processing array of evaluations, length:", evaluationsResponse.length);
          return evaluationsResponse.map(item => {
            console.log("Processing evaluation item:", item);
            return {
              id: item.id,
              evaluationType: item.evaluation_type || "standard",
              templateId: item.template_id,
              templateName: item.template_name,
              traineeId: item.trainee_id,
              trainee: item.trainee_name ? { 
                fullName: item.trainee_name,
                id: item.trainee_id
              } : undefined,
              audioFileId: item.audio_file_id,
              finalScore: item.final_score || 0,
              createdAt: item.created_at,
              status: item.status || "completed",
              isPassed: (item.final_score || 0) >= (item.feedback_threshold || 0)
            };
          });
        }
        
        if (evaluationsResponse.evaluations && Array.isArray(evaluationsResponse.evaluations)) {
          console.log("Processing evaluations from object with 'evaluations' property");
          return evaluationsResponse.evaluations.map(item => ({
            id: item.id,
            evaluationType: item.evaluation_type || "standard",
            templateId: item.template_id,
            templateName: item.template_name,
            traineeId: item.trainee_id,
            trainee: item.trainee_name ? { 
              fullName: item.trainee_name,
              id: item.trainee_id
            } : undefined,
            audioFileId: item.audio_file_id,
            finalScore: item.final_score || 0,
            createdAt: item.created_at,
            status: item.status || "completed",
            isPassed: (item.final_score || 0) >= (item.feedback_threshold || 0)
          }));
        }
        
        // Add additional debug info
        console.log("Evaluations response type:", typeof evaluationsResponse);
        console.log("Response keys:", Object.keys(evaluationsResponse));
        
        // If it's an object with evaluations inside
        if (typeof evaluationsResponse === 'object') {
          const values = Object.values(evaluationsResponse);
          console.log("Object values length:", values.length);
          if (values.length > 0) {
            console.log("First value type:", typeof values[0], "Sample:", values[0]);
            if (typeof values[0] === 'object') {
              return values.map(item => ({
                id: item.id,
                evaluationType: item.evaluation_type || "standard",
                templateId: item.template_id,
                templateName: item.template_name,
                traineeId: item.trainee_id,
                trainee: item.trainee_name ? { 
                  fullName: item.trainee_name,
                  id: item.trainee_id
                } : undefined,
                audioFileId: item.audio_file_id,
                finalScore: item.final_score || 0,
                createdAt: item.created_at,
                status: item.status || "completed",
                isPassed: (item.final_score || 0) >= (item.feedback_threshold || 0)
              }));
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing evaluations data:", error);
    }
    
    // Return empty array if we couldn't extract data
    console.log("No valid evaluations data found, returning empty array");
    return [];
  }, [evaluationsResponse]);
  
  // Query for selected evaluation details
  const {
    data: evaluationDetails,
    isLoading: isLoadingDetails,
    error: detailsError,
    refetch: refetchEvaluationDetails
  } = useQuery({
    queryKey: ["/api/evaluations", selectedEvaluationId],
    enabled: !!selectedEvaluationId && (isViewDialogOpen || isEditDialogOpen),
    onSuccess: (data) => {
      console.log("Evaluation details loaded:", data);
      
      // Store the evaluation data in the correct format
      if (data?.evaluation) {
        // Create groupedScores structure from evaluation scores
        if (data.evaluation.scores && data.evaluation.scores.length > 0) {
          console.log("Processing scores for grouping, found", data.evaluation.scores.length, "scores");
          const groupedScores: any[] = [];
          const scoresByPillar: Record<string, any[]> = {};
          
          // Group scores by pillar ID
          data.evaluation.scores.forEach((score: any) => {
            const pillarId = score.parameter?.pillarId;
            const key = pillarId ? pillarId.toString() : 'unassigned';
            
            if (!scoresByPillar[key]) {
              scoresByPillar[key] = [];
            }
            scoresByPillar[key].push(score);
          });
          
          // Create the grouped structure
          Object.entries(scoresByPillar).forEach(([pillarIdStr, scores]) => {
            // Skip the 'unassigned' key if it's empty
            if (pillarIdStr === 'unassigned' && scores.length === 0) {
              return;
            }
            
            if (pillarIdStr !== 'unassigned') {
              const pillarId = parseInt(pillarIdStr);
              const pillar = data.evaluation.template?.pillars?.find(
                (p: any) => p.id === pillarId
              );
              
              groupedScores.push({
                pillar: pillar || { id: pillarId, name: `Section ${pillarId}` },
                scores: scores
              });
            } else {
              // Add unassigned scores as a separate group
              groupedScores.push({
                pillar: null,
                scores: scores
              });
            }
          });
          
          setEvaluationDetailsData({
            evaluation: data.evaluation,
            groupedScores
          });
        } else {
          // If no scores found, set empty groupedScores
          setEvaluationDetailsData({
            evaluation: data.evaluation,
            groupedScores: []
          });
        }
      }
      
      // Log details about the template structure
      if (data?.evaluation?.template) {
        console.log("Template data:", data.evaluation.template);
        console.log("Template parameters:", data.evaluation.template.parameters?.length || 0);
      }
      
      // Log more details about the evaluation scores
      if (data?.evaluation?.scores) {
        console.log("Scores loaded:", data.evaluation.scores.length);
      }
    }
  });
  
  // Mutation for updating an evaluation
  const updateEvaluationMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`/api/evaluations/${data.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update evaluation");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/evaluations"] });
      
      toast({
        title: "Evaluation updated",
        description: "The evaluation has been updated successfully.",
      });
      
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error updating evaluation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get audio file details when selected
  // Fetch audio file details
  const { data: selectedAudioFileDetails } = useQuery({
    queryKey: [
      `/api/organizations/${user?.organizationId}/audio-files/${selectedAudioFile}`,
    ],
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
            throw new Error("Failed to fetch audio file details");
          }
          return response.json();
        },
      });
    },
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
          description:
            "Received an empty response when requesting audio access. Please try again.",
        });
        return;
      }

      if (!data.sasUrl) {
        console.error("SAS URL is missing in response:", data);
        toast({
          variant: "destructive",
          title: "Audio Access Error",
          description:
            "The secure access URL is missing or invalid. Please select the file again.",
        });
        return;
      }

      console.log(
        "Setting audio URL to SAS URL for file ID:",
        selectedAudioFile,
      );

      // Log the received SAS URL (without showing sensitive parts)
      const sasUrlParts = data.sasUrl.split("?");
      const baseUrl = sasUrlParts[0];
      const truncatedToken =
        sasUrlParts.length > 1
          ? sasUrlParts[1].substring(0, Math.min(20, sasUrlParts[1].length)) +
            "..."
          : "";
      console.log(
        `SAS URL contains base: ${baseUrl} and token: ${truncatedToken}`,
      );

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
              audioRef.current.setAttribute("type", data.fileInfo.type);
            } catch (typeError) {
              console.warn("Error setting audio type attribute:", typeError);
              // Non-critical error, continue
            }
          }

          // Configure error handling for the audio element
          audioRef.current.onerror = (e) => {
            const error = audioRef.current?.error;
            const errorMessage = error
              ? `Code: ${error.code}, Message: ${error.message}`
              : "Unknown audio error";

            console.error("Audio error:", errorMessage, e);

            // Log detailed error information for debugging
            if (error) {
              switch (error.code) {
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
              description: `There was a problem playing this audio file. Please try again.`,
            });
          };

          // Use a small timeout to ensure state updates before loading the audio
          setTimeout(() => {
            if (audioRef.current) {
              try {
                audioRef.current.load();
                console.log(
                  "Audio element loaded with new SAS URL for file ID:",
                  selectedAudioFile,
                );
              } catch (loadError) {
                console.error(
                  "Error loading audio with new SAS URL:",
                  loadError,
                );
                toast({
                  variant: "destructive",
                  title: "Audio Loading Error",
                  description:
                    "Error loading the audio file. Please try selecting it again.",
                });
              }
            }
          }, 200); // Increased timeout to ensure DOM updates
        } catch (pauseError) {
          console.error(
            "Error pausing audio before setting new SAS URL:",
            pauseError,
          );
          // Continue anyway since we're replacing the URL
          setAudioUrl(data.sasUrl);
        }
      } else {
        console.log("Audio ref not available, just setting the URL state");
        setAudioUrl(data.sasUrl);
      }
    },
    onError: (error) => {
      console.error(
        "Error generating SAS URL for file ID:",
        selectedAudioFile,
        error,
      );
      toast({
        variant: "destructive",
        title: "Audio Access Error",
        description: `Could not generate secure access URL for the audio file: ${error.message}. Please try selecting a different file.`,
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
      // Use different endpoints based on evaluation type
      const endpoint = evaluationType === "audio" 
        ? "/api/audio-evaluations" 
        : "/api/evaluations";
        
      console.log(`Submitting ${evaluationType} evaluation to ${endpoint}`);
      
      // For certification evaluations, we use the same endpoint and type as standard evaluations
      // but we track whether it's a certification in the UI state
      if (isCertification) {
        // Make sure we're using standard type for certification purpose
        evaluation.evaluationType = "standard"; 
        // Add metadata to help identify certifications in reports
        evaluation.purpose = "certification";
        evaluation.isCertification = true; // Add a flag (this won't be used by DB directly)
        console.log("Marking standard evaluation as certification purpose:", evaluation);
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      if (evaluationType === "audio") {
        // For audio evaluations, immediately update the local cache to remove the submitted file
        // This prevents the need to wait for a server roundtrip to see the update
        queryClient.setQueryData(
          [`/api/organizations/${user?.organizationId}/audio-file-allocations/assigned-to-me`],
          (oldData: any) => {
            if (!oldData) return [];
            
            // Filter out the file that was just evaluated
            return oldData.filter((file: any) => 
              (file.audioFileId || file.id) !== selectedAudioFile
            );
          }
        );
        
        // Also invalidate the queries to ensure data consistency with the server
        queryClient.invalidateQueries({
          queryKey: [
            `/api/organizations/${user?.organizationId}/audio-file-allocations/assigned-to-me`,
          ],
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
      } else if (isCertification) {
        // For certification purpose evaluations
        queryClient.invalidateQueries({
          queryKey: [`/api/organizations/${user?.organizationId}/evaluations`],
        });
        
        // Also invalidate certification-specific queries
        queryClient.invalidateQueries({
          queryKey: [`/api/organizations/${user?.organizationId}/batches/${selectedBatch}/certification-evaluations`]
        });
        
        // Update trainee records as certification may change their status
        queryClient.invalidateQueries({
          queryKey: [`/api/organizations/${user?.organizationId}/batches/${selectedBatch}/trainees`]
        });
        
        toast({
          title: "Success",
          description: "Certification evaluation submitted successfully",
        });
        
        // Reset form state
        setScores({});
        setSelectedBatch(null);
        setSelectedTrainee(null);
        setSelectedTemplate(null);
        
        // Navigate back to the previous page after a short delay to allow toast to be visible
        setTimeout(() => {
          // Check if we came from a specific page
          const referrer = document.referrer;
          if (referrer && referrer.includes('trainee-management')) {
            // Go back to the previous page
            window.history.back();
          } else {
            // Or navigate to a specific path
            navigate('/trainee-management');
          }
        }, 1500); // 1.5 second delay
      } else {
        // For standard evaluations
        queryClient.invalidateQueries({
          queryKey: [`/api/organizations/${user?.organizationId}/evaluations`],
        });
        toast({
          title: "Success",
          description: "Evaluation submitted successfully",
        });
        
        // Reset form state
        setScores({});
        setSelectedBatch(null);
        setSelectedTrainee(null);
        setSelectedTemplate(null);
        
        // Navigate back to the previous page (assessment section) after a short delay to allow toast to be visible
        setTimeout(() => {
          // Check if we came from a specific page
          const referrer = document.referrer;
          if (referrer && referrer.includes('trainee-management')) {
            // Go back to the previous page
            window.history.back();
          } else {
            // Or navigate to a specific path
            navigate('/trainee-management');
          }
        }, 1500); // 1.5 second delay
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

  // This mutation is no longer needed as we're using the audio-evaluations endpoint
  // which already updates the audio file status
  // Keeping reference here but it's not used anymore

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
  
  // Function is already declared above, removing duplicate

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

  // Check if all parameters have been rated
  const validateAllParametersRated = () => {
    if (!selectedTemplateDetails) return false;
    
    const missingParameters: string[] = [];
    
    // Check each parameter in each pillar
    selectedTemplateDetails.pillars.forEach((pillar: any) => {
      pillar.parameters.forEach((param: any) => {
        const parameterId = param.id;
        
        // For Yes/No/NA type parameters
        if (param.ratingType === 'yes_no_na') {
          // Check if this parameter has a score (yes, no, or na)
          if (!scores[parameterId] || !scores[parameterId].score || 
              !['yes', 'no', 'na'].includes(scores[parameterId].score)) {
            missingParameters.push(param.name || `Parameter #${parameterId}`);
          }
        } 
        // For other rating types (numerical, etc.)
        else {
          // Check if this parameter has a score
          if (!scores[parameterId] || !scores[parameterId].score) {
            missingParameters.push(param.name || `Parameter #${parameterId}`);
          }
        }
      });
    });
    
    console.log('Missing parameters:', missingParameters);
    console.log('Current scores:', scores);
    
    return {
      isValid: missingParameters.length === 0,
      missingParameters
    };
  };

  // Confirmation state for dialog
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingEvaluation, setPendingEvaluation] = useState<any>(null);

  const handleSubmit = () => {
    if (!selectedBatch || !selectedTrainee || !selectedTemplate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select batch, trainee and template",
      });
      return;
    }

    // Validate all parameters are rated
    const validation = validateAllParametersRated();
    if (!validation.isValid) {
      toast({
        variant: "destructive",
        title: "Incomplete Evaluation",
        description: `Please select Yes, No, or NA for all parameters. Missing: ${validation.missingParameters.slice(0, 3).join(", ")}${validation.missingParameters.length > 3 ? ` and ${validation.missingParameters.length - 3} more...` : ""}`,
      });
      return;
    }

    // Create evaluation object
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

    // Store evaluation and show confirmation dialog
    setPendingEvaluation(evaluation);
    setShowConfirmation(true);
  };

  // Function to submit after confirmation
  const confirmAndSubmit = () => {
    if (pendingEvaluation) {
      submitEvaluationMutation.mutate(pendingEvaluation);
      setShowConfirmation(false);
    }
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
        hasAudioUrl: !!audioUrl,
      });

      toast({
        variant: "destructive",
        title: "Playback Error",
        description:
          "Audio file not loaded or unavailable. Please try selecting a different file.",
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
          readyState: audioRef.current.readyState,
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
            await new Promise((resolve) => setTimeout(resolve, 500));
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
              description:
                "The audio is taking too long to start. Refreshing the player...",
              duration: 3000,
            });
          }
        }, 3000); // 3 second timeout

        // Attempt to play the audio
        try {
          console.log(
            "Attempting to play audio from URL:",
            audioUrl ? audioUrl.substring(0, 100) + "..." : "No URL available",
          );

          // Check audio readiness before playing
          if (audioRef.current.readyState === 0) {
            console.log("Audio not ready, loading...");
            // Force load the audio
            audioRef.current.load();
            // Wait a moment for loading to initialize
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

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
          if (selectedAudioFile && audioUrl && audioUrl.includes("sig=")) {
            console.log(
              "Detected potential SAS token issue, requesting new token",
            );
            
            // Inform user we're refreshing the token
            toast({
              title: "Refreshing Audio Access",
              description:
                "Audio access may have expired. Refreshing connection...",
              duration: 5000,
            });
            
            // Clear current audio URL first
            setAudioUrl(null);
            
            // Allow state update to complete
            setTimeout(() => {
              console.log("Requesting fresh SAS token for file:", selectedAudioFile);
              
              // Force refresh the query to get a new SAS URL
              queryClient.invalidateQueries({
                queryKey: [`/api/azure-audio-sas/${selectedAudioFile}`],
                exact: true,
              });
              
              // After invalidating, manually refetch to ensure we get a new token
              queryClient.fetchQuery({
                queryKey: [`/api/azure-audio-sas/${selectedAudioFile}`],
                staleTime: 0,
              })
              .then((response: any) => {
                console.log("Successfully refreshed SAS token");
                // Handle successful token refresh
                if (response && response.sasUrl) {
                  // Set the new URL
                  setAudioUrl(response.sasUrl);
                  
                  // Wait for state update then load and play
                  setTimeout(() => {
                    if (audioRef.current) {
                      audioRef.current.load();
                      console.log("Audio element reloaded with fresh token");
                      
                      // Try to play after a brief delay to allow loading
                      setTimeout(() => {
                        if (audioRef.current) {
                          audioRef.current.play()
                            .then(() => console.log("Auto-play after token refresh succeeded"))
                            .catch(err => console.warn("Auto-play after token refresh failed:", err));
                        }
                      }, 1000);
                    }
                  }, 200);
                }
              })
              .catch(error => {
                console.error("Failed to fetch new SAS token:", error);
                toast({
                  variant: "destructive",
                  title: "Token Refresh Failed",
                  description: "Could not refresh audio access. Please try again.",
                });
              });
            }, 500);
          } else {
            // Try to provide more specific error messaging
            const errorMessage =
              playError instanceof Error
                ? playError.message
                : "Unknown playback error";
            let specificMessage =
              "Could not play the audio file. Try selecting it again or refresh the page.";

            // More specific error messaging based on common issues
            if (
              errorMessage.includes("network") ||
              errorMessage.includes("fetch")
            ) {
              specificMessage =
                "Network error loading audio. Check your internet connection and try again.";
            } else if (
              errorMessage.includes("format") ||
              errorMessage.includes("decode")
            ) {
              specificMessage =
                "Audio format error. The file may be corrupted or in an unsupported format.";
            } else if (errorMessage.includes("aborted")) {
              specificMessage = "Audio playback was aborted. Please try again.";
            }

            // Display the error to the user
            toast({
              variant: "destructive",
              title: "Playback Error",
              description: specificMessage,
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
          console.error(
            "Failed to reload audio element during recovery:",
            reloadError,
          );
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

    // Validate all parameters are rated
    const validation = validateAllParametersRated();
    if (!validation || !validation.isValid) {
      toast({
        variant: "destructive",
        title: "Incomplete Evaluation",
        description: `Please select Yes, No, or NA for all parameters. Missing: ${validation?.missingParameters?.slice(0, 3).join(", ")}${validation?.missingParameters?.length > 3 ? ` and ${validation.missingParameters.length - 3} more...` : ""}`,
      });
      return;
    }
    
    // Calculate final score
    const finalScore = calculateScore();
    
    const evaluation = {
      templateId: selectedTemplate,
      audioFileId: selectedAudioFile,
      evaluatorId: user?.id,
      scores: Object.entries(scores).map(([parameterId, value]) => ({
        parameterId: parseInt(parameterId),
        ...value,
      })),
      finalScore: finalScore,
    };

    // Store evaluation and show confirmation dialog
    setPendingEvaluation(evaluation);
    setShowConfirmation(true);
  };

  // Format time display for audio player
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Evaluation Submission</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to submit an evaluation with a final score of <strong>{calculateScore()}%</strong>.
              <div className="mt-4 p-3 border rounded bg-muted/30">
                <h4 className="font-medium mb-2">Evaluation Summary:</h4>
                <ul className="space-y-1 text-sm">
                  <li><span className="font-medium">Template:</span> {selectedTemplateDetails?.name}</li>
                  <li><span className="font-medium">Trainee:</span> {trainees?.find((t: any) => t.id === selectedTrainee)?.fullName}</li>
                  <li><span className="font-medium">Parameters Rated:</span> {Object.keys(scores).length} / {selectedTemplateDetails?.pillars?.reduce((acc: number, pillar: any) => acc + pillar.parameters.length, 0)}</li>
                </ul>
              </div>
              <p className="mt-4">Are you sure you want to submit this evaluation?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndSubmit} className="bg-primary">
              {submitEvaluationMutation.isPending ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Submitting...
                </>
              ) : (
                "Confirm Submission"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Tabs
        defaultValue="standard"
        onValueChange={(value) =>
          setEvaluationType(value as "standard" | "audio" | "completed")
        }
      >
        <TabsList className="mb-4">
          <TabsTrigger value="standard">Standard Evaluation</TabsTrigger>
          <TabsTrigger value="audio">Audio Evaluation</TabsTrigger>
          <TabsTrigger value="completed">Completed Evaluations</TabsTrigger>
        </TabsList>

        <TabsContent value="standard" className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">
              {isCertification ? "Conduct Certification Evaluation" : "Conduct Standard Evaluation"}
            </h1>
            <div className="flex gap-4">
              {/* Batch Selection */}
              <div className="w-[200px]">
                <Select
                  onValueChange={handleBatchChange}
                  value={selectedBatch?.toString()}
                >
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
                      <SelectItem
                        key={trainee.id}
                        value={trainee.id.toString()}
                      >
                        {trainee.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Selection - Only enabled if trainee is selected */}
              <div className="w-[200px]">
                <Select
                  onValueChange={(value) =>
                    setSelectedTemplate(parseInt(value))
                  }
                  value={selectedTemplate?.toString()}
                  disabled={!selectedTrainee}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template: any) => (
                      <SelectItem
                        key={template.id}
                        value={template.id.toString()}
                      >
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Standard Evaluation Form - Only show after selections */}
          {selectedBatch && selectedTrainee && selectedTemplate && selectedTemplateDetails && (
            <div className="mt-6">
              <Card className="border-primary/10">
                <CardHeader className="bg-primary/5 border-b border-primary/10 pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-primary" />
                      <span>{isCertification ? "Certification Form" : "Evaluation Form"}</span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-normal">
                        Final Score: {calculateScore()}%
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    {selectedTemplateDetails.description ||
                      "Please complete all required fields below for a thorough evaluation"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="text-sm px-4 py-3 bg-muted/30 border-b">
                    <strong>Template:</strong> {selectedTemplateDetails.name}
                  </div>
                  <div className="p-4">
                    <Accordion type="multiple" className="space-y-4">
                      {selectedTemplateDetails.pillars.map((pillar: any) => (
                        <AccordionItem
                          key={pillar.id}
                          value={pillar.id.toString()}
                          className="border border-border rounded-md overflow-hidden"
                        >
                          <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 [&[data-state=open]]:bg-muted/30">
                            <div className="flex gap-2 items-center">
                              <span className="font-medium">{pillar.name}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-0 mt-0">
                            <div className="divide-y border-t">
                              {pillar.parameters.map((param: any) => (
                                <div
                                  key={param.id}
                                  className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4"
                                >
                                  <div className="lg:col-span-5 space-y-1">
                                    <div className="font-medium">{param.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {param.description}
                                    </div>
                                    {param.weightageEnabled && (
                                      <Badge variant="outline" className="mt-1">
                                        Weightage: {param.weightage}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="lg:col-span-7 space-y-3">
                                    {param.ratingType === "yes_no_na" ? (
                                      <div className="flex gap-3 flex-wrap">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="radio"
                                            id={`${param.id}-yes`}
                                            name={`param-${param.id}`}
                                            value="yes"
                                            className="h-4 w-4 accent-primary"
                                            onChange={() =>
                                              handleScoreChange(param.id, "yes")
                                            }
                                            checked={scores[param.id]?.score === "yes"}
                                          />
                                          <label
                                            htmlFor={`${param.id}-yes`}
                                            className="text-sm font-medium"
                                          >
                                            Yes
                                          </label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="radio"
                                            id={`${param.id}-no`}
                                            name={`param-${param.id}`}
                                            value="no"
                                            className="h-4 w-4 accent-primary"
                                            onChange={() =>
                                              handleScoreChange(param.id, "no")
                                            }
                                            checked={scores[param.id]?.score === "no"}
                                          />
                                          <label
                                            htmlFor={`${param.id}-no`}
                                            className="text-sm font-medium"
                                          >
                                            No
                                          </label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="radio"
                                            id={`${param.id}-na`}
                                            name={`param-${param.id}`}
                                            value="na"
                                            className="h-4 w-4 accent-primary"
                                            onChange={() =>
                                              handleScoreChange(param.id, "na")
                                            }
                                            checked={scores[param.id]?.score === "na"}
                                          />
                                          <label
                                            htmlFor={`${param.id}-na`}
                                            className="text-sm font-medium"
                                          >
                                            N/A
                                          </label>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex gap-3 flex-wrap">
                                        {[1, 2, 3, 4, 5].map((score) => (
                                          <div
                                            key={score}
                                            className="flex items-center gap-2"
                                          >
                                            <input
                                              type="radio"
                                              id={`${param.id}-${score}`}
                                              name={`param-${param.id}`}
                                              value={score.toString()}
                                              className="h-4 w-4 accent-primary"
                                              onChange={() =>
                                                handleScoreChange(
                                                  param.id,
                                                  score.toString()
                                                )
                                              }
                                              checked={
                                                scores[param.id]?.score ===
                                                score.toString()
                                              }
                                            />
                                            <label
                                              htmlFor={`${param.id}-${score}`}
                                              className="text-sm font-medium"
                                            >
                                              {score}
                                            </label>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* "No" Reason Selection */}
                                    {param.ratingType === "yes_no_na" &&
                                      scores[param.id]?.score === "no" && (
                                        <div className="pt-3 space-y-2">
                                          <Label
                                            htmlFor={`${param.id}-no-reason`}
                                            className="text-sm"
                                          >
                                            Reason for "No":
                                          </Label>
                                          <Select
                                            onValueChange={(value) =>
                                              handleNoReasonSelect(param.id, value)
                                            }
                                            value={scores[param.id]?.noReason}
                                          >
                                            <SelectTrigger id={`${param.id}-no-reason`}>
                                              <SelectValue placeholder="Select reason" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="missed">
                                                Missed requirement
                                              </SelectItem>
                                              <SelectItem value="incorrect">
                                                Incorrect implementation
                                              </SelectItem>
                                              <SelectItem value="incomplete">
                                                Incomplete implementation
                                              </SelectItem>
                                              <SelectItem value="other">
                                                Other (specify in comments)
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      )}

                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`${param.id}-comment`}
                                        className="text-sm"
                                      >
                                        Comments:
                                      </Label>
                                      <Textarea
                                        id={`${param.id}-comment`}
                                        placeholder="Enter your comments here"
                                        value={scores[param.id]?.comment || ""}
                                        onChange={(e) =>
                                          handleCommentChange(param.id, e.target.value)
                                        }
                                        className="h-20 resize-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t bg-muted/20 py-3">
                  <Button
                    onClick={handleSubmit}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Submit Evaluation
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audio" className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Headphones className="h-6 w-6 text-primary" />
              <span>Conduct Audio Evaluation</span>
            </h1>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              {/* Audio File Selection */}
              <div className="w-full sm:w-[280px]">
                <Label htmlFor="audio-file-select" className="mb-1.5 block text-sm font-medium">
                  Audio File
                </Label>
                <Select
                  onValueChange={handleAudioFileSelect}
                  value={selectedAudioFile?.toString()}
                >
                  <SelectTrigger id="audio-file-select" className="bg-background">
                    <SelectValue placeholder="Select Audio File" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedAudioFiles && assignedAudioFiles.length > 0 ? (
                      assignedAudioFiles.map((file: any) => (
                        <SelectItem
                          key={file.audioFileId || file.id}
                          value={(file.audioFileId || file.id).toString()}
                        >
                          Audio File #{file.audioFileId || file.id}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-files" disabled>
                        No audio files assigned
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Selection */}
              <div className="w-full sm:w-[240px]">
                <Label htmlFor="template-select" className="mb-1.5 block text-sm font-medium">
                  Evaluation Template
                </Label>
                <Select
                  onValueChange={(value) =>
                    setSelectedTemplate(parseInt(value))
                  }
                  value={selectedTemplate?.toString()}
                  disabled={!selectedAudioFile}
                >
                  <SelectTrigger id="template-select" className="bg-background">
                    <SelectValue placeholder="Select Template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template: any) => (
                      <SelectItem
                        key={template.id}
                        value={template.id.toString()}
                      >
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Audio Player Section */}
            <div className="lg:col-span-5">
              {selectedAudioFileDetails ? (
                <Card className="overflow-hidden border-primary/10">
                  <CardHeader className="bg-primary/5 border-b border-primary/10 pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileAudio className="h-5 w-5 text-primary" />
                      <span className="truncate">
                        Audio File #{selectedAudioFileDetails.id}
                      </span>
                    </CardTitle>
                    <CardDescription className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      <span className="flex items-center">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        <span>{formatTime(duration || 0)}</span>
                      </span>
                      <span className="flex items-center">
                        <Globe className="h-3.5 w-3.5 mr-1" />
                        <span>{selectedAudioFileDetails.language || "Unknown"}</span>
                      </span>
                      <span className="flex items-center">
                        <Tag className="h-3.5 w-3.5 mr-1" />
                        <span>{selectedAudioFileDetails.version || "N/A"}</span>
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    {/* File Metadata */}
                    {selectedAudioFileDetails.callMetrics && (
                      <div className="mb-4 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                        {Object.entries(selectedAudioFileDetails.callMetrics)
                          .filter(([key]) => key !== 'auditRole' && key !== 'formName')
                          .slice(0, 6)
                          .map(([key, value]) => (
                            <div key={key} className="overflow-hidden">
                              <span className="block text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <span className="font-medium truncate block">{value?.toString() || 'N/A'}</span>
                            </div>
                          ))}
                      </div>
                    )}

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
                          audioUrl: audioUrl?.substring(0, 100) + "...",
                          selectedAudioFile,
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
                        } else if (
                          errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
                        ) {
                          errorType = "format";
                        } else if (errorCode === MediaError.MEDIA_ERR_DECODE) {
                          errorType = "decode";
                        }

                        // Is this likely a SAS token expiration issue?
                        const isSasError =
                          errorType === "network" ||
                          errorType === "format" ||
                          (audioUrl &&
                            audioUrl.includes("sig=") &&
                            audioUrl.includes("se="));

                        if (isSasError && selectedAudioFile) {
                          console.log(
                            "Detected potential SAS token expiration for file:",
                            selectedAudioFile,
                            "Error type:",
                            errorType
                          );

                          // Inform user we're refreshing the audio access
                          toast({
                            title: "Audio Access Expired",
                            description:
                              "The secure access link has expired. Refreshing audio access...",
                            duration: 3000,
                          });

                          // Clear current audio URL first
                          setAudioUrl(null);
                          
                          // Allow state update to complete
                          setTimeout(() => {
                            console.log("Requesting fresh SAS token for file:", selectedAudioFile);
                            
                            // Force refresh the query to get a new SAS URL
                            queryClient.invalidateQueries({
                              queryKey: [
                                `/api/azure-audio-sas/${selectedAudioFile}`,
                              ],
                              exact: true,
                            });
                            
                            // After invalidating, manually refetch to ensure we get a new token
                            queryClient.fetchQuery({
                              queryKey: [`/api/azure-audio-sas/${selectedAudioFile}`],
                              staleTime: 0,
                            })
                            .then((response: any) => {
                              console.log("Successfully refreshed SAS token");
                              // Handle successful token refresh
                              if (response && response.sasUrl) {
                                // Set the new URL
                                setAudioUrl(response.sasUrl);
                                
                                // Wait for state update then load and play
                                setTimeout(() => {
                                  if (audioRef.current) {
                                    audioRef.current.load();
                                    console.log("Audio element reloaded with fresh token");
                                    
                                    // Try to play after a brief delay to allow loading
                                    setTimeout(() => {
                                      if (audioRef.current) {
                                        audioRef.current.play()
                                          .then(() => console.log("Auto-play after token refresh succeeded"))
                                          .catch(err => console.warn("Auto-play after token refresh failed:", err));
                                      }
                                    }, 1000);
                                  }
                                }, 200);
                              }
                            })
                            .catch(error => {
                              console.error("Failed to fetch new SAS token:", error);
                              toast({
                                variant: "destructive",
                                title: "Token Refresh Failed",
                                description: "Could not refresh audio access. Please try again.",
                              });
                            });
                          }, 500);
                        } else if (
                          errorType === "format" ||
                          errorType === "decode"
                        ) {
                          // This is likely a file format issue
                          toast({
                            variant: "destructive",
                            title: "Audio Format Error",
                            description:
                              "This audio file format is not supported by your browser. Try using a different browser or contact support.",
                          });
                        } else {
                          // Generic error message for other issues
                          toast({
                            variant: "destructive",
                            title: "Audio Playback Error",
                            description:
                              "Could not play the audio file. Try selecting it again or contact support if the issue persists.",
                          });
                        }

                        // Always ensure we're in a non-playing state after an error
                        setIsPlaying(false);
                      }}
                      preload="auto"
                      controls
                      style={{ display: "none" }}
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
                          <p>
                            Your browser doesn't support HTML5 audio. Here is a{" "}
                            <a
                              href={audioUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              link to the audio
                            </a>{" "}
                            instead.
                          </p>
                        </>
                      )}
                    </audio>

                    {/* Enhanced audio player UI */}
                    <div className="rounded-lg border bg-card p-4 shadow-sm">
                      {/* Waveform visualization placeholder */}
                      <div className="relative h-16 mb-2 bg-muted/30 rounded overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div
                            className="h-full bg-primary/20 transition-all"
                            style={{
                              width: `${(currentTime / (duration || 1)) * 100}%`,
                            }}
                          ></div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          {!audioUrl ? (
                            <Spinner className="h-6 w-6" />
                          ) : !isPlaying ? (
                            <div className="text-sm text-muted-foreground">
                              Click play to start audio
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Time indicators */}
                      <div className="flex items-center justify-between mb-1.5 text-xs text-muted-foreground">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>

                      {/* Playback progress slider */}
                      <Slider
                        value={[currentTime]}
                        max={duration || 100}
                        step={0.1}
                        onValueChange={handleSliderChange}
                        className="w-full mb-4"
                      />

                      {/* Controls */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              if (audioRef.current) {
                                audioRef.current.currentTime = Math.max(
                                  0,
                                  currentTime - 10,
                                );
                              }
                            }}
                            className="h-8 w-8 rounded-full"
                            aria-label="Rewind 10 seconds"
                            title="Rewind 10 seconds"
                          >
                            <SkipBack className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="default"
                            size="icon"
                            onClick={handlePlayPause}
                            className="h-10 w-10 rounded-full"
                            aria-label={isPlaying ? "Pause" : "Play"}
                          >
                            {isPlaying ? (
                              <Pause className="h-5 w-5" />
                            ) : (
                              <Play className="h-5 w-5 ml-0.5" />
                            )}
                          </Button>

                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              if (audioRef.current) {
                                audioRef.current.currentTime = Math.min(
                                  duration,
                                  currentTime + 10,
                                );
                              }
                            }}
                            className="h-8 w-8 rounded-full"
                            aria-label="Forward 10 seconds"
                            title="Forward 10 seconds"
                          >
                            <SkipForward className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Volume2 className="h-4 w-4 text-muted-foreground" />
                          <Slider
                            value={[volume]}
                            max={1}
                            step={0.01}
                            onValueChange={handleVolumeChange}
                            className="w-24"
                            aria-label="Volume"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Keyboard shortcuts */}
                    <div className="mt-3 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      <span className="flex items-center">
                        <kbd className="px-1 bg-muted rounded text-[10px] mr-1">Space</kbd> Play/Pause
                      </span>
                      <span className="flex items-center">
                        <kbd className="px-1 bg-muted rounded text-[10px] mr-1">←</kbd> Rewind 10s
                      </span>
                      <span className="flex items-center">
                        <kbd className="px-1 bg-muted rounded text-[10px] mr-1">→</kbd> Forward 10s
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full flex items-center justify-center p-8 text-center border-dashed">
                  <div className="flex flex-col items-center max-w-sm">
                    <FileAudio className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Audio Selected</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Please select an audio file from the dropdown above to begin your evaluation.
                    </p>
                  </div>
                </Card>
              )}
            </div>

            {/* Evaluation Form Section - Only show if both audio and template are selected */}
            <div className="lg:col-span-7">
              {selectedAudioFileDetails && selectedTemplateDetails ? (
                <div className="space-y-5">
                  <Card className="border-primary/10">
                    <CardHeader className="bg-primary/5 border-b border-primary/10 pb-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <ClipboardCheck className="h-5 w-5 text-primary" />
                          <span>Evaluation Form</span>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-normal">
                            Final Score: {calculateScore()}%
                          </Badge>
                        </div>
                      </div>
                      <CardDescription>
                        {selectedTemplateDetails.description ||
                          "Please complete all required fields below for a thorough evaluation"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="text-sm px-4 py-3 bg-muted/30 border-b">
                        <strong className="font-medium">Instructions:</strong> Evaluate the audio recording using the criteria below. Mark N/A for criteria that don't apply.
                      </div>
                      <div className="p-4 max-h-[calc(100vh-20rem)] overflow-y-auto">
                        <Accordion
                          type="multiple"
                          defaultValue={selectedTemplateDetails.pillars.map((p: any) => p.id.toString())}
                          className="space-y-4"
                        >
                          {selectedTemplateDetails.pillars.map((pillar: any) => (
                            <AccordionItem
                              key={pillar.id}
                              value={pillar.id.toString()}
                              className="border rounded-lg overflow-hidden"
                            >
                              <AccordionTrigger className="px-4 py-3 hover:no-underline bg-muted/20 hover:bg-muted/30">
                                <div className="flex items-center gap-2 text-left">
                                  <span className="font-medium">{pillar.name}</span>
                                  <Badge variant="outline" className="ml-2 font-normal">
                                    {pillar.weightage}%
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="p-4 pt-2">
                                <div className="text-sm text-muted-foreground mb-4">
                                  {pillar.description}
                                </div>
                                <div className="space-y-5">
                                  {pillar.parameters.map((param: any) => (
                                    <div
                                      key={param.id}
                                      className="border rounded-md overflow-hidden"
                                    >
                                      <div className="p-3 bg-muted/10 border-b">
                                        <div className="flex justify-between items-start">
                                          <div className="flex items-start gap-2">
                                            <div>
                                              <h4 className="font-medium text-sm flex items-center gap-2">
                                                {param.name}
                                                {param.isFatal && (
                                                  <Badge variant="destructive" className="ml-1 text-[10px] py-0 h-4">
                                                    Fatal
                                                  </Badge>
                                                )}
                                              </h4>
                                              <p className="text-xs text-muted-foreground mt-1">
                                                {param.description}
                                              </p>
                                            </div>
                                          </div>
                                          {param.weightageEnabled && (
                                            <Badge variant="outline" className="font-normal">
                                              {param.weightage}%
                                            </Badge>
                                          )}
                                        </div>
                                        {param.guidelines && (
                                          <div className="mt-2 text-xs bg-muted/30 p-2 rounded">
                                            <strong>Guidelines:</strong> {param.guidelines}
                                          </div>
                                        )}
                                      </div>
                                      <div className="p-3 space-y-3">
                                        {param.ratingType === "yes_no_na" ? (
                                          <div className="space-y-3">
                                            <Select
                                              onValueChange={(value) =>
                                                handleScoreChange(param.id, value)
                                              }
                                              value={scores[param.id]?.score}
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
                                                        <SelectItem key={idx} value={reason}>
                                                          {reason}
                                                        </SelectItem>
                                                      ),
                                                    )}
                                                  </SelectContent>
                                                </Select>
                                              )}
                                          </div>
                                        ) : param.ratingType === "numeric" ? (
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <Label htmlFor={`numeric-score-${param.id}`}>
                                                Score (1-5)
                                              </Label>
                                              <span className="text-sm font-medium">
                                                {scores[param.id]?.score || "-"}
                                              </span>
                                            </div>
                                            <Input
                                              id={`numeric-score-${param.id}`}
                                              type="number"
                                              min="1"
                                              max="5"
                                              placeholder="Score (1-5)"
                                              value={scores[param.id]?.score || ""}
                                              onChange={(e) =>
                                                handleScoreChange(param.id, e.target.value)
                                              }
                                            />
                                          </div>
                                        ) : (
                                          <Select
                                            onValueChange={(value) =>
                                              handleScoreChange(param.id, value)
                                            }
                                            value={scores[param.id]?.score}
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
                                                ),
                                              )}
                                            </SelectContent>
                                          </Select>
                                        )}

                                        {(param.requiresComment ||
                                          scores[param.id]?.score === "no") && (
                                          <div className="space-y-1.5">
                                            <Label htmlFor={`comment-${param.id}`} className="text-xs">
                                              Comments
                                            </Label>
                                            <Textarea
                                              id={`comment-${param.id}`}
                                              placeholder="Add comments..."
                                              value={scores[param.id]?.comment || ""}
                                              onChange={(e) =>
                                                handleCommentChange(param.id, e.target.value)
                                              }
                                              rows={3}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    </CardContent>
                    <CardFooter className="border-t p-4 flex justify-between bg-muted/10">
                      <div className="flex items-center">
                        <span className="text-sm text-muted-foreground">
                          Final Score: <strong>{calculateScore()}%</strong>
                        </span>
                      </div>
                      <Button
                        onClick={handleAudioSubmit}
                        disabled={
                          !selectedAudioFile ||
                          !selectedTemplate ||
                          submitEvaluationMutation.isPending
                        }
                        className="flex items-center gap-2"
                      >
                        {submitEvaluationMutation.isPending ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Submit Evaluation
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              ) : selectedAudioFileDetails ? (
                <Card className="h-full flex items-center justify-center p-8 text-center border-dashed">
                  <div className="flex flex-col items-center max-w-sm">
                    <ClipboardList className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Template Selected</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Please select an evaluation template to begin scoring this audio file.
                    </p>
                  </div>
                </Card>
              ) : (
                <Card className="h-full flex items-center justify-center p-8 text-center border-dashed">
                  <div className="flex flex-col items-center max-w-sm">
                    <ClipboardList className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Select Audio to Begin</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      First select an audio file, then choose an evaluation template to proceed.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Completed Evaluations Tab Content */}
        <TabsContent value="completed" className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-primary" />
              <span>Completed Evaluations</span>
            </h1>
            
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search evaluations..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-1">
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <h4 className="font-medium">Filter Options</h4>
                    
                    <div className="space-y-2">
                      <Label htmlFor="template-filter">Template</Label>
                      <Select
                        value={evaluationFilters.templateId}
                        onValueChange={(value) =>
                          setEvaluationFilters((prev) => ({ ...prev, templateId: value }))
                        }
                      >
                        <SelectTrigger id="template-filter">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All Templates</SelectItem>
                          {templates?.map((template: any) => (
                            <SelectItem key={template.id} value={template.id.toString()}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="batch-filter">Batch</Label>
                      <Select
                        value={evaluationFilters.batchId}
                        onValueChange={(value) =>
                          setEvaluationFilters((prev) => ({ ...prev, batchId: value }))
                        }
                      >
                        <SelectTrigger id="batch-filter">
                          <SelectValue placeholder="Select batch" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All Batches</SelectItem>
                          {batches?.map((batch: any) => (
                            <SelectItem key={batch.id} value={batch.id.toString()}>
                              {batch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="status-filter">Status</Label>
                      <Select
                        value={evaluationFilters.status}
                        onValueChange={(value) =>
                          setEvaluationFilters((prev) => ({ ...prev, status: value }))
                        }
                      >
                        <SelectTrigger id="status-filter">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="pt-2 flex justify-between">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setEvaluationFilters({
                            templateId: "",
                            traineeId: "",
                            batchId: "",
                            status: "all",
                            dateRange: "all",
                          });
                          setSearchQuery("");
                          setCompletedEvalType("all");
                        }}
                      >
                        Reset Filters
                      </Button>
                      <Button size="sm" onClick={() => setIsFilterOpen(false)}>
                        Apply Filters
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <Tabs defaultValue="all" value={completedEvalType} onValueChange={(value) => setCompletedEvalType(value as "all" | "standard" | "audio")}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Evaluations</TabsTrigger>
              <TabsTrigger value="standard">Standard Evaluations</TabsTrigger>
              <TabsTrigger value="audio">Audio Evaluations</TabsTrigger>
            </TabsList>
            
            <TabsContent value={completedEvalType}>
              {loadingEvaluations ? (
                <div className="flex justify-center items-center py-10">
                  <Spinner className="h-6 w-6" />
                  <span className="ml-2">Loading evaluations...</span>
                </div>
              ) : evaluationsError ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Failed to load evaluations</h3>
                    <p className="text-muted-foreground mb-4">There was an error loading your evaluations</p>
                    <Button onClick={() => refetchEvaluations()}>
                      Try Again
                    </Button>
                  </CardContent>
                </Card>
              ) : (!evaluations || evaluations.length === 0) ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No evaluations found</h3>
                    <p className="text-muted-foreground">
                      {searchQuery || Object.values(evaluationFilters).some(v => v && v !== "all")
                        ? "Try adjusting your filters or search query"
                        : "No completed evaluations are available"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Trainee/Audio</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evaluations && evaluations.map((evaluation: any) => (
                        <TableRow key={evaluation.id}>
                          <TableCell className="font-medium">#{evaluation.id}</TableCell>
                          <TableCell>
                            {evaluation.evaluationType === "audio" ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <FileAudio className="h-3 w-3 mr-1" />
                                Audio
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                <ClipboardCheck className="h-3 w-3 mr-1" />
                                Standard
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{evaluation.templateName || evaluation.template?.name || "Unknown"}</TableCell>
                          <TableCell>
                            {evaluation.evaluationType === "audio" ? (
                              <span className="flex items-center">
                                <FileAudio className="h-3 w-3 mr-1" />
                                Audio #{evaluation.audioFileId}
                              </span>
                            ) : (
                              <span className="flex items-center">
                                <User className="h-3 w-3 mr-1" />
                                {evaluation.trainee?.fullName || "Unknown"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{typeof evaluation.final_score === 'number' ? evaluation.final_score.toFixed(1) : (evaluation.final_score || 0)}%</TableCell>
                          <TableCell>{formatDate(evaluation.createdAt)}</TableCell>
                          <TableCell>
                            {evaluation.status === "pending" ? (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>
                            ) : evaluation.status === "completed" ? (
                              evaluation.isPassed ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Passed</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Failed</Badge>
                              )
                            ) : (
                              <Badge variant="outline">{evaluation.status}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  setSelectedEvaluationId(evaluation.id);
                                  setDetailsDialogOpen(true);
                                  
                                  // Fetch evaluation details
                                  fetchEvaluationDetails(evaluation.id);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  setSelectedEvaluationId(evaluation.id);
                                  
                                  // Fetch evaluation details first
                                  queryClient.fetchQuery({
                                    queryKey: ["/api/evaluations", evaluation.id],
                                  })
                                  .then((details: any) => {
                                    // Initialize edited scores based on existing ones
                                    const initialScores: Record<number, any> = {};
                                    
                                    // Check if proper evaluation data is available
                                    if (details && details.evaluation && Array.isArray(details.evaluation.scores)) {
                                      details.evaluation.scores.forEach((score: any) => {
                                        initialScores[score.parameterId] = {
                                          score: score.score,
                                          comment: score.comment || "",
                                          noReason: score.noReason || "",
                                        };
                                      });
                                    }
                                    
                                    setEditedScores(initialScores);
                                    setIsEditDialogOpen(true);
                                  })
                                  .catch((error) => {
                                    console.error("Error fetching evaluation details:", error);
                                    // Show error toast
                                    toast({
                                      title: "Error",
                                      description: "Failed to load evaluation details. Please try again.",
                                      variant: "destructive"
                                    });
                                  });
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Evaluation Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Evaluation Details</DialogTitle>
            <DialogDescription>
              Detailed breakdown of the evaluation scores and feedback
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-8 w-8 animate-spin" />
            </div>
          ) : evaluationDetailsData ? (
            <div className="py-4">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-semibold">
                    Evaluation #{evaluationDetailsData.evaluation?.id}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Date: {evaluationDetailsData.evaluation?.createdAt ? formatDate(evaluationDetailsData.evaluation.createdAt) : "Unknown"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Type: {evaluationDetailsData.evaluation?.evaluationType || "Unknown"}
                  </p>
                </div>
                <div className="text-right">
                  <h4 className="text-sm font-medium">Final Score</h4>
                  <p className="text-2xl font-bold">{evaluationDetailsData.evaluation?.finalScore?.toFixed(1) || 0}%</p>
                </div>
              </div>

              <Separator className="my-4" />
              
              <ScrollArea className="h-[400px] pr-4">
                {evaluationDetailsData.groupedScores?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No detailed scores available</p>
                ) : (
                  <Accordion type="multiple" className="w-full">
                    {evaluationDetailsData.groupedScores?.map((group: any, groupIndex: number) => (
                      <AccordionItem key={groupIndex} value={`pillar-${group.pillar?.id || groupIndex}`}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex justify-between items-center w-full pr-4">
                            <span className="font-medium">
                              {group.pillar?.name || `Section ${groupIndex + 1}`}
                            </span>
                            {group.pillar && (
                              <span className="text-sm px-2">
                                Weight: {group.pillar.weight}%
                              </span>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 pl-2">
                            {group.scores.map((score: any) => (
                              <div key={score.id} className="bg-muted p-3 rounded-md">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1">
                                    <h4 className="font-medium">{score.parameter?.name || 'Parameter'}</h4>
                                    {score.parameter?.description && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {score.parameter.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <Badge 
                                      variant="outline" 
                                      className={
                                        score.score === 'Excellent' || score.score === 'Yes' || score.score === '1' || parseInt(score.score) >= 4 
                                          ? 'bg-green-50 text-green-700 border-green-200' 
                                          : score.score === 'Poor' || score.score === 'No' || score.score === '0' || parseInt(score.score) <= 1
                                            ? 'bg-red-50 text-red-700 border-red-200'
                                            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                      }
                                    >
                                      {score.score}
                                    </Badge>
                                  </div>
                                </div>
                                
                                {score.comment && (
                                  <div className="mt-2">
                                    <h5 className="text-sm font-medium mb-1">Comment:</h5>
                                    <p className="text-sm p-2 bg-background rounded border text-muted-foreground">
                                      {score.comment}
                                    </p>
                                  </div>
                                )}
                                
                                {score.noReason && (
                                  <div className="mt-2">
                                    <h5 className="text-sm font-medium mb-1">Reason:</h5>
                                    <p className="text-sm p-2 bg-background rounded border text-muted-foreground">
                                      {score.noReason}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </ScrollArea>
            </div>
          ) : (
            <div className="text-center py-6">
              <p>No evaluation details available</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => {
                  if (selectedEvaluationId) {
                    fetchEvaluationDetails(selectedEvaluationId);
                  }
                }}
              >
                Try Again
              </Button>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* View Evaluation Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Evaluation Details</DialogTitle>
            <DialogDescription>
              {evaluationDetails?.evaluation?.evaluationType === "audio" 
                ? "Audio evaluation details" 
                : "Standard evaluation details"}
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="flex justify-center items-center py-10">
              <Spinner className="h-6 w-6" />
              <span className="ml-2">Loading details...</span>
            </div>
          ) : !evaluationDetails ? (
            <div className="text-center py-6">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p>Failed to load evaluation details</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Evaluation Information</h3>
                    <div className="bg-muted/30 p-3 rounded-md space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Type:</span>
                        <span className="text-sm font-medium">
                          {evaluationDetails?.evaluation?.evaluationType === "audio" ? "Audio" : "Standard"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Template:</span>
                        <span className="text-sm font-medium">
                          {evaluationDetails?.evaluation?.template?.name || "Unknown"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Date:</span>
                        <span className="text-sm font-medium">
                          {evaluationDetails?.evaluation?.createdAt ? formatDate(evaluationDetails?.evaluation?.createdAt) : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Status:</span>
                        <span className="text-sm font-medium">
                          {evaluationDetails?.evaluation?.status === "completed" ? "Completed" : "Pending"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Final Score:</span>
                        <span className="text-sm font-medium">
                          {evaluationDetails?.evaluation?.finalScore ? Number(evaluationDetails?.evaluation?.finalScore).toFixed(1) : "0"}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Result:</span>
                        <span className={`text-sm font-medium ${evaluationDetails?.evaluation?.isPassed ? "text-green-600" : "text-red-600"}`}>
                          {evaluationDetails?.evaluation?.isPassed ? "Passed" : "Failed"}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      {evaluationDetails?.evaluation?.evaluationType === "audio" 
                        ? "Audio Information" 
                        : "Trainee Information"}
                    </h3>
                    <div className="bg-muted/30 p-3 rounded-md space-y-2">
                      {evaluationDetails?.evaluation?.evaluationType === "audio" ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm">Audio ID:</span>
                            <span className="text-sm font-medium">#{evaluationDetails?.evaluation?.audioFileId || 'N/A'}</span>
                          </div>
                          {evaluationDetails?.evaluation?.audioFile && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-sm">File Name:</span>
                                <span className="text-sm font-medium">
                                  {evaluationDetails?.evaluation?.audioFile?.fileName || "Not available"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm">Duration:</span>
                                <span className="text-sm font-medium">
                                  {evaluationDetails?.evaluation?.audioFile?.duration 
                                    ? `${Math.floor(evaluationDetails?.evaluation?.audioFile?.duration / 60)}:${(evaluationDetails?.evaluation?.audioFile?.duration % 60).toString().padStart(2, '0')}` 
                                    : "Unknown"}
                                </span>
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm">Trainee:</span>
                            <span className="text-sm font-medium">
                              {evaluationDetails?.evaluation?.trainee?.fullName || "Unknown"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Employee ID:</span>
                            <span className="text-sm font-medium">
                              {evaluationDetails?.evaluation?.trainee?.employeeId || "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Batch:</span>
                            <span className="text-sm font-medium">
                              {evaluationDetails?.evaluation?.batch?.name || "N/A"}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm">Evaluator:</span>
                        <span className="text-sm font-medium">
                          {evaluationDetails?.evaluation?.evaluator?.fullName || "Unknown"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Parameter Scores</h3>
                  
                  {/* Group parameters by pillar if available - Using accordion similar to evaluation-feedback */}
                  {evaluationDetails?.groupedScores && evaluationDetails?.groupedScores.length > 0 ? (
                    <div className="space-y-4">
                      <Accordion type="multiple" className="w-full">
                        {evaluationDetails?.groupedScores?.map((group: any, groupIndex: number) => (
                          <AccordionItem key={groupIndex} value={`pillar-${group.pillar?.id || groupIndex}`}>
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex justify-between items-center w-full pr-4">
                                <span className="font-medium">
                                  {group.pillar ? group.pillar.name : `Section ${groupIndex + 1}`}
                                </span>
                                {group.pillar && (
                                  <span className="text-sm px-2">
                                    Weight: {group.pillar.weight}%
                                  </span>
                                )}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-4 pl-2">
                                {group.scores.map((score: any) => (
                                  <div key={score.id} className="bg-muted p-3 rounded-md">
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="flex-1">
                                        <h4 className="font-medium">{score.parameter?.name || 'Parameter'}</h4>
                                        {score.parameter?.description && (
                                          <p className="text-sm text-muted-foreground mt-1">
                                            {score.parameter.description}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {score.parameter?.weight && (
                                          <span className="text-xs bg-muted-foreground/20 px-2 py-1 rounded">
                                            Weight: {score.parameter.weight}%
                                          </span>
                                        )}
                                        <Badge 
                                          variant="outline" 
                                          className={
                                            (typeof score.score === 'number' && score.score >= 4) || 
                                            score.score === "Excellent" || 
                                            score.score === "Yes" || 
                                            score.score === "1"
                                              ? 'bg-green-50 text-green-700 border-green-200' 
                                              : (typeof score.score === 'number' && score.score <= 1) || 
                                                score.score === "Poor" || 
                                                score.score === "No" || 
                                                score.score === "0"
                                                  ? 'bg-red-50 text-red-700 border-red-200'
                                                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                          }
                                        >
                                          {typeof score.score === 'number' && score.parameter?.maxScore 
                                            ? `${score.score}/${score.parameter.maxScore}` 
                                            : score.score}
                                        </Badge>
                                      </div>
                                    </div>
                                    
                                    {score.comment && (
                                      <div className="mt-2">
                                        <h5 className="text-xs font-medium mb-1">Comment:</h5>
                                        <p className="text-sm border-l-2 border-primary pl-2 py-1">
                                          {score.comment}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {score.noReason && (
                                      <div className="mt-2">
                                        <h5 className="text-xs font-medium mb-1">Reason for Low Score:</h5>
                                        <p className="text-sm border-l-2 border-red-500 pl-2 py-1">
                                          {score.noReason}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  ) : (
                    <Accordion type="multiple" className="w-full">
                      {evaluationDetails?.evaluation?.template?.parameters?.map((parameter: any) => {
                        const score = evaluationDetails?.evaluation?.scores?.find(
                          (s: any) => s.parameterId === parameter.id
                        );
                        
                        return (
                          <AccordionItem key={parameter.id} value={parameter.id.toString()}>
                            <AccordionTrigger className="py-3 px-4 hover:bg-muted/30 rounded-md">
                              <div className="flex justify-between w-full mr-4 items-center">
                                <span>{parameter.name}</span>
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    variant="outline"
                                    className={
                                      (score?.score >= 4) ? "bg-green-50 text-green-700 border-green-200" :
                                      (score?.score <= 1) ? "bg-red-50 text-red-700 border-red-200" :
                                      "bg-yellow-50 text-yellow-700 border-yellow-200"
                                    }
                                  >
                                    {score?.score || 0}/{parameter.maxScore}
                                  </Badge>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-3">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-sm text-muted-foreground">{parameter.description}</p>
                                </div>
                                
                                {score?.comment && (
                                  <div>
                                    <h5 className="text-xs font-medium mb-1">Comment:</h5>
                                    <p className="text-sm border-l-2 border-primary pl-2 py-1">
                                      {score.comment}
                                    </p>
                                  </div>
                                )}
                                
                                {score?.noReason && (
                                  <div>
                                    <h5 className="text-xs font-medium mb-1">Reason for Low Score:</h5>
                                    <p className="text-sm border-l-2 border-red-500 pl-2 py-1">
                                      {score.noReason}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewDialogOpen(false)}
            >
              Close
            </Button>
            <Button onClick={() => {
              setIsViewDialogOpen(false);
              // Open edit dialog and initialize the edit state
              if (evaluationDetails?.evaluation) {
                // Pre-populate edited scores with existing scores from ALL sources
                const initialScores: Record<string, any> = {};
                
                // First try to get scores directly from the evaluation object
                if (evaluationDetails.evaluation.scores && evaluationDetails.evaluation.scores.length > 0) {
                  evaluationDetails.evaluation.scores.forEach((score: any) => {
                    initialScores[score.parameterId] = {
                      score: score.score,
                      comment: score.comment || '',
                      noReason: score.noReason || '',
                    };
                  });
                }
                // Also check the groupedScores which might have better data
                else if (evaluationDetails.groupedScores && evaluationDetails.groupedScores.length > 0) {
                  // Extract scores from grouped structure
                  evaluationDetails.groupedScores.forEach((group: any) => {
                    if (group.scores && group.scores.length > 0) {
                      group.scores.forEach((score: any) => {
                        initialScores[score.parameterId] = {
                          score: score.score,
                          comment: score.comment || '',
                          noReason: score.noReason || '',
                        };
                      });
                    }
                  });
                }
                
                console.log("Initial scores for editing:", initialScores);
                setEditedScores(initialScores);
                setSelectedEvaluationId(evaluationDetails.evaluation.id);
                setIsEditDialogOpen(true);
              } else {
                toast({
                  title: "Cannot edit evaluation",
                  description: "Evaluation details are not available",
                  variant: "destructive",
                });
              }
            }}>
              Edit Evaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Evaluation Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Evaluation</DialogTitle>
            <DialogDescription>
              {evaluationDetails?.evaluation?.evaluationType === "audio" 
                ? "Audio evaluation details"
                : "Standard evaluation details"}
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="flex justify-center items-center py-10">
              <Spinner className="h-6 w-6" />
              <span className="ml-2">Loading details...</span>
            </div>
          ) : !evaluationDetails ? (
            <div className="text-center py-6">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p>Failed to load evaluation details</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Evaluation Information</h3>
                    <div className="bg-muted/30 p-3 rounded-md space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Type:</span>
                        <span className="text-sm font-medium">
                          {evaluationDetails?.evaluation?.evaluationType === "audio" ? "Audio" : "Standard"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Template:</span>
                        <span className="text-sm font-medium">{evaluationDetails?.evaluation?.template?.name || "Unknown"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Date:</span>
                        <span className="text-sm font-medium">
                          {evaluationDetails?.evaluation?.createdAt 
                            ? new Date(evaluationDetails.evaluation.createdAt).toLocaleString() 
                            : "Unknown"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      {evaluationDetails?.evaluation?.evaluationType === "audio" ? "Audio Information" : "Trainee Information"}
                    </h3>
                    <div className="bg-muted/30 p-3 rounded-md space-y-2">
                      {evaluationDetails?.evaluation?.evaluationType === "audio" ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm">Audio ID:</span>
                            <span className="text-sm font-medium">
                              #{evaluationDetails?.evaluation?.audioFile?.id || "Unknown"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Language:</span>
                            <span className="text-sm font-medium">
                              {evaluationDetails?.evaluation?.audioFile?.language || "Unknown"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm">Trainee:</span>
                            <span className="text-sm font-medium">
                              {evaluationDetails?.evaluation?.trainee?.fullName || "Unknown"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Employee ID:</span>
                            <span className="text-sm font-medium">
                              {evaluationDetails?.evaluation?.trainee?.employeeId || "N/A"}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm">Evaluator:</span>
                        <span className="text-sm font-medium">
                          {evaluationDetails?.evaluation?.evaluator?.fullName || "Unknown"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Final Score Display */}
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Final Score</h3>
                  <div className="text-2xl font-bold">
                    {evaluationDetails && Object.keys(editedScores).length > 0 ? 
                      (() => {
                        const parameters = evaluationDetails?.evaluation?.template?.parameters || [];
                        const scoreEntries = Object.entries(editedScores || {});
                        
                        let totalScore = 0;
                        let totalWeight = 0;
                        
                        scoreEntries.forEach(([parameterId, scoreData]: [string, any]) => {
                          const parameter = parameters.find((p: any) => p?.id === parseInt(parameterId));
                          if (parameter) {
                            totalScore += (scoreData?.score || 0) * (parameter?.weight || 1);
                            totalWeight += (parameter?.weight || 1);
                          }
                        });
                        
                        return totalWeight > 0 ? (totalScore / totalWeight).toFixed(2) + "%" : "0.00%";
                      })() : "0.00%"}
                  </div>
                </div>
                
                {/* Parameters Display */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-2">Parameters</h3>
                  
                  {/* Debug info */}
                  <div className="bg-gray-100 p-3 rounded-md text-xs mb-3">
                    <p>Template ID: {evaluationDetails?.evaluation?.templateId || 'Unknown'}</p>
                    <p>Template Name: {evaluationDetails?.evaluation?.template?.name || 'Unknown'}</p>
                    <p>Score Count: {evaluationDetails?.evaluation?.scores?.length || 0}</p>
                    <p>Parameter Count: {evaluationDetails?.evaluation?.template?.parameters?.length || 0}</p>
                    <p>GroupedScores Count: {evaluationDetails?.groupedScores?.length || 0}</p>
                  </div>
                  
                  {/* Use grouped scores approach which matches the view details display */}
                  {evaluationDetails?.groupedScores && evaluationDetails.groupedScores.length > 0 ? (
                    <div className="space-y-6">
                      {evaluationDetails.groupedScores.map((group: any, groupIndex: number) => (
                        <div key={groupIndex} className="space-y-4">
                          {/* Section Header */}
                          {group.pillar && (
                            <div className="bg-primary/10 p-3 rounded-md">
                              <h4 className="font-medium text-primary">
                                {group.pillar.name || `Section ${groupIndex + 1}`}
                              </h4>
                              {group.pillar.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {group.pillar.description}
                                </p>
                              )}
                            </div>
                          )}
                          
                          {/* Parameters in this group */}
                          {group.scores && group.scores.map((score: any) => {
                            const parameterId = score.parameterId;
                            const parameter = score.parameter;
                            
                            if (!parameter) {
                              console.warn("Missing parameter data for score:", score);
                              return null;
                            }
                            
                            // Get current score data from edited scores or use original
                            const currentScore = editedScores[parameterId] || { 
                              score: score.score || 0, 
                              comment: score.comment || "", 
                              noReason: score.noReason || "" 
                            };
                            
                            const scoreValue = currentScore.score || 0;
                            const isYesNo = parameter.scoreType === "yesno";
                            
                            return (
                              <div key={parameterId} className="bg-muted/20 rounded-md p-4 border">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h4 className="font-medium mb-1">
                                      {parameter.name || `Parameter #${parameterId}`}
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                      {parameter.question || parameter.description || "No question text available"}
                                    </p>
                                  </div>
                                  
                                  <div className="flex flex-col items-end">
                                    <Badge variant="outline" className="mb-2">
                                      Weight: {parameter.weight || 0}%
                                    </Badge>
                                    
                                    {/* Yes/No selection for boolean parameters, numeric for others */}
                                    {isYesNo ? (
                                      <Select
                                        value={scoreValue === 1 ? "yes" : "no"}
                                        onValueChange={(value) =>
                                          handleScoreChange(parameterId, "score", value === "yes" ? 1 : 0)
                                        }
                                      >
                                        <SelectTrigger className="w-32">
                                          <SelectValue placeholder="Score" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="yes">Yes</SelectItem>
                                          <SelectItem value="no">No</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Select
                                        value={scoreValue.toString()}
                                        onValueChange={(value) =>
                                          handleScoreChange(parameterId, "score", parseInt(value))
                                        }
                                      >
                                        <SelectTrigger className="w-32">
                                          <SelectValue placeholder="Score" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {Array.from({ length: (parameter.maxScore || 5) + 1 }, (_, i) => (
                                            <SelectItem key={i} value={i.toString()}>
                                              {i}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Comment field */}
                                <div className="mt-3">
                                  <Label className="text-sm">Comment</Label>
                                  <Textarea
                                    value={currentScore.comment || ""}
                                    onChange={(e) =>
                                      handleScoreChange(parameterId, "comment", e.target.value)
                                    }
                                    placeholder="Add a comment (optional)"
                                    className="min-h-[60px] mt-1"
                                  />
                                </div>
                                
                                {/* No Reason field for zero or no scores */}
                                {(scoreValue === 0 || (isYesNo && scoreValue === 0)) && (
                                  <div className="mt-3">
                                    <Label className="text-sm">
                                      Reason (Required for {isYesNo ? "no" : "zero"} score)
                                    </Label>
                                    <Textarea
                                      value={currentScore.noReason || ""}
                                      onChange={(e) =>
                                        handleScoreChange(parameterId, "noReason", e.target.value)
                                      }
                                      placeholder={`Explain why this score is ${isYesNo ? "no" : "zero"}`}
                                      className="min-h-[60px] mt-1"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ) : evaluationDetails?.evaluation?.template?.parameters?.length > 0 ? (
                    // Fall back to template parameters if no grouped scores
                    <div className="space-y-4">
                      {evaluationDetails.evaluation.template.parameters.map((parameter: any) => {
                        const parameterId = parameter.id;
                        
                        // Find the existing score for this parameter if it exists
                        const existingScore = evaluationDetails?.evaluation?.scores?.find(
                          (s: any) => s.parameterId === parameterId
                        );
                        
                        // Get current score data from edited scores or use original score data
                        const currentScore = editedScores[parameterId] || { 
                          score: existingScore?.score || 0, 
                          comment: existingScore?.comment || "", 
                          noReason: existingScore?.noReason || "" 
                        };
                        
                        const scoreValue = currentScore.score || 0;
                        const isYesNo = parameter.scoreType === "yesno";
                        
                        return (
                          <div key={parameterId} className="bg-muted/20 rounded-md p-4 border">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-medium mb-1">
                                  {parameter.name || `Parameter #${parameterId}`}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {parameter.question || parameter.description || "No question text available"}
                                </p>
                              </div>
                              
                              <div className="flex flex-col items-end">
                                <Badge variant="outline" className="mb-2">
                                  Weight: {parameter.weight || 0}%
                                </Badge>
                                
                                {/* Yes/No selection for boolean parameters, numeric for others */}
                                {isYesNo ? (
                                  <Select
                                    value={scoreValue === 1 ? "yes" : "no"}
                                    onValueChange={(value) =>
                                      handleScoreChange(parameterId, "score", value === "yes" ? 1 : 0)
                                    }
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue placeholder="Score" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="yes">Yes</SelectItem>
                                      <SelectItem value="no">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Select
                                    value={scoreValue.toString()}
                                    onValueChange={(value) =>
                                      handleScoreChange(parameterId, "score", parseInt(value))
                                    }
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue placeholder="Score" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Array.from({ length: (parameter.maxScore || 5) + 1 }, (_, i) => (
                                        <SelectItem key={i} value={i.toString()}>
                                          {i}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </div>
                            
                            {/* Comment field */}
                            <div className="mt-3">
                              <Label className="text-sm">Comment</Label>
                              <Textarea
                                value={currentScore.comment || ""}
                                onChange={(e) =>
                                  handleScoreChange(parameterId, "comment", e.target.value)
                                }
                                placeholder="Add a comment (optional)"
                                className="min-h-[60px] mt-1"
                              />
                            </div>
                            
                            {/* No Reason field for zero or no scores */}
                            {(scoreValue === 0 || (isYesNo && scoreValue === 0)) && (
                              <div className="mt-3">
                                <Label className="text-sm">
                                  Reason (Required for {isYesNo ? "no" : "zero"} score)
                                </Label>
                                <Textarea
                                  value={currentScore.noReason || ""}
                                  onChange={(e) =>
                                    handleScoreChange(parameterId, "noReason", e.target.value)
                                  }
                                  placeholder={`Explain why this score is ${isYesNo ? "no" : "zero"}`}
                                  className="min-h-[60px] mt-1"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : evaluationDetails?.evaluation?.scores?.length > 0 ? (
                    // Fall back to raw scores if no template parameters or grouped scores
                    <div className="space-y-4">
                      {evaluationDetails.evaluation.scores.map((score: any) => {
                        const parameterId = score.parameterId;
                        const parameterName = score.parameter?.name || `Parameter #${parameterId}`;
                        const parameterQuestion = score.parameter?.question || score.parameter?.description || "Parameter question not available";
                        const parameterWeight = score.parameter?.weight || 0;
                        const scoreType = score.parameter?.scoreType || (typeof score.score === 'number' ? 'numeric' : 'yesno');
                        
                        // Get current score data from edited scores or use original
                        const currentScore = editedScores[parameterId] || { 
                          score: score.score || 0, 
                          comment: score.comment || "", 
                          noReason: score.noReason || "" 
                        };
                        
                        const scoreValue = currentScore.score || 0;
                        const isYesNo = scoreType === "yesno";
                        
                        return (
                          <div key={parameterId} className="bg-muted/20 rounded-md p-4 border">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-medium mb-1">{parameterName}</h4>
                                <p className="text-sm text-muted-foreground">{parameterQuestion}</p>
                              </div>
                              
                              <div className="flex flex-col items-end">
                                <Badge variant="outline" className="mb-2">
                                  Weight: {parameterWeight}%
                                </Badge>
                                
                                {/* Yes/No selection for boolean parameters, numeric for others */}
                                {isYesNo ? (
                                  <Select
                                    value={scoreValue === 1 ? "yes" : "no"}
                                    onValueChange={(value) =>
                                      handleScoreChange(parameterId, "score", value === "yes" ? 1 : 0)
                                    }
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue placeholder="Score" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="yes">Yes</SelectItem>
                                      <SelectItem value="no">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Select
                                    value={scoreValue.toString()}
                                    onValueChange={(value) =>
                                      handleScoreChange(parameterId, "score", parseInt(value))
                                    }
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue placeholder="Score" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Array.from({ length: 6 }, (_, i) => (
                                        <SelectItem key={i} value={i.toString()}>
                                          {i}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </div>
                            
                            {/* Comment field */}
                            <div className="mt-3">
                              <Label className="text-sm">Comment</Label>
                              <Textarea
                                value={currentScore.comment || ""}
                                onChange={(e) =>
                                  handleScoreChange(parameterId, "comment", e.target.value)
                                }
                                placeholder="Add a comment (optional)"
                                className="min-h-[60px] mt-1"
                              />
                            </div>
                            
                            {/* No Reason field for zero or no scores */}
                            {(scoreValue === 0 || (isYesNo && scoreValue === 0)) && (
                              <div className="mt-3">
                                <Label className="text-sm">
                                  Reason (Required for {isYesNo ? "no" : "zero"} score)
                                </Label>
                                <Textarea
                                  value={currentScore.noReason || ""}
                                  onChange={(e) =>
                                    handleScoreChange(parameterId, "noReason", e.target.value)
                                  }
                                  placeholder={`Explain why this score is ${isYesNo ? "no" : "zero"}`}
                                  className="min-h-[60px] mt-1"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Show message if no parameters available from any source
                    <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md">
                      <h4 className="font-medium mb-2 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        No parameters available
                      </h4>
                      <p className="text-sm">The parameters for this evaluation could not be loaded.</p>
                    </div>
                  )}
                </div>
                
              </div>
            </ScrollArea>
          )}
          
          <DialogFooter className="border-t pt-4 mt-4">
            <div className="flex-1 text-left">
              <span className="font-medium">
                Final Score: {evaluationDetails && Object.keys(editedScores).length > 0 ? 
                  (() => {
                    const parameters = evaluationDetails?.evaluation?.template?.parameters || [];
                    const scoreEntries = Object.entries(editedScores || {});
                    
                    let totalScore = 0;
                    let totalWeight = 0;
                    
                    scoreEntries.forEach(([parameterId, scoreData]: [string, any]) => {
                      const parameter = parameters.find((p: any) => p?.id === parseInt(parameterId));
                      if (parameter) {
                        totalScore += (scoreData?.score || 0) * (parameter?.weight || 1);
                        totalWeight += (parameter?.weight || 1);
                      }
                    });
                    
                    return totalWeight > 0 ? (totalScore / totalWeight).toFixed(1) : "0.0";
                  })() : "0.0"}%
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!evaluationDetails) return;
                
                const scores = Object.entries(editedScores || {}).map(([parameterId, scoreData]: [string, any]) => ({
                  parameterId: parseInt(parameterId),
                  score: scoreData?.score || 0,
                  comment: scoreData?.comment || "",
                  noReason: scoreData?.noReason || "",
                }));
                
                // Calculate final score
                const parameters = evaluationDetails?.evaluation?.template?.parameters || [];
                const scoreEntries = Object.entries(editedScores || {});
                
                let totalScore = 0;
                let totalWeight = 0;
                
                scoreEntries.forEach(([parameterId, scoreData]: [string, any]) => {
                  const parameter = parameters.find((p: any) => p?.id === parseInt(parameterId));
                  if (parameter) {
                    totalScore += (scoreData?.score || 0) * (parameter?.weight || 1);
                    totalWeight += (parameter?.weight || 1);
                  }
                });
                
                const finalScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) / 100 : 0;
                
                // Determine if passed based on template's passing score
                const passingScore = evaluationDetails?.evaluation?.template?.passingScore || 70;
                const isPassed = finalScore >= passingScore;
                
                updateEvaluationMutation.mutate({
                  id: selectedEvaluationId,
                  scores,
                  finalScore,
                  isPassed,
                });
              }}
              disabled={updateEvaluationMutation.isPending}
            >
              {updateEvaluationMutation.isPending ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Evaluation Submission</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3 mt-2">
                <p>Please review the evaluation details before final submission:</p>
                <div className="bg-muted p-3 rounded-md">
                  <p><strong>Final Score:</strong> {pendingEvaluation?.finalScore || calculateScore()}%</p>
                  {selectedTemplateDetails && (
                    <p><strong>Template:</strong> {selectedTemplateDetails.name}</p>
                  )}
                  {selectedTrainee && (
                    <p><strong>Trainee:</strong> Selected Trainee ID: {selectedTrainee}</p>
                  )}
                  {selectedAudioFileDetails && (
                    <p><strong>Audio File:</strong> {selectedAudioFileDetails.name}</p>
                  )}
                </div>
                <p>Are you sure you want to submit this evaluation?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndSubmit}>
              {submitEvaluationMutation.isPending ? (
                <div className="flex items-center">
                  <Spinner className="mr-2 h-4 w-4" /> Submitting...
                </div>
              ) : "Submit Evaluation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Permission guard wrapper
const PermissionGuardedConductEvaluation = () => {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission('manage_conduct_form')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <h2 className="text-2xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground mb-4">
          You do not have permission to access the Conduct Evaluation section.
        </p>
        <Button asChild variant="outline">
          <a href="/">Return to Dashboard</a>
        </Button>
      </div>
    );
  }
  
  return <ConductEvaluation />;
};

export default PermissionGuardedConductEvaluation;
