import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FileAudio, Eye, Edit, CheckCircle, XCircle, Search } from 'lucide-react';
import { format } from 'date-fns';

// Define the format for evaluation data
interface EvaluationData {
  id: number;
  trainee: {
    fullName: string;
  };
  templateName: string;
  evaluationType: 'standard' | 'audio';
  finalScore: number;
  createdAt: string;
  isPassed: boolean;
  audioFilename?: string;
}

// Component for displaying completed evaluations
export function CompletedEvaluations() {
  // State variables
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackTabType, setFeedbackTabType] = useState<"standard" | "audio">("standard");
  const [selectedEvaluation, setSelectedEvaluation] = useState<number | null>(null);
  const [evaluationDetails, setEvaluationDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch all evaluations
  const { data: evaluations = [], isLoading: loadingEvaluations } = useQuery({
    queryKey: ['/api/evaluations', 'all'],
  });

  // Filter evaluations based on search query
  const filteredStandardEvaluations = (evaluations as EvaluationData[]).filter(evaluation => 
    evaluation.evaluationType === 'standard' &&
    (searchQuery 
      ? evaluation.trainee?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        evaluation.id.toString().includes(searchQuery) ||
        evaluation.templateName?.toLowerCase().includes(searchQuery.toLowerCase())
      : true)
  );

  const filteredAudioEvaluations = (evaluations as EvaluationData[]).filter(evaluation => 
    evaluation.evaluationType === 'audio' &&
    (searchQuery 
      ? evaluation.trainee?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        evaluation.id.toString().includes(searchQuery) ||
        evaluation.audioFilename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evaluation.templateName?.toLowerCase().includes(searchQuery.toLowerCase())
      : true)
  );

  // Function to get the badge class based on score
  const getScoreBadgeClass = (score: number) => {
    return score >= 80 
      ? "bg-green-50 text-green-600 border-green-200" 
      : "bg-red-50 text-red-600 border-red-200";
  };

  // Function to fetch evaluation details
  const fetchEvaluationDetails = async (evaluationId: number) => {
    try {
      setLoadingDetails(true);
      const response = await fetch(`/api/evaluations/${evaluationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch evaluation details');
      }
      const data = await response.json();
      setEvaluationDetails(data);
    } catch (error) {
      console.error('Error fetching evaluation details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">View Completed Evaluations</h1>
        <div className="flex gap-2 items-center">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search evaluations..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="standard" onValueChange={(value) => setFeedbackTabType(value as "standard" | "audio")}>
        <TabsList>
          <TabsTrigger value="standard">Standard Evaluations</TabsTrigger>
          <TabsTrigger value="audio">Audio Evaluations</TabsTrigger>
        </TabsList>

        <TabsContent value="standard" className="pt-4">
          {loadingEvaluations ? (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6 mr-2" />
              <span>Loading evaluations...</span>
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Standard Evaluation Feedback</CardTitle>
                <CardDescription>
                  View detailed feedback for all standard evaluations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Trainee</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStandardEvaluations.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="h-24 text-center"
                        >
                          No standard evaluations found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStandardEvaluations.map((evaluation) => (
                        <TableRow key={evaluation.id}>
                          <TableCell>{evaluation.id}</TableCell>
                          <TableCell>
                            {evaluation.trainee?.fullName || "Unknown Trainee"}
                          </TableCell>
                          <TableCell>{evaluation.templateName || "Unknown Template"}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={evaluation.isPassed ? "outline" : "destructive"}
                              className={evaluation.isPassed 
                                ? "bg-green-50 text-green-600 border-green-200" 
                                : "bg-red-50 text-red-600 border-red-200"
                              }
                            >
                              {evaluation.finalScore.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(evaluation.createdAt)}</TableCell>
                          <TableCell>
                            {evaluation.isPassed 
                              ? <CheckCircle className="h-4 w-4 text-green-500" /> 
                              : <XCircle className="h-4 w-4 text-red-500" />
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEvaluation(evaluation.id);
                                fetchEvaluationDetails(evaluation.id);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="audio" className="pt-4">
          {loadingEvaluations ? (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6 mr-2" />
              <span>Loading evaluations...</span>
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Audio Evaluation Feedback</CardTitle>
                <CardDescription>
                  View detailed feedback for all audio evaluations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Trainee</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Audio File</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAudioEvaluations.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-24 text-center"
                        >
                          No audio evaluations found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAudioEvaluations.map((evaluation) => (
                        <TableRow key={evaluation.id}>
                          <TableCell>{evaluation.id}</TableCell>
                          <TableCell>
                            {evaluation.trainee?.fullName || "Unknown Trainee"}
                          </TableCell>
                          <TableCell>{evaluation.templateName || "Unknown Template"}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <FileAudio className="h-4 w-4 mr-1 text-primary" />
                              <span className="text-xs truncate max-w-[150px]">
                                {evaluation.audioFilename || "No File"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={evaluation.isPassed ? "outline" : "destructive"}
                              className={evaluation.isPassed 
                                ? "bg-green-50 text-green-600 border-green-200" 
                                : "bg-red-50 text-red-600 border-red-200"
                              }
                            >
                              {evaluation.finalScore.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(evaluation.createdAt)}</TableCell>
                          <TableCell>
                            {evaluation.isPassed 
                              ? <CheckCircle className="h-4 w-4 text-green-500" /> 
                              : <XCircle className="h-4 w-4 text-red-500" />
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEvaluation(evaluation.id);
                                fetchEvaluationDetails(evaluation.id);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Evaluation Details Dialog */}
      <Dialog open={loadingDetails || !!evaluationDetails} onOpenChange={(open) => {
        if (!open) {
          setEvaluationDetails(null);
          setSelectedEvaluation(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {loadingDetails ? (
            <div className="flex justify-center items-center py-12">
              <Spinner className="h-8 w-8 text-primary" />
            </div>
          ) : evaluationDetails ? (
            <>
              <DialogHeader>
                <div className="flex justify-between items-center">
                  <DialogTitle>Evaluation #{evaluationDetails.id}</DialogTitle>
                  <Badge 
                    variant={evaluationDetails.isPassed ? "outline" : "destructive"}
                    className={evaluationDetails.isPassed 
                      ? "bg-green-50 text-green-600 border-green-200" 
                      : "bg-red-50 text-red-600 border-red-200"
                    }
                  >
                    {evaluationDetails.finalScore?.toFixed(1)}%
                  </Badge>
                </div>
                <DialogDescription>
                  Conducted on {formatDate(evaluationDetails.createdAt)}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Trainee</h3>
                  <p>{evaluationDetails.trainee?.fullName || "Unknown"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Evaluator</h3>
                  <p>{evaluationDetails.evaluator?.fullName || "Unknown"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Template</h3>
                  <p>{evaluationDetails.templateName || "Unknown Template"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Type</h3>
                  <p className="capitalize">{evaluationDetails.evaluationType || "Standard"}</p>
                </div>
              </div>
              
              {evaluationDetails.evaluationType === "audio" && evaluationDetails.audioFilename && (
                <div className="mb-6 p-3 bg-muted rounded-md">
                  <h3 className="text-sm font-medium mb-2">Audio File</h3>
                  <div className="flex items-center mb-2">
                    <FileAudio className="h-4 w-4 mr-2 text-primary" />
                    <span>{evaluationDetails.audioFilename}</span>
                  </div>
                  {evaluationDetails.audioUrl && (
                    <audio controls className="w-full">
                      <source src={evaluationDetails.audioUrl} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  )}
                </div>
              )}
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Evaluation Parameters</h3>
                {evaluationDetails.scores && evaluationDetails.scores.length > 0 ? (
                  <Accordion type="multiple" className="w-full" defaultValue={['overview']}>
                    <AccordionItem value="overview">
                      <AccordionTrigger className="py-3">
                        <div className="flex justify-between w-full pr-6">
                          <span>Score Overview</span>
                          <Badge 
                            variant={evaluationDetails.isPassed ? "outline" : "destructive"}
                            className={evaluationDetails.isPassed 
                              ? "bg-green-50 text-green-600 border-green-200" 
                              : "bg-red-50 text-red-600 border-red-200"
                            }
                          >
                            {evaluationDetails.finalScore?.toFixed(1)}%
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 p-2">
                          {evaluationDetails.pillarScores && evaluationDetails.pillarScores.map((pillar: any) => (
                            <div 
                              key={pillar.id || pillar.pillarId}
                              className="flex justify-between items-center p-2 bg-background rounded border"
                            >
                              <span>{pillar.name}</span>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={pillar.score >= 80 ? "outline" : "destructive"}
                                  className={pillar.score >= 80
                                    ? "bg-green-50 text-green-600 border-green-200" 
                                    : "bg-red-50 text-red-600 border-red-200"
                                  }
                                >
                                  {pillar.score?.toFixed(1)}%
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  (Weight: {pillar.weight}%)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    
                    {evaluationDetails.pillarScores && evaluationDetails.pillarScores.map((pillar: any) => (
                      <AccordionItem 
                        key={pillar.id || pillar.pillarId} 
                        value={`pillar-${pillar.id || pillar.pillarId}`}
                      >
                        <AccordionTrigger className="py-3">
                          <div className="flex justify-between w-full pr-6">
                            <span>{pillar.name}</span>
                            <Badge 
                              variant={pillar.score >= 80 ? "outline" : "destructive"}
                              className={pillar.score >= 80
                                ? "bg-green-50 text-green-600 border-green-200" 
                                : "bg-red-50 text-red-600 border-red-200"
                              }
                            >
                              {pillar.score?.toFixed(1)}%
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 p-2">
                            {evaluationDetails.scores
                              .filter((score: any) => score.pillarId === pillar.id || score.pillarId === pillar.pillarId)
                              .map((score: any) => (
                                <div 
                                  key={score.id} 
                                  className="p-3 border rounded-md bg-card"
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="font-medium">{score.parameter?.name || score.parameterName}</div>
                                    <div className="flex items-center gap-2">
                                      <Badge 
                                        variant={parseInt(score.score) >= 3 ? "outline" : "destructive"}
                                        className={parseInt(score.score) >= 3
                                          ? "bg-green-50 text-green-600 border-green-200" 
                                          : parseInt(score.score) === 0
                                            ? "bg-gray-50 text-gray-600 border-gray-200"
                                            : "bg-red-50 text-red-600 border-red-200"
                                        }
                                      >
                                        {parseInt(score.score) === 0 ? "N/A" : score.score}
                                      </Badge>
                                    </div>
                                  </div>
                                  {(score.parameter?.description || score.parameterDescription) && (
                                    <p className="text-sm text-muted-foreground mb-2">
                                      {score.parameter?.description || score.parameterDescription}
                                    </p>
                                  )}
                                  {score.comment && (
                                    <div className="mt-2">
                                      <h4 className="text-sm font-medium mb-1">Comment:</h4>
                                      <p className="text-sm bg-muted p-2 rounded-md whitespace-pre-wrap">
                                        {score.comment}
                                      </p>
                                    </div>
                                  )}
                                  {score.naReason && (
                                    <div className="mt-2">
                                      <h4 className="text-sm font-medium mb-1">N/A Reason:</h4>
                                      <p className="text-sm bg-muted p-2 rounded-md whitespace-pre-wrap">
                                        {score.naReason}
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
                ) : (
                  <p className="text-muted-foreground">No detailed scores available for this evaluation.</p>
                )}
              </div>
              
              {evaluationDetails.comments && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">Overall Comments</h3>
                  <div className="p-3 bg-muted rounded-md whitespace-pre-wrap">
                    {evaluationDetails.comments}
                  </div>
                </div>
              )}
              
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => {
                  setEvaluationDetails(null);
                  setSelectedEvaluation(null);
                }}>
                  Close
                </Button>
                <Button onClick={() => window.location.href = `/conduct-evaluation/edit/${evaluationDetails.id}`}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Evaluation
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Error loading evaluation details
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}