import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { format } from 'date-fns';
import { CalendarIcon, FileDown, FolderClosed, FolderOpen, Check, FileAudio, CloudUpload, Users, ChevronDown, RefreshCw } from 'lucide-react';

const IntegratedAudioAllocation = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // States for step tracking 
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [allStepsComplete, setAllStepsComplete] = useState<boolean>(false);

  // State for container and folder selection
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>([]);

  // State for allocation details
  const [allocationName, setAllocationName] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [distributionMethod, setDistributionMethod] = useState<'random' | 'agent-balanced'>('random');
  const [qualityAnalysts, setQualityAnalysts] = useState<{ id: number, count: number }[]>([]);
  
  // State for file upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  // State for results
  const [processingResults, setProcessingResults] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch containers
  const { 
    data: containers = [], 
    isLoading: isLoadingContainers,
    refetch: refetchContainers
  } = useQuery({
    queryKey: ['/api/azure-containers'],
    refetchOnWindowFocus: false,
  });

  // Fetch folders for the selected container
  const { 
    data: folderList, 
    isLoading: isLoadingFolders,
    refetch: refetchFolders
  } = useQuery({
    queryKey: ['/api/azure-folders', selectedContainer],
    queryFn: async () => {
      if (!selectedContainer) return [];
      const response = await apiRequest('GET', `/api/azure-folders/${selectedContainer}`);
      return response.json();
    },
    enabled: !!selectedContainer,
    refetchOnWindowFocus: false,
  });

  // Fetch quality analysts
  const { data: qaList = [], isLoading: isLoadingQAs } = useQuery({
    queryKey: ['/api/users/quality-analysts'],
    refetchOnWindowFocus: false,
  });

  // Process batch mutation
  const processBatchMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest('POST', '/api/azure-folder-batch-process', {
        body: formData,
        isFormData: true
      });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setProcessingResults(data);
      toast({
        title: 'Success',
        description: `Processed ${data.successCount} files and created ${data.allocationsCreated} allocations.`,
      });
      // Reset form and mark flow as complete
      setAllStepsComplete(true);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/' + user?.organizationId + '/audio-file-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/' + user?.organizationId + '/audio-files'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process audio files',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });

  // Effect to update folders when container changes
  useEffect(() => {
    if (folderList) {
      setFolders(folderList);
      setSelectedFolder(null); // Reset folder selection when container changes
    }
  }, [folderList]);

  // Effect to reset steps when major selection changes
  useEffect(() => {
    if (currentStep > 1 && !selectedContainer) {
      setCurrentStep(1);
    }
  }, [selectedContainer, currentStep]);

  // Handler for quality analyst assignment
  const handleQualityAnalystChange = (analystId: number, count: number) => {
    const updatedAnalysts = [...qualityAnalysts];
    const existingIndex = updatedAnalysts.findIndex(a => a.id === analystId);
    
    if (existingIndex >= 0) {
      if (count <= 0) {
        // Remove analyst if count is 0 or negative
        updatedAnalysts.splice(existingIndex, 1);
      } else {
        // Update count
        updatedAnalysts[existingIndex].count = count;
      }
    } else if (count > 0) {
      // Add new analyst with count
      updatedAnalysts.push({ id: analystId, count });
    }
    
    setQualityAnalysts(updatedAnalysts);
  };

  // Calculate total file allocation
  const totalAllocations = qualityAnalysts.reduce((sum, qa) => sum + qa.count, 0);

  // Handle form submission
  const handleSubmit = () => {
    if (!selectedContainer) {
      toast({
        title: 'Missing Container',
        description: 'Please select an Azure storage container',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedFolder) {
      toast({
        title: 'Missing Folder',
        description: 'Please select a folder containing audio files',
        variant: 'destructive',
      });
      return;
    }

    if (!uploadFile) {
      toast({
        title: 'Missing Metadata',
        description: 'Please upload an Excel file with audio file metadata',
        variant: 'destructive',
      });
      return;
    }

    if (qualityAnalysts.length === 0) {
      toast({
        title: 'Missing Assignments',
        description: 'Please assign at least one quality analyst',
        variant: 'destructive',
      });
      return;
    }

    if (totalAllocations === 0) {
      toast({
        title: 'Invalid Assignments',
        description: 'Total allocation count must be greater than 0',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    // Create form data for the request
    const formData = new FormData();
    formData.append('containerName', selectedContainer);
    formData.append('folderPath', selectedFolder);
    formData.append('metadataFile', uploadFile);
    formData.append('name', allocationName || `Allocation ${format(new Date(), 'yyyy-MM-dd HH:mm')}`);
    formData.append('distributionMethod', distributionMethod);
    
    if (selectedDate) {
      formData.append('dueDate', selectedDate.toISOString());
    }
    
    qualityAnalysts.forEach(qa => {
      formData.append('qualityAnalysts[]', JSON.stringify({ id: qa.id, count: qa.count }));
    });

    processBatchMutation.mutate(formData);
  };

  // Reset the form for a new allocation
  const resetForm = () => {
    setSelectedContainer(null);
    setSelectedFolder(null);
    setUploadFile(null);
    setAllocationName('');
    setSelectedDate(new Date());
    setDistributionMethod('random');
    setQualityAnalysts([]);
    setProcessingResults(null);
    setAllStepsComplete(false);
    setCurrentStep(1);
  };

  // Step rendering functions
  const renderStep1 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Step 1: Select Container and Folder</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Container</Label>
          <Select value={selectedContainer || ''} onValueChange={(value) => setSelectedContainer(value || null)}>
            <SelectTrigger>
              <SelectValue placeholder="Select container" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingContainers ? (
                <div className="flex justify-center p-2">
                  <Spinner size="sm" />
                </div>
              ) : containers && containers.length > 0 ? (
                containers.map((container: { name: string }) => (
                  <SelectItem key={container.name} value={container.name}>
                    {container.name}
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  No containers found
                </div>
              )}
            </SelectContent>
          </Select>
          <div className="flex justify-end">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => {
                e.preventDefault();
                refetchContainers();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Folder</Label>
          <Select 
            value={selectedFolder || ''} 
            onValueChange={(value) => setSelectedFolder(value)}
            disabled={!selectedContainer || isLoadingFolders}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingFolders ? (
                <div className="flex justify-center p-2">
                  <Spinner size="sm" />
                </div>
              ) : folders && folders.length > 0 ? (
                folders.map((folder: string) => (
                  <SelectItem key={folder} value={folder}>
                    <div className="flex items-center">
                      <FolderClosed className="h-4 w-4 mr-2" />
                      {folder}
                    </div>
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  {selectedContainer ? 'No folders found' : 'Select a container first'}
                </div>
              )}
            </SelectContent>
          </Select>
          <div className="flex justify-end">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => {
                e.preventDefault();
                refetchFolders();
              }} 
              disabled={!selectedContainer}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <Button onClick={() => setCurrentStep(2)} disabled={!selectedContainer || !selectedFolder}>
          Next
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Step 2: Upload Metadata File</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Upload an Excel file containing metadata for the audio files in the selected folder.
        Make sure the filename column matches the actual filenames in Azure Storage.
      </p>
      
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="metadataFile">Metadata Excel File</Label>
          <div className="flex items-center gap-2">
            <Input 
              id="metadataFile" 
              type="file" 
              accept=".xlsx,.xls" 
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="flex-1"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <FileDown className="h-4 w-4 mr-2" />
                  Templates
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-auto" align="end">
                <div className="p-2 space-y-1">
                  <Button variant="ghost" className="w-full justify-start" asChild>
                    <a href="/api/azure-metadata-template" download="audio-metadata-template.xlsx">
                      Download Template
                    </a>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {uploadFile && (
            <div className="mt-2">
              <Badge variant="outline" className="flex items-center">
                <Check className="h-3 w-3 mr-1 text-green-500" />
                {uploadFile.name} ({Math.round(uploadFile.size / 1024)} KB)
              </Badge>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-between mt-4">
        <Button variant="outline" onClick={() => setCurrentStep(1)}>
          Back
        </Button>
        <Button onClick={() => setCurrentStep(3)} disabled={!uploadFile}>
          Next
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Step 3: Allocation Details</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="allocationName">Allocation Name</Label>
          <Input 
            id="allocationName" 
            placeholder="e.g., April QA Batch" 
            value={allocationName}
            onChange={(e) => setAllocationName(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="dueDate">Due Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                type="button"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? (
                  format(selectedDate, "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        
        <div className="space-y-2 col-span-1 md:col-span-2">
          <Label htmlFor="distributionMethod">Distribution Method</Label>
          <Select 
            value={distributionMethod} 
            onValueChange={(value: 'random' | 'agent-balanced') => setDistributionMethod(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select distribution method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="random">Random distribution</SelectItem>
              <SelectItem value="agent-balanced">Agent-balanced distribution</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {distributionMethod === 'agent-balanced' 
              ? 'Agent-balanced distribution ensures each QA receives a balanced mix of calls from different agents'
              : 'Random distribution allocates files randomly to quality analysts'}
          </p>
        </div>
      </div>
      
      <div className="space-y-2 mt-6">
        <div className="flex justify-between items-center">
          <Label>Quality Analysts</Label>
          <Badge className="bg-primary">
            {totalAllocations} Files Planned
          </Badge>
        </div>
        
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isLoadingQAs ? (
                <div className="col-span-2 flex justify-center py-4">
                  <Spinner />
                </div>
              ) : qaList.filter((qa: { role: string }) => qa.role === 'quality_analyst').length > 0 ? (
                qaList.filter((qa: { role: string }) => qa.role === 'quality_analyst').map((analyst: { id: number; fullName: string; employeeId: string }) => (
                  <div key={analyst.id} className="flex items-center justify-between border p-2 rounded-md">
                    <div>
                      <p className="font-medium">{analyst.fullName}</p>
                      <p className="text-sm text-muted-foreground">{analyst.employeeId}</p>
                    </div>
                    <div className="flex items-center">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => {
                          const current = qualityAnalysts.find(a => a.id === analyst.id)?.count || 0;
                          handleQualityAnalystChange(analyst.id, Math.max(0, current - 1));
                        }}
                      >
                        -
                      </Button>
                      <span className="w-12 text-center">
                        {qualityAnalysts.find(a => a.id === analyst.id)?.count || 0}
                      </span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => {
                          const current = qualityAnalysts.find(a => a.id === analyst.id)?.count || 0;
                          handleQualityAnalystChange(analyst.id, current + 1);
                        }}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-4 text-muted-foreground">
                  No quality analysts available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex justify-between mt-4">
        <Button variant="outline" onClick={() => setCurrentStep(2)}>
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || qualityAnalysts.length === 0 || totalAllocations === 0}>
          {isSubmitting ? <Spinner className="mr-2" size="sm" /> : null}
          Process & Allocate
        </Button>
      </div>
    </div>
  );

  const renderResults = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Allocation Complete</h3>
      
      <Card>
        <CardHeader>
          <CardTitle>Processing Results</CardTitle>
          <CardDescription>
            Summary of the processed files and allocations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm text-muted-foreground">Total Files</p>
                <p className="text-2xl font-bold">{processingResults?.totalProcessed || 0}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold text-green-600">{processingResults?.successCount || 0}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{processingResults?.errorCount || 0}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm text-muted-foreground">Allocations</p>
                <p className="text-2xl font-bold text-blue-600">{processingResults?.allocationsCreated || 0}</p>
              </div>
            </div>
            
            {processingResults?.results && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">File Details</h4>
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  <table className="min-w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left text-xs">File</th>
                        <th className="p-2 text-left text-xs">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processingResults.results.map((result: { file: string; status: string }, index: number) => (
                        <tr key={index} className="border-t">
                          <td className="p-2 text-xs font-mono">{result.file}</td>
                          <td className="p-2">
                            {result.status === 'success' ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700">Success</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-50 text-red-700">Error</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={resetForm} className="w-full">
            Create Another Allocation
          </Button>
        </CardFooter>
      </Card>
    </div>
  );

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-2">Integrated Audio Allocation</h1>
      <p className="text-muted-foreground mb-6">
        Streamlined process to select folder, upload metadata, and allocate files to QAs in one workflow
      </p>
      
      <Card>
        <CardContent className="p-6">
          {allStepsComplete ? (
            renderResults()
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center">
                      <div 
                        className={`rounded-full h-8 w-8 flex items-center justify-center ${
                          currentStep === step 
                            ? 'bg-primary text-primary-foreground' 
                            : currentStep > step 
                              ? 'bg-primary/20 text-primary' 
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {currentStep > step ? <Check className="h-4 w-4" /> : step}
                      </div>
                      {step < 3 && (
                        <div 
                          className={`h-1 w-12 ${
                            currentStep > step ? 'bg-primary' : 'bg-muted'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegratedAudioAllocation;