import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { 
  BarChart, 
  FileDown, 
  Download,
  Filter,
  Calendar,
  Search,
  X,
  ClipboardCheck
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";

// Types for data export
type ExportDataType = 'attendance' | 'trainee-progress' | 'evaluation-results' | 'quiz-results' | 'custom';
type Batch = {
  id: number;
  name: string;
  status: string;
  [key: string]: any;
};
type EvaluationTemplate = {
  id: number;
  name: string;
  status: string;
  processId: number;
  description?: string;
  [key: string]: any;
};

// Function to download data as CSV
const downloadCSV = (data: any[], filename: string) => {
  // Convert data to CSV format
  const csvContent = convertToCSV(data);
  
  // Create a blob and download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Helper function to convert data to CSV format
const convertToCSV = (data: any[]): string => {
  if (data.length === 0) return '';
  
  // Extract headers
  const headers = Object.keys(data[0]);
  
  // Create header row
  const headerRow = headers.join(',');
  
  // Create data rows
  const rows = data.map(obj => {
    return headers.map(header => {
      const value = obj[header];
      // Handle values with commas by wrapping in quotes
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    }).join(',');
  });
  
  // Combine header and data rows
  return [headerRow, ...rows].join('\n');
};

export default function Reports() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("raw-data");
  const [selectedDataType, setSelectedDataType] = useState<ExportDataType>('attendance');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedEvaluationTemplateId, setSelectedEvaluationTemplateId] = useState<string>("");
  
  // Fetch batches
  const { data: batches, isLoading: isBatchesLoading } = useQuery<Batch[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId
  });
  
  // Fetch evaluation templates
  const { data: evaluationTemplates, isLoading: isTemplatesLoading } = useQuery<EvaluationTemplate[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
    enabled: !!user?.organizationId
  });

  // Separate batches into running and completed batches, then apply search filter
  const runningBatches = batches
    ? batches.filter(batch => 
        // Consider all batches as running except those with "completed" status
        batch.status !== 'completed' && batch.status !== 'Completed'
      )
      .filter(batch => {
        if (!searchTerm.trim()) return true;
        const searchLower = searchTerm.toLowerCase();
        return batch.name.toLowerCase().includes(searchLower);
      })
    : [];
    
  const completedBatches = batches
    ? batches.filter(batch => 
        // Only include batches with completed status
        batch.status === 'completed' || batch.status === 'Completed'
      )
      .filter(batch => {
        if (!searchTerm.trim()) return true;
        const searchLower = searchTerm.toLowerCase();
        return batch.name.toLowerCase().includes(searchLower);
      })
    : [];
  
  // Function to handle batch selection
  const toggleBatchSelection = (batchId: string) => {
    setSelectedBatchIds(prevSelected => {
      if (prevSelected.includes(batchId)) {
        return prevSelected.filter(id => id !== batchId);
      } else {
        return [...prevSelected, batchId];
      }
    });
  };

  // Function to download raw data
  const handleDownloadRawData = () => {
    try {
      if (selectedDataType === 'attendance') {
        // Validate dates at minimum
        if (!startDate && !endDate && selectedBatchIds.length === 0) {
          toast({
            title: "Missing Information",
            description: "Please select at least a date range or one or more batches.",
            variant: "destructive"
          });
          return;
        }
        
        // Show loading toast
        toast({
          title: "Preparing Export",
          description: "Gathering attendance data for download...",
        });
        
        // Construct the API URL with the right parameters
        const batchIdsParam = selectedBatchIds.length > 0 ? `batchIds=${selectedBatchIds.join(',')}` : '';
        const startDateParam = startDate ? `startDate=${format(startDate, 'yyyy-MM-dd')}` : '';
        const endDateParam = endDate ? `endDate=${format(endDate, 'yyyy-MM-dd')}` : '';
        
        // Debug log to see what parameters are being sent
        console.log('Selected batch IDs:', selectedBatchIds);
        console.log('Batch IDs param:', batchIdsParam);
        
        // Combine the parameters
        const queryParams = [batchIdsParam, startDateParam, endDateParam]
          .filter(param => param !== '')
          .join('&');
        
        // Fetch attendance data from API
        fetch(`/api/organizations/${user?.organizationId}/attendance/export?${queryParams}`)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Server responded with status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            if (data && Array.isArray(data) && data.length > 0) {
              downloadCSV(data, 'attendance_data');
              toast({
                title: "Data Exported Successfully",
                description: `${data.length} records have been downloaded as CSV.`,
              });
            } else {
              toast({
                title: "No Data Found",
                description: "There are no attendance records matching your criteria.",
              });
            }
            setIsExportDialogOpen(false);
          })
          .catch(error => {
            console.error("Error exporting data:", error);
            toast({
              title: "Export Failed",
              description: "There was a problem exporting the data.",
              variant: "destructive"
            });
          });
      } else if (selectedDataType === 'evaluation-results') {
        // Show loading toast
        toast({
          title: "Preparing Export",
          description: "Gathering evaluation results data for download...",
        });
        
        // Construct the API URL with the right parameters
        const batchIdsParam = selectedBatchIds.length > 0 ? `batchIds=${selectedBatchIds.join(',')}` : '';
        const startDateParam = startDate ? `startDate=${format(startDate, 'yyyy-MM-dd')}` : '';
        const endDateParam = endDate ? `endDate=${format(endDate, 'yyyy-MM-dd')}` : '';
        const templateIdParam = selectedEvaluationTemplateId && selectedEvaluationTemplateId !== 'all' ? `templateId=${selectedEvaluationTemplateId}` : '';
        
        // Combine the parameters
        const queryParams = [batchIdsParam, startDateParam, endDateParam, templateIdParam]
          .filter(param => param !== '')
          .join('&');
        
        // Fetch evaluation data from API
        fetch(`/api/organizations/${user?.organizationId}/evaluations/export?${queryParams}`)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Server responded with status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            if (data && Array.isArray(data) && data.length > 0) {
              downloadCSV(data, 'evaluation_results');
              toast({
                title: "Data Exported Successfully",
                description: `${data.length} records have been downloaded as CSV.`,
              });
            } else {
              toast({
                title: "No Data Found",
                description: "There are no evaluation records matching your criteria.",
              });
            }
            setIsExportDialogOpen(false);
          })
          .catch(error => {
            console.error("Error exporting evaluation data:", error);
            toast({
              title: "Export Failed",
              description: "There was a problem exporting the evaluation data.",
              variant: "destructive"
            });
          });
      } else {
        // Handle other data types
        toast({
          title: "Feature Coming Soon",
          description: `Export for ${selectedDataType} data will be available soon.`,
        });
      }
    } catch (error) {
      console.error("Error generating CSV:", error);
      toast({
        title: "Error Generating CSV",
        description: "There was a problem creating the CSV file.",
        variant: "destructive"
      });
    }
  };

  // We will add more export types here in the future
  const getExportTypeName = (type: ExportDataType): string => {
    switch (type) {
      case 'attendance':
        return 'Attendance Data';
      case 'trainee-progress':
        return 'Trainee Progress';
      case 'evaluation-results':
        return 'Evaluation Results';
      case 'quiz-results':
        return 'Quiz Results';
      case 'custom':
        return 'Custom Report';
      default:
        return 'Unknown Data Type';
    }
  };
  
  return (
    <div className="container mx-auto py-6 max-w-7xl space-y-8">
      <Helmet>
        <title>Reports | ZenCX Studio</title>
      </Helmet>
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Access and download raw data for analysis and reporting
          </p>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full bg-background border rounded-lg p-1 h-auto flex flex-wrap">
          <TabsTrigger value="raw-data" className="flex-1 py-2 data-[state=active]:bg-indigo-100/40 data-[state=active]:text-indigo-700">
            <Download className="h-4 w-4 mr-2" />
            Raw Data Export
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex-1 py-2 data-[state=active]:bg-indigo-100/40 data-[state=active]:text-indigo-700">
            <BarChart className="h-4 w-4 mr-2" />
            Reports Dashboard
          </TabsTrigger>
        </TabsList>
        
        {/* Raw Data Export Tab */}
        <TabsContent value="raw-data" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Attendance Data Export Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Calendar className="h-5 w-5 mr-2 text-indigo-600" />
                  Attendance Data
                </CardTitle>
                <CardDescription>
                  Export daily attendance records for trainees
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Download raw attendance data including present, absent, late, and leave status for trainees.
                </p>
              </CardContent>
              <CardFooter>
                <Dialog open={isExportDialogOpen && selectedDataType === 'attendance'} onOpenChange={(open) => {
                  setIsExportDialogOpen(open);
                  if (open) setSelectedDataType('attendance');
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <FileDown className="h-4 w-4 mr-2" />
                      Export Attendance Data
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </CardFooter>
            </Card>
            
            {/* Evaluation Results Export Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <BarChart className="h-5 w-5 mr-2 text-indigo-600" />
                  Evaluation Results
                </CardTitle>
                <CardDescription>
                  Export detailed evaluation data with parameters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Download comprehensive evaluation results including parameter details, scores, agent info, and audio references.
                </p>
              </CardContent>
              <CardFooter>
                <Dialog open={isExportDialogOpen && selectedDataType === 'evaluation-results'} onOpenChange={(open) => {
                  setIsExportDialogOpen(open);
                  if (open) setSelectedDataType('evaluation-results');
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <FileDown className="h-4 w-4 mr-2" />
                      Export Evaluation Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Export Evaluation Results</DialogTitle>
                      <DialogDescription>
                        Select your filters to export detailed evaluation data with parameter-level details.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                      {/* Template Selection */}
                      <div className="space-y-2">
                        <Label htmlFor="template">Evaluation Template (Optional)</Label>
                        <Select 
                          value={selectedEvaluationTemplateId} 
                          onValueChange={setSelectedEvaluationTemplateId}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a template..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Templates</SelectItem>
                            {evaluationTemplates && evaluationTemplates.map((template: EvaluationTemplate) => (
                              <SelectItem key={template.id} value={template.id.toString()}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Select a specific template to filter the evaluations, or leave blank to include all templates.
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="batch">Select Batches (Optional)</Label>
                        <p className="text-sm text-muted-foreground mb-2">
                          Click on any batch below to select it for filtering. You can select multiple batches.
                        </p>
                        <div className="relative">
                          <div className="flex items-center border rounded-md pl-3 pr-1 py-2">
                            <Search className="h-4 w-4 text-muted-foreground mr-2 flex-shrink-0" />
                            <Input
                              className="border-0 p-0 shadow-none focus-visible:ring-0"
                              placeholder="Search batches..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                          </div>
                        </div>
                        
                        {selectedBatchIds.length > 0 && (
                          <div className="mt-3 mb-2">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium">Selected Batches ({selectedBatchIds.length})</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 px-2"
                                onClick={() => {
                                  console.log('Clearing all batch selections');
                                  setSelectedBatchIds([]);
                                }}
                              >
                                Clear All
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/20">
                              {selectedBatchIds.map(id => {
                                const batch = batches?.find(b => b.id.toString() === id);
                                return (
                                  <Badge key={id} variant="outline" className="py-1 px-2 bg-background flex items-center gap-1">
                                    <span>{batch?.name || id}</span>
                                    <X
                                      className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        console.log('Removing batch from badge:', id);
                                        toggleBatchSelection(id);
                                      }}
                                    />
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        <ScrollArea className="h-60 border rounded-md p-2">
                          {isBatchesLoading ? (
                            <div className="p-2 text-center text-muted-foreground">Loading batches...</div>
                          ) : (
                            <div className="grid grid-cols-2 gap-4">
                              {/* Running Batches Section */}
                              <div>
                                <h4 className="font-medium text-sm mb-2 px-1 flex items-center">
                                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                                  Active/Running Batches
                                </h4>
                                {runningBatches.length > 0 ? (
                                  <div className="space-y-1 max-h-48 overflow-auto pr-1">
                                    {runningBatches.map(batch => (
                                      <div
                                        key={batch.id}
                                        className={`flex items-center space-x-2 p-2 rounded-md cursor-pointer border transition-colors ${
                                          selectedBatchIds.includes(batch.id.toString()) 
                                            ? 'bg-primary/10 border-primary/30' 
                                            : 'hover:bg-accent hover:border-accent/50 border-transparent'
                                        }`}
                                        onClick={() => {
                                          console.log('Toggling running batch:', batch.id, batch.name);
                                          toggleBatchSelection(batch.id.toString());
                                        }}
                                      >
                                        <Checkbox
                                          id={`batch-${batch.id}`}
                                          checked={selectedBatchIds.includes(batch.id.toString())}
                                          onCheckedChange={() => {}}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleBatchSelection(batch.id.toString());
                                          }}
                                          className="h-5 w-5"
                                        />
                                        <div className="flex-1 overflow-hidden">
                                          <span className="font-medium text-sm truncate block">{batch.name}</span>
                                          <span className="text-xs text-muted-foreground">
                                            ({batch.status})
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-2 text-sm text-center text-muted-foreground border border-dashed rounded-md">
                                    {searchTerm
                                      ? "No running batches match your search"
                                      : "No running batches available"}
                                  </div>
                                )}
                              </div>
                              
                              {/* Completed Batches Section */}
                              <div>
                                <h4 className="font-medium text-sm mb-2 px-1 flex items-center">
                                  <div className="w-2 h-2 rounded-full bg-slate-400 mr-2"></div>
                                  Completed Batches
                                </h4>
                                {completedBatches.length > 0 ? (
                                  <div className="space-y-1 max-h-48 overflow-auto pr-1">
                                    {completedBatches.map(batch => (
                                      <div
                                        key={batch.id}
                                        className={`flex items-center space-x-2 p-2 rounded-md cursor-pointer border transition-colors ${
                                          selectedBatchIds.includes(batch.id.toString()) 
                                            ? 'bg-primary/10 border-primary/30' 
                                            : 'hover:bg-accent hover:border-accent/50 border-transparent'
                                        }`}
                                        onClick={() => {
                                          console.log('Toggling completed batch:', batch.id, batch.name);
                                          toggleBatchSelection(batch.id.toString());
                                        }}
                                      >
                                        <Checkbox
                                          id={`batch-completed-${batch.id}`}
                                          checked={selectedBatchIds.includes(batch.id.toString())}
                                          onCheckedChange={() => {}}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleBatchSelection(batch.id.toString());
                                          }}
                                          className="h-5 w-5"
                                        />
                                        <div className="flex-1 overflow-hidden">
                                          <span className="font-medium text-sm truncate block">{batch.name}</span>
                                          <span className="text-xs text-muted-foreground">
                                            ({batch.status})
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-2 text-sm text-center text-muted-foreground border border-dashed rounded-md">
                                    {searchTerm
                                      ? "No completed batches match your search"
                                      : "No completed batches available"}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Start Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                {startDate ? format(startDate, "PPP") : "Select start date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <CalendarComponent
                                mode="single"
                                selected={startDate}
                                onSelect={setStartDate}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>End Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                {endDate ? format(endDate, "PPP") : "Select end date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <CalendarComponent
                                mode="single"
                                selected={endDate}
                                onSelect={setEndDate}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleDownloadRawData} 
                        disabled={!startDate && !endDate && selectedBatchIds.length === 0}
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        Export Data
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
            
            {/* Trainee Progress Export Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <BarChart className="h-5 w-5 mr-2 text-green-600" />
                  Trainee Progress
                </CardTitle>
                <CardDescription>
                  Export performance and progress data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Download trainee performance metrics, progress tracking, and completion rates.
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" 
                  onClick={() => {
                    toast({
                      title: "Feature Coming Soon",
                      description: "Trainee progress export will be available soon.",
                    });
                  }}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export Progress Data
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Available Reports</CardTitle>
                <CardDescription>Export data from the system for analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <p className="text-sm text-muted-foreground">
                    Choose a report type from the cards above to export data. More report types coming soon.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Reports Dashboard Tab */}
        <TabsContent value="reports" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Reports Dashboard</CardTitle>
              <CardDescription>
                View and generate custom reports (Coming soon)
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <div className="text-center">
                <BarChart className="h-16 w-16 mx-auto text-muted-foreground opacity-20 mb-4" />
                <h3 className="text-lg font-medium mb-2">Reports Dashboard Coming Soon</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  The comprehensive reporting dashboard is under development. You'll soon be able to 
                  create custom reports, visualize data, and schedule automated exports.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}