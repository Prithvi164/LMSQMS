import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { 
  BarChart, 
  FileDown, 
  Download,
  Filter,
  Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

// Types for data export
type ExportDataType = 'attendance' | 'trainee-progress' | 'evaluation-results' | 'quiz-results' | 'custom';

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
  const [batchId, setBatchId] = useState<string>("");
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  
  // Additional attendance filter options
  const [showOnlyMarked, setShowOnlyMarked] = useState(true);
  const [selectedPhases, setSelectedPhases] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [includeTraineeDetails, setIncludeTraineeDetails] = useState(true);
  
  // Fetch batches
  const { data: batches, isLoading: isBatchesLoading } = useQuery<any[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId
  });

  // Function to download raw data
  const handleDownloadRawData = () => {
    try {
      if (selectedDataType === 'attendance') {
        // Validate required parameters
        if (!batchId) {
          toast({
            title: "Missing Information",
            description: "Please select a batch to export attendance data.",
            variant: "destructive"
          });
          return;
        }
        
        // Show loading toast
        toast({
          title: "Preparing Export",
          description: "Gathering attendance data for download...",
        });
        
        // Build URL with all filter parameters
        const baseUrl = `/api/organizations/${user?.organizationId}/batches/${batchId}/attendance/export`;
        
        // Create URL parameters
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', format(startDate, 'yyyy-MM-dd'));
        if (endDate) params.append('endDate', format(endDate, 'yyyy-MM-dd'));
        params.append('showOnlyMarked', showOnlyMarked.toString());
        
        if (selectedPhases.length > 0) {
          selectedPhases.forEach(phase => params.append('phases', phase));
        }
        
        if (selectedStatuses.length > 0) {
          selectedStatuses.forEach(status => params.append('statuses', status));
        }
        
        params.append('includeTraineeDetails', includeTraineeDetails.toString());
        
        // Fetch attendance data from API
        fetch(`${baseUrl}?${params.toString()}`)
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
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Export Attendance Data</DialogTitle>
                      <DialogDescription>
                        Select your filters to export specific attendance data.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="batch">Select Batch</Label>
                        <Select value={batchId} onValueChange={setBatchId}>
                          <SelectTrigger id="batch">
                            <SelectValue placeholder="Select a batch" />
                          </SelectTrigger>
                          <SelectContent>
                            {isBatchesLoading ? (
                              <SelectItem value="loading" disabled>Loading batches...</SelectItem>
                            ) : batches && batches.length > 0 ? (
                              batches.map(batch => (
                                <SelectItem key={batch.id} value={batch.id.toString()}>
                                  {batch.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>No batches available</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
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
                      
                      <Separator className="my-2" />
                      
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium">Advanced Filters</h3>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="show-only-marked" 
                            checked={showOnlyMarked}
                            onCheckedChange={(checked) => setShowOnlyMarked(checked as boolean)}
                          />
                          <Label htmlFor="show-only-marked" className="cursor-pointer">
                            Only include records where attendance is marked
                          </Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="include-trainee-details" 
                            checked={includeTraineeDetails}
                            onCheckedChange={(checked) => setIncludeTraineeDetails(checked as boolean)}
                          />
                          <Label htmlFor="include-trainee-details" className="cursor-pointer">
                            Include trainee contact details
                          </Label>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Filter by Phase</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {['training', 'certification', 'induction', 'ojt', 'ojt_certification'].map(phase => (
                              <div key={phase} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`phase-${phase}`} 
                                  checked={selectedPhases.includes(phase)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedPhases([...selectedPhases, phase]);
                                    } else {
                                      setSelectedPhases(selectedPhases.filter(p => p !== phase));
                                    }
                                  }}
                                />
                                <Label htmlFor={`phase-${phase}`} className="cursor-pointer capitalize">
                                  {phase.replace('_', ' ')}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Filter by Status</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {['present', 'absent', 'late', 'leave'].map(status => (
                              <div key={status} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`status-${status}`} 
                                  checked={selectedStatuses.includes(status)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedStatuses([...selectedStatuses, status]);
                                    } else {
                                      setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                                    }
                                  }}
                                />
                                <Label htmlFor={`status-${status}`} className="cursor-pointer capitalize">
                                  {status}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleDownloadRawData} disabled={!batchId}>
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
            
            {/* Evaluation Results Export Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Filter className="h-5 w-5 mr-2 text-purple-600" />
                  Evaluation Results
                </CardTitle>
                <CardDescription>
                  Export detailed evaluation scores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Download raw evaluation scores, feedback, and assessment data.
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full"
                  onClick={() => {
                    toast({
                      title: "Feature Coming Soon",
                      description: "Evaluation results export will be available soon.",
                    });
                  }}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export Evaluation Data
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