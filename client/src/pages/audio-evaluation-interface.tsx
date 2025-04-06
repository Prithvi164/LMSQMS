import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, ChevronRight, FileAudio, PlayCircle, PauseCircle, SkipForward, Save, CheckCircle2, XCircle, AlertCircle, Info, ClipboardList } from 'lucide-react';

// Type definitions
interface AudioFileAllocation {
  id: number;
  audioFileId: number;
  qualityAnalystId: number;
  status: 'pending' | 'allocated' | 'evaluated' | 'archived';
  allocatedBy: number;
  createdAt: string;
  organizationId: number;
  evaluationId?: number;
  audioFile?: AudioFile; // Make this optional since it may not always be included
}

interface AudioFile {
  id: number;
  filename: string;
  containerName: string;
  blobName: string;
  mimeType: string;
  size: number;
  duration: number;
  status: string;
  callType: string;
  language: string;
  callMetrics?: {
    agentId?: string;
    callDate?: string;
    callDuration?: number;
    customerId?: string;
    callId?: string;
    category?: string;
    callScore?: number;
  };
  uploadedBy: number;
  uploadDate: string;
  organizationId: number;
}

interface EvaluationTemplate {
  id: number;
  name: string;
  description: string;
  organizationId: number;
  createdAt: string;
  pillars: EvaluationPillar[];
}

interface EvaluationPillar {
  id: number;
  name: string;
  description: string;
  orderIndex: number;
  weightage: number;
  parameters: EvaluationParameter[];
}

interface EvaluationParameter {
  id: number;
  name: string;
  description: string;
  guidelines: string;
  ratingType: string;
  weightage: number;
  weightageEnabled: boolean;
  isFatal: boolean;
  requiresComment: boolean;
  noReasons: string[];
  orderIndex: number;
}

interface ParameterScore {
  parameterId: number;
  score: string;
  comment: string;
  noReason?: string;
}

interface EvaluationData {
  templateId: number;
  audioFileId: number;
  allocationId: number;
  evaluatorId: number;
  finalScore: number;
  scores: ParameterScore[];
}

// Form schema for evaluation
const evaluationScoreSchema = z.object({
  templateId: z.number(),
  audioFileId: z.number(),
  allocationId: z.number(),
  evaluatorId: z.number(),
  finalScore: z.number(),
  scores: z.array(
    z.object({
      parameterId: z.number(),
      score: z.string(),
      comment: z.string(),
      noReason: z.string().optional(),
    })
  ),
});

// Main component
const AudioEvaluationInterface = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [expandedPillar, setExpandedPillar] = useState<number | null>(null);
  const [expandedGuidelines, setExpandedGuidelines] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('evaluation');
  
  // Parse allocationId from URL
  const searchParams = new URLSearchParams(location.split('?')[1]);
  const allocationId = searchParams.get('allocationId') ? parseInt(searchParams.get('allocationId')!, 10) : null;
  
  console.log('DEBUG - Current location:', location);
  console.log('DEBUG - Allocation ID from URL:', allocationId);
  console.log('DEBUG - Current user:', user);
  
  // Fetch allocation data
  const { data: allocation, isLoading: loadingAllocation, error: allocationError } = useQuery<AudioFileAllocation>({
    queryKey: [`/api/audio-file-allocations/${allocationId}`],
    enabled: !!allocationId && !!user?.organizationId,
    retry: 3,
    onSuccess: (data) => {
      console.log('DEBUG - Allocation data received:', data);
      console.log('DEBUG - Audio file data:', data?.audioFile);
    },
    onError: (error) => {
      console.error("Error fetching allocation:", error);
      console.error("Error details:", JSON.stringify(error));
      toast({
        title: "Error loading audio file",
        description: "Could not load the audio file allocation data. Please try again or contact support.",
        variant: "destructive",
      });
    }
  });
  
  // Fetch templates
  const { data: templates, isLoading: loadingTemplates, error: templatesError } = useQuery<EvaluationTemplate[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
    enabled: !!user?.organizationId,
    retry: 3,
    onError: (error) => {
      console.error("Error fetching templates:", error);
      toast({
        title: "Error loading templates",
        description: "Could not load evaluation templates. Please try again or contact support.",
        variant: "destructive",
      });
    }
  });

  // Use the first template by default
  const selectedTemplate = templates?.[0];
  
  // Get audio file URL
  const audioFileUrl = allocation?.audioFile 
    ? `/api/azure-storage/download/${allocation.audioFile.containerName}/${allocation.audioFile.blobName}` 
    : '';
    
  // Log allocation data for debugging
  useEffect(() => {
    console.log('DEBUG - Allocation data:', allocation);
    console.log('DEBUG - Audio file URL:', audioFileUrl);
  }, [allocation, audioFileUrl]);
  
  // Setup form
  const form = useForm<z.infer<typeof evaluationScoreSchema>>({
    resolver: zodResolver(evaluationScoreSchema),
    defaultValues: {
      templateId: selectedTemplate?.id || 0,
      audioFileId: allocation?.audioFileId || 0,
      allocationId: allocationId || 0,
      evaluatorId: user?.id || 0,
      finalScore: 0,
      scores: selectedTemplate && selectedTemplate.pillars ? 
        selectedTemplate.pillars.flatMap(pillar => 
          pillar.parameters ? pillar.parameters.map(param => ({
            parameterId: param.id,
            score: '',
            comment: '',
          })) : []
        ) : [],
    },
  });
  
  // Update form values when data is loaded
  useEffect(() => {
    if (selectedTemplate && selectedTemplate.pillars && allocation) {
      form.reset({
        templateId: selectedTemplate.id,
        audioFileId: allocation.audioFileId,
        allocationId: allocationId || 0,
        evaluatorId: user?.id || 0,
        finalScore: 0,
        scores: selectedTemplate.pillars.flatMap(pillar => 
          pillar.parameters ? pillar.parameters.map(param => ({
            parameterId: param.id,
            score: '',
            comment: '',
          })) : []
        ),
      });
    }
  }, [selectedTemplate, allocation, form, allocationId, user]);
  
  // Handle audio player events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const updateTime = () => setCurrentTime(audio.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);
  
  // Audio player controls
  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };
  
  const skipForward = (seconds = 5) => {
    if (audioRef.current) {
      audioRef.current.currentTime += seconds;
    }
  };
  
  const skipBackward = (seconds = 5) => {
    if (audioRef.current) {
      audioRef.current.currentTime -= seconds;
    }
  };
  
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // Toggle pillar expansion
  const togglePillar = (pillarId: number) => {
    if (expandedPillar === pillarId) {
      setExpandedPillar(null);
    } else {
      setExpandedPillar(pillarId);
    }
  };
  
  // Toggle guidelines expansion
  const toggleGuidelines = (parameterId: number) => {
    if (expandedGuidelines === parameterId) {
      setExpandedGuidelines(null);
    } else {
      setExpandedGuidelines(parameterId);
    }
  };
  
  // Calculate progress
  const calculateProgress = () => {
    if (!selectedTemplate || !selectedTemplate.pillars) return 0;
    
    const totalParameters = selectedTemplate.pillars.reduce(
      (acc, pillar) => acc + (pillar.parameters ? pillar.parameters.length : 0), 
      0
    );
    
    if (totalParameters === 0) return 0;
    
    const completedScores = form.getValues().scores.filter(
      score => score.score !== ''
    ).length;
    
    return (completedScores / totalParameters) * 100;
  };
  
  // Check if all required fields are completed
  const isEvaluationComplete = () => {
    const scores = form.getValues().scores;
    const missingScores = [];
    
    if (!selectedTemplate || !selectedTemplate.pillars) return false;
    
    for (const pillar of selectedTemplate.pillars) {
      if (!pillar.parameters) continue;
      
      for (const param of pillar.parameters) {
        const score = scores.find(s => s.parameterId === param.id);
        
        if (!score || !score.score) {
          missingScores.push(param.name);
        }
        
        if (score && param.requiresComment && score.score === 'no' && !score.comment) {
          missingScores.push(`${param.name} (requires comment)`);
        }
      }
    }
    
    return missingScores.length === 0;
  };
  
  // Calculate final score
  const calculateFinalScore = () => {
    if (!selectedTemplate || !selectedTemplate.pillars) return 0;
    
    let totalScore = 0;
    let totalWeightage = 0;
    let hasFatalError = false;
    
    const scores = form.getValues().scores;
    
    for (const pillar of selectedTemplate.pillars) {
      if (!pillar.parameters) continue;
      
      let pillarScore = 0;
      let pillarMaxScore = 0;
      
      for (const param of pillar.parameters) {
        const score = scores.find(s => s.parameterId === param.id);
        
        if (score) {
          if (param.isFatal && score.score === 'no') {
            hasFatalError = true;
          }
          
          if (score.score === 'yes') {
            pillarScore += param.weightage;
          }
          
          pillarMaxScore += param.weightage;
        }
      }
      
      if (pillarMaxScore > 0) {
        const normalizedPillarScore = (pillarScore / pillarMaxScore) * pillar.weightage;
        totalScore += normalizedPillarScore;
        totalWeightage += pillar.weightage;
      }
    }
    
    if (hasFatalError) {
      return 0;
    }
    
    return totalWeightage > 0 ? (totalScore / totalWeightage) * 100 : 0;
  };
  
  // Submit evaluation mutation
  const submitEvaluation = useMutation({
    mutationFn: (data: EvaluationData) => 
      apiRequest('POST', `/api/evaluations`, data),
    onSuccess: () => {
      toast({
        title: 'Evaluation Submitted',
        description: 'The evaluation has been successfully submitted.',
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/audio-file-allocations/${allocationId}`] });
      navigate('/audio-assignment-dashboard');
    },
    onError: (error) => {
      toast({
        title: 'Submission Failed',
        description: 'There was an error submitting the evaluation. Please try again.',
        variant: 'destructive',
      });
      console.error('Evaluation submission error:', error);
    },
  });
  
  // Handle form submission
  const onSubmit = (data: z.infer<typeof evaluationScoreSchema>) => {
    const finalScore = calculateFinalScore();
    
    const evaluationData: EvaluationData = {
      ...data,
      finalScore,
    };
    
    submitEvaluation.mutate(evaluationData);
  };
  
  // Show loading state
  if (loadingAllocation || loadingTemplates) {
    return (
      <div className="container mx-auto py-12 flex flex-col items-center justify-center">
        <Spinner className="w-12 h-12 mb-4" />
        <p className="text-muted-foreground">Loading evaluation interface...</p>
      </div>
    );
  }
  
  // Show error if allocation doesn't exist or has no audio file data
  if (!allocation || !allocation.audioFile) {
    return (
      <div className="container mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <FileAudio className="mr-2 h-5 w-5" />
              {!allocation ? "Audio File Not Found" : "Audio File Data Missing"}
            </CardTitle>
            <CardDescription className="mt-2">
              {!allocation && allocationId ? 
                "The requested audio file allocation could not be found or you don't have permission to access it." :
                !allocation && !allocationId ? 
                "No allocation ID was provided. Please select an audio file to evaluate from the dashboard." :
                "The audio file data is missing or incomplete. This allocation cannot be evaluated."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p className="mb-4">
              To evaluate audio files, you need to:
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Go to the Audio Assignment Dashboard</li>
              <li>Find an allocated audio file with "Pending" or "Allocated" status</li>
              <li>Click the "Evaluate" button next to the file</li>
            </ol>
            <p className="mt-4">
              If you don't see any audio files, contact your administrator to allocate audio files 
              to your account for evaluation.
            </p>
            {allocation && !allocation.audioFile && (
              <div className="mt-6 p-4 bg-amber-50 text-amber-800 rounded-md">
                <h3 className="font-semibold flex items-center"><AlertCircle className="w-4 h-4 mr-2" /> Debugging Information</h3>
                <p className="mt-1 text-sm">
                  Allocation found with ID: {allocation.id}, but the audio file data is missing.
                  Please contact your administrator and provide this error message.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button onClick={() => navigate('/audio-assignment-dashboard')}>
              Go to Assignment Dashboard
            </Button>
            <Button variant="outline" onClick={() => navigate('/audio-file-allocation')}>
              View Allocation Interface
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // Show error if no templates exist
  if (!selectedTemplate) {
    return (
      <div className="container mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <ClipboardList className="mr-2 h-5 w-5" />
              No Evaluation Templates
            </CardTitle>
            <CardDescription className="mt-2">
              No evaluation templates are available for audio evaluation.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p className="mb-4">
              To evaluate an audio file, you need an evaluation template with defined:
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Evaluation pillars (categories for assessment)</li>
              <li>Evaluation parameters for each pillar</li>
              <li>Scoring criteria and weightages</li>
            </ol>
            <p className="mt-4">
              Please contact your administrator to create or assign evaluation templates
              to your organization before attempting to evaluate audio files.
            </p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button onClick={() => navigate('/audio-assignment-dashboard')}>
              Return to Dashboard
            </Button>
            {(user?.role === 'admin' || user?.role === 'owner') && (
              <Button variant="outline" onClick={() => navigate('/evaluation-templates')}>
                Manage Templates
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Audio Evaluation</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            Completion: {Math.round(calculateProgress())}%
          </span>
          <Progress value={calculateProgress()} className="w-32" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Audio player and metadata */}
        <div className="lg:col-span-1">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileAudio className="mr-2 h-5 w-5" />
                Audio Player
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-md mb-4">
                <audio ref={audioRef} src={audioFileUrl} preload="metadata" className="hidden" />
                <div className="flex flex-col space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-center space-x-4">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => skipBackward()}
                      className="h-10 w-10 rotate-180"
                    >
                      <SkipForward className="h-5 w-5" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={togglePlayPause}
                      className="h-10 w-10"
                    >
                      {isPlaying ? (
                        <PauseCircle className="h-5 w-5" />
                      ) : (
                        <PlayCircle className="h-5 w-5" />
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => skipForward()}
                      className="h-10 w-10"
                    >
                      <SkipForward className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Audio File Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Filename</Label>
                <p className="font-medium">{allocation.audioFile?.filename || 'Unknown'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Duration</Label>
                <p className="font-medium">{allocation.audioFile ? formatTime(allocation.audioFile.duration) : 'Unknown'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Call Type</Label>
                <p className="font-medium">{allocation.audioFile?.callType || 'Not specified'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Language</Label>
                <p className="font-medium">{allocation.audioFile?.language || 'Not specified'}</p>
              </div>
              
              {allocation.audioFile?.callMetrics && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground">Agent ID</Label>
                    <p className="font-medium">{allocation.audioFile.callMetrics.agentId || 'Not available'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Call Date</Label>
                    <p className="font-medium">{allocation.audioFile.callMetrics.callDate || 'Not available'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Customer ID</Label>
                    <p className="font-medium">{allocation.audioFile.callMetrics.customerId || 'Not available'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Call ID</Label>
                    <p className="font-medium">{allocation.audioFile.callMetrics.callId || 'Not available'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p className="font-medium">{allocation.audioFile.callMetrics.category || 'Not available'}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Right column: Evaluation form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle>{selectedTemplate.name}</CardTitle>
              <CardDescription>{selectedTemplate.description}</CardDescription>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                <TabsList>
                  <TabsTrigger value="evaluation">Evaluation Form</TabsTrigger>
                  <TabsTrigger value="preview">Form Preview</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <TabsContent value="evaluation" className="p-6 pt-2">
                  <ScrollArea className="h-[60vh]">
                    {selectedTemplate.pillars && selectedTemplate.pillars.map((pillar) => (
                      <div key={pillar.id} className="mb-6">
                        <div 
                          className="flex items-center justify-between bg-muted p-3 rounded-md cursor-pointer"
                          onClick={() => togglePillar(pillar.id)}
                        >
                          <div>
                            <h3 className="text-lg font-medium">{pillar.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              Weightage: {pillar.weightage}%
                            </p>
                          </div>
                          {expandedPillar === pillar.id ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </div>
                        
                        {expandedPillar === pillar.id && pillar.parameters && (
                          <div className="mt-3 pl-3 border-l-2 border-muted space-y-6">
                            {pillar.parameters.map((parameter) => {
                              const parameterIndex = form.getValues().scores.findIndex(
                                s => s.parameterId === parameter.id
                              );
                              
                              return (
                                <div key={parameter.id} className="bg-card p-4 rounded-md border">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <div className="flex items-center">
                                        <h4 className="font-medium">{parameter.name}</h4>
                                        {parameter.isFatal && (
                                          <span className="ml-2 text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                                            Fatal Error
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground">
                                        Weightage: {parameter.weightage}
                                      </p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleGuidelines(parameter.id);
                                      }}
                                    >
                                      <Info className="h-4 w-4 mr-1" />
                                      Guidelines
                                    </Button>
                                  </div>
                                  
                                  {expandedGuidelines === parameter.id && (
                                    <div className="bg-muted p-3 rounded-md mb-3 text-sm">
                                      {parameter.guidelines}
                                    </div>
                                  )}
                                  
                                  <FormField
                                    control={form.control}
                                    name={`scores.${parameterIndex}.score`}
                                    render={({ field }) => (
                                      <FormItem className="space-y-1">
                                        <FormLabel>Assessment</FormLabel>
                                        <FormControl>
                                          <RadioGroup
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            className="flex space-x-4"
                                          >
                                            <div className="flex items-center space-x-1">
                                              <RadioGroupItem value="yes" id={`${parameter.id}-yes`} />
                                              <Label htmlFor={`${parameter.id}-yes`} className="flex items-center">
                                                <CheckCircle2 className="h-4 w-4 mr-1 text-green-600" />
                                                Yes
                                              </Label>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                              <RadioGroupItem value="no" id={`${parameter.id}-no`} />
                                              <Label htmlFor={`${parameter.id}-no`} className="flex items-center">
                                                <XCircle className="h-4 w-4 mr-1 text-red-600" />
                                                No
                                              </Label>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                              <RadioGroupItem value="na" id={`${parameter.id}-na`} />
                                              <Label htmlFor={`${parameter.id}-na`} className="flex items-center">
                                                <AlertCircle className="h-4 w-4 mr-1 text-yellow-600" />
                                                N/A
                                              </Label>
                                            </div>
                                          </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  {form.getValues().scores[parameterIndex]?.score === 'no' && (
                                    <>
                                      {parameter.noReasons && parameter.noReasons.length > 0 && (
                                        <FormField
                                          control={form.control}
                                          name={`scores.${parameterIndex}.noReason`}
                                          render={({ field }) => (
                                            <FormItem className="mt-2">
                                              <FormLabel>Reason</FormLabel>
                                              <FormControl>
                                                <RadioGroup
                                                  onValueChange={field.onChange}
                                                  value={field.value}
                                                  className="space-y-1"
                                                >
                                                  {parameter.noReasons.map((reason) => (
                                                    <div key={reason} className="flex items-center space-x-2">
                                                      <RadioGroupItem value={reason} id={`${parameter.id}-${reason}`} />
                                                      <Label htmlFor={`${parameter.id}-${reason}`}>{reason}</Label>
                                                    </div>
                                                  ))}
                                                </RadioGroup>
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                      )}
                                      
                                      <FormField
                                        control={form.control}
                                        name={`scores.${parameterIndex}.comment`}
                                        render={({ field }) => (
                                          <FormItem className="mt-2">
                                            <FormLabel>Comments {parameter.requiresComment && '*'}</FormLabel>
                                            <FormControl>
                                              <Textarea
                                                placeholder="Add your comments..."
                                                className="resize-none"
                                                {...field}
                                              />
                                            </FormControl>
                                            {parameter.requiresComment && (
                                              <FormDescription className="text-xs">
                                                * Comment is required for this parameter
                                              </FormDescription>
                                            )}
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </ScrollArea>
                  
                  <div className="mt-6 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">Final Score: {Math.round(calculateFinalScore())}%</p>
                      {!isEvaluationComplete() && (
                        <p className="text-sm text-destructive">Please complete all required fields</p>
                      )}
                    </div>
                    <div className="space-x-2">
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => navigate('/audio-assignment-dashboard')}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={!isEvaluationComplete() || submitEvaluation.isPending}
                      >
                        {submitEvaluation.isPending ? (
                          <>
                            <Spinner className="mr-2 h-4 w-4" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Submit Evaluation
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </form>
            </Form>
            
            <TabsContent value="preview" className="p-6 pt-2">
              <ScrollArea className="h-[60vh]">
                <div className="space-y-6">
                  {selectedTemplate.pillars && selectedTemplate.pillars.map((pillar) => (
                    <div key={pillar.id} className="mb-6">
                      <h3 className="text-lg font-medium bg-muted p-3 rounded-md">{pillar.name}</h3>
                      <div className="mt-3 pl-3 border-l-2 border-muted space-y-4">
                        {pillar.parameters && pillar.parameters.map((parameter) => (
                          <div key={parameter.id} className="bg-card p-4 rounded-md border">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-medium">{parameter.name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  Weightage: {parameter.weightage}
                                </p>
                              </div>
                              {parameter.isFatal && (
                                <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                                  Fatal Error
                                </span>
                              )}
                            </div>
                            <p className="text-sm bg-muted p-2 rounded-md">{parameter.guidelines}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AudioEvaluationInterface;