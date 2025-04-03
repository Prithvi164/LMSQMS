import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UploadCloud, FileAudio, Upload, Filter, Clock, FilePlus, FileSpreadsheet, Download, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import * as XLSX from 'xlsx';

// Helper functions
const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
  allocated: "bg-blue-100 text-blue-800 hover:bg-blue-200",
  evaluated: "bg-green-100 text-green-800 hover:bg-green-200",
  archived: "bg-gray-100 text-gray-800 hover:bg-gray-200"
};

const AudioFileManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [batchUploadDialogOpen, setBatchUploadDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadAudioFiles, setUploadAudioFiles] = useState<File[]>([]);
  const [metadataFile, setMetadataFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState({
    language: 'english',
    version: '',
    callMetrics: {
      callDate: new Date().toISOString().split('T')[0],
      callId: '',
      callType: 'inbound',
      agentId: '',
      customerSatisfaction: 0,
      handleTime: 0
    }
  });
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    language: 'all',
    version: '',
    status: 'any',
    duration: 'any',
    callType: 'all',
    agentId: '',
    campaignName: '',
    callDate: '',
    disposition1: '',
    disposition2: '',
    queryType: '',
    businessSegment: '',
    customerMobile: '',
    callTime: '',
    subType: '',
    subSubType: '',
    voc: '',
    userRole: '',
    advisorCategory: ''
  });

  // Query for fetching audio files
  const { data: audioFiles, isLoading, refetch } = useQuery({
    queryKey: ['/api/organizations/' + user?.organizationId + '/audio-files', filters],
    enabled: !!user?.organizationId,
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest('POST', '/api/audio-files/upload', formData);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Audio file uploaded successfully',
      });
      setUploadDialogOpen(false);
      setFile(null);
      setFileData({
        language: 'english',
        version: '',
        callMetrics: {
          callDate: new Date().toISOString().split('T')[0],
          callId: '',
          callType: 'inbound',
          agentId: '',
          customerSatisfaction: 0,
          handleTime: 0
        }
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to upload audio file: ${error.toString()}`,
        variant: 'destructive',
      });
    }
  });
  
  // Batch upload mutation
  const batchUploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest('POST', '/api/audio-files/batch-upload', formData);
      const responseData = await response.json();
      return responseData as { success: number; failed: number; failedFiles?: { originalFilename: string; error: string }[] };
    },
    onSuccess: (data: { success: number; failed: number; failedFiles?: { originalFilename: string; error: string }[] }) => {
      toast({
        title: 'Success',
        description: `Successfully uploaded ${data.success} audio files${data.failed > 0 ? `, ${data.failed} failed` : ''}.`,
      });
      
      // Show more detailed errors if files failed
      if (data.failedFiles && data.failedFiles.length > 0) {
        const failureReasons = data.failedFiles.map((file) => 
          `${file.originalFilename}: ${file.error}`
        ).join('\n');
        
        console.error('Failed files details:', failureReasons);
        
        if (data.failedFiles.length <= 3) {
          // Show toast with details for a few failures
          toast({
            variant: 'destructive',
            title: 'Some files failed to upload',
            description: data.failedFiles.map((file) => 
              `${file.originalFilename}: ${file.error}`
            ).join(', '),
          });
        } else {
          // For many failures, just show a summary
          toast({
            variant: 'destructive',
            title: 'Some files failed to upload',
            description: `${data.failedFiles.length} files failed. Check console for details.`,
          });
        }
      }
      
      setBatchUploadDialogOpen(false);
      setUploadAudioFiles([]);
      setMetadataFile(null);
      refetch();
    },
    onError: (error: any) => {
      // More helpful error message
      let errorMessage = error.toString();
      
      // Extract a more useful message from the error if available
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
      }
      
      console.error('Batch upload error:', error);
      
      toast({
        title: 'Error',
        description: `Failed to upload: ${errorMessage}`,
        variant: 'destructive',
      });
    }
  });

  // Update file status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      return apiRequest('PATCH', `/api/audio-files/${id}`, { status });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Audio file status updated successfully',
      });
      refetch();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: `Failed to update audio file status: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };
  
  const handleAudioFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadAudioFiles(Array.from(e.target.files));
    }
  };
  
  const handleMetadataFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMetadataFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = () => {
    if (!file) {
      toast({
        title: 'Error',
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }

    if (!fileData.version) {
      toast({
        title: 'Error',
        description: 'Please provide a version',
        variant: 'destructive',
      });
      return;
    }

    // Process ID check has been removed - server will handle the default process ID if needed

    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', fileData.language);
    formData.append('version', fileData.version);
    formData.append('callMetrics', JSON.stringify(fileData.callMetrics));
    formData.append('organizationId', user?.organizationId?.toString() || '');
    // Use a default process ID value since processId might not exist on user
    formData.append('processId', '1');
    
    uploadFileMutation.mutate(formData);
  };
  
  const handleBatchUploadSubmit = async () => {
    if (uploadAudioFiles.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one audio file to upload',
        variant: 'destructive',
      });
      return;
    }

    if (!metadataFile) {
      toast({
        title: 'Error',
        description: 'Please upload an Excel file with metadata',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Create FormData to send both audio files and metadata Excel file
      const formData = new FormData();
      
      // Based on server implementation, add all audio files to audioFiles[] field
      uploadAudioFiles.forEach((audioFile) => {
        formData.append('audioFiles', audioFile);
      });
      
      // Add the Excel file to metadataFile field
      formData.append('metadataFile', metadataFile);
      
      // Upload the batch directly - server will handle Excel parsing
      batchUploadMutation.mutate(formData);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    setFilters({
      language: 'all',
      version: '',
      status: 'any',
      duration: 'any',
      callType: 'all',
      agentId: '',
      campaignName: '',
      callDate: '',
      disposition1: '',
      disposition2: '',
      queryType: '',
      businessSegment: '',
      customerMobile: '',
      callTime: '',
      subType: '',
      subSubType: '',
      voc: '',
      userRole: '',
      advisorCategory: ''
    });
  };

  const getFilteredAudioFiles = () => {
    if (!audioFiles || !Array.isArray(audioFiles)) return [];

    // Explicitly cast audioFiles to an array type to satisfy TypeScript
    let filteredFiles = [...(audioFiles as any[])];
    
    // Apply tab filter
    if (activeTab !== 'all') {
      filteredFiles = filteredFiles.filter(file => file.status === activeTab);
    }
    
    // Apply additional filters
    if (filters.language && filters.language !== 'all') {
      filteredFiles = filteredFiles.filter(file => file.language === filters.language);
    }
    
    if (filters.version) {
      filteredFiles = filteredFiles.filter(file => file.version === filters.version);
    }
    
    if (filters.status && filters.status !== 'any') {
      filteredFiles = filteredFiles.filter(file => file.status === filters.status);
    }
    
    if (filters.duration && filters.duration !== 'any') {
      // Apply duration filter based on the selected range
      const durationValue = parseInt(filters.duration);
      if (durationValue === 60) {
        // Less than 1 minute
        filteredFiles = filteredFiles.filter(file => file.duration < 60);
      } else if (durationValue === 180) {
        // 1-3 minutes
        filteredFiles = filteredFiles.filter(file => file.duration >= 60 && file.duration <= 180);
      } else if (durationValue === 300) {
        // 3-5 minutes
        filteredFiles = filteredFiles.filter(file => file.duration > 180 && file.duration <= 300);
      } else if (durationValue === 999) {
        // More than 5 minutes
        filteredFiles = filteredFiles.filter(file => file.duration > 300);
      }
    }

    // Apply filters for call metrics
    if (filters.callType && filters.callType !== 'all') {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.callType?.toLowerCase() === filters.callType.toLowerCase()
      );
    }

    if (filters.agentId) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.agentId?.toLowerCase().includes(filters.agentId.toLowerCase())
      );
    }

    if (filters.campaignName) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.campaignName?.toLowerCase().includes(filters.campaignName.toLowerCase())
      );
    }

    if (filters.callDate) {
      filteredFiles = filteredFiles.filter(file => 
        file.call_date === filters.callDate
      );
    }

    if (filters.disposition1) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.disposition1?.toLowerCase().includes(filters.disposition1.toLowerCase())
      );
    }

    if (filters.disposition2) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.disposition2?.toLowerCase().includes(filters.disposition2.toLowerCase())
      );
    }

    if (filters.queryType) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.queryType?.toLowerCase().includes(filters.queryType.toLowerCase())
      );
    }

    if (filters.businessSegment) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.businessSegment?.toLowerCase().includes(filters.businessSegment.toLowerCase())
      );
    }
    
    if (filters.customerMobile) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.customerMobile?.toLowerCase().includes(filters.customerMobile.toLowerCase())
      );
    }
    
    if (filters.callTime) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.callTime === filters.callTime
      );
    }
    
    if (filters.subType) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.subType?.toLowerCase().includes(filters.subType.toLowerCase())
      );
    }
    
    if (filters.subSubType) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.subSubType?.toLowerCase().includes(filters.subSubType.toLowerCase())
      );
    }
    
    if (filters.voc) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.voc?.toLowerCase().includes(filters.voc.toLowerCase())
      );
    }
    
    if (filters.userRole) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.userRole?.toLowerCase().includes(filters.userRole.toLowerCase())
      );
    }
    
    if (filters.advisorCategory) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.advisorCategory?.toLowerCase().includes(filters.advisorCategory.toLowerCase())
      );
    }

    return filteredFiles;
  };

  const filteredAudioFiles = getFilteredAudioFiles();

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Audio File Management</h1>
      
      <div className="flex justify-between mb-6">
        <div className="flex space-x-2">
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload Audio File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Audio File</DialogTitle>
                <DialogDescription>
                  Upload a single audio file with metadata
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="audio-file">Audio File</Label>
                  <Input 
                    id="audio-file" 
                    type="file" 
                    accept="audio/*" 
                    onChange={handleFileChange} 
                  />
                  {file && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {file.name}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="language">Language</Label>
                    <Select 
                      value={fileData.language} 
                      onValueChange={(value) => setFileData({...fileData, language: value})}
                    >
                      <SelectTrigger id="language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="spanish">Spanish</SelectItem>
                        <SelectItem value="french">French</SelectItem>
                        <SelectItem value="hindi">Hindi</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="version">Version</Label>
                    <Input 
                      id="version" 
                      placeholder="Version" 
                      value={fileData.version}
                      onChange={(e) => setFileData({...fileData, version: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label>Call Metrics</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="callDate">Call Date</Label>
                      <Input 
                        id="callDate" 
                        type="date"
                        value={fileData.callMetrics.callDate}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            callDate: e.target.value
                          }
                        })}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="callId">Call ID</Label>
                      <Input 
                        id="callId" 
                        placeholder="Call ID"
                        value={fileData.callMetrics.callId}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            callId: e.target.value
                          }
                        })}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="callType">Call Type</Label>
                      <Select
                        value={fileData.callMetrics.callType}
                        onValueChange={(value) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            callType: value
                          }
                        })}
                      >
                        <SelectTrigger id="callType">
                          <SelectValue placeholder="Call Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inbound">Inbound</SelectItem>
                          <SelectItem value="outbound">Outbound</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="agentId">Agent ID</Label>
                      <Input 
                        id="agentId" 
                        placeholder="Agent ID"
                        value={fileData.callMetrics.agentId}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            agentId: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUploadSubmit} disabled={uploadFileMutation.isPending}>
                  {uploadFileMutation.isPending ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload File
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Dialog open={batchUploadDialogOpen} onOpenChange={setBatchUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Batch Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Batch Upload Audio Files</DialogTitle>
                <DialogDescription>
                  Upload multiple audio files with metadata from Excel
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="audioFiles">Multiple Audio Files</Label>
                  <Input 
                    id="audioFiles" 
                    type="file" 
                    accept="audio/*" 
                    multiple 
                    onChange={handleAudioFilesChange} 
                  />
                  {uploadAudioFiles.length > 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {uploadAudioFiles.length} file(s) selected
                    </div>
                  )}
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="metadataFile">Excel Metadata File</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild className="mb-2">
                      <a href="/api/azure-audio-files/azure-metadata-template" download="audio-metadata-template.xlsx">
                        <Download className="mr-2 h-4 w-4" />
                        Download Template
                      </a>
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      ← First download the template
                    </span>
                  </div>
                  <Input 
                    id="metadataFile" 
                    type="file" 
                    accept=".xlsx,.xls,.csv" 
                    onChange={handleMetadataFileChange} 
                  />
                  {metadataFile && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {metadataFile.name}
                    </div>
                  )}
                </div>
                
                <Alert>
                  <AlertDescription>
                    <p className="text-sm">The Excel file should contain columns matching audio filenames and their metadata.</p>
                    <p className="text-sm mt-2">Required columns: filename, originalFilename, language, version, call_date</p>
                    <p className="text-sm mt-2">Other fields: callId, callType, agentId, campaignName, duration, disposition1, disposition2, customerMobile, callTime, subType, subSubType, VOC, userRole, advisorCategory, queryType, businessSegment</p>
                  </AlertDescription>
                </Alert>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setBatchUploadDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleBatchUploadSubmit} disabled={batchUploadMutation.isPending}>
                  {batchUploadMutation.isPending ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Batch
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="flex space-x-2">
          <Card>
            <CardContent className="p-4">
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Basic Filters</h3>
                <div className="flex flex-wrap gap-4">
                  <div>
                    <Label htmlFor="filter-language">Language</Label>
                    <Select value={filters.language} onValueChange={(value) => handleFilterChange('language', value)}>
                      <SelectTrigger id="filter-language" className="w-28">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="spanish">Spanish</SelectItem>
                        <SelectItem value="french">French</SelectItem>
                        <SelectItem value="hindi">Hindi</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="filter-version">Version</Label>
                    <Input 
                      id="filter-version" 
                      placeholder="Version" 
                      className="w-28"
                      value={filters.version}
                      onChange={(e) => handleFilterChange('version', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="filter-status">Status</Label>
                    <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                      <SelectTrigger id="filter-status" className="w-36">
                        <SelectValue placeholder="Any status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="allocated">Allocated</SelectItem>
                        <SelectItem value="evaluated">Evaluated</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="filter-duration">Duration</Label>
                    <Select value={filters.duration} onValueChange={(value) => handleFilterChange('duration', value)}>
                      <SelectTrigger id="filter-duration" className="w-36">
                        <SelectValue placeholder="Any length" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any length</SelectItem>
                        <SelectItem value="60">Less than 1 min</SelectItem>
                        <SelectItem value="180">1-3 minutes</SelectItem>
                        <SelectItem value="300">3-5 minutes</SelectItem>
                        <SelectItem value="999">More than 5 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <Collapsible className="mb-4">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="flex items-center justify-between w-full p-0">
                    <span className="text-lg font-medium">Advanced Filters</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-2">
                    <div>
                      <Label htmlFor="filter-callType">Call Type</Label>
                      <Select value={filters.callType} onValueChange={(value) => handleFilterChange('callType', value)}>
                        <SelectTrigger id="filter-callType" className="w-full">
                          <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="inbound">Inbound</SelectItem>
                          <SelectItem value="outbound">Outbound</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-agentId">Agent ID</Label>
                      <Input 
                        id="filter-agentId" 
                        placeholder="Agent ID" 
                        value={filters.agentId}
                        onChange={(e) => handleFilterChange('agentId', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-campaignName">Campaign</Label>
                      <Input 
                        id="filter-campaignName" 
                        placeholder="Campaign Name" 
                        value={filters.campaignName}
                        onChange={(e) => handleFilterChange('campaignName', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-callDate">Call Date</Label>
                      <Input 
                        id="filter-callDate" 
                        type="date"
                        placeholder="Call Date" 
                        value={filters.callDate}
                        onChange={(e) => handleFilterChange('callDate', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-disposition1">Disposition 1</Label>
                      <Input 
                        id="filter-disposition1" 
                        placeholder="Disposition 1" 
                        value={filters.disposition1}
                        onChange={(e) => handleFilterChange('disposition1', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-disposition2">Disposition 2</Label>
                      <Input 
                        id="filter-disposition2" 
                        placeholder="Disposition 2" 
                        value={filters.disposition2}
                        onChange={(e) => handleFilterChange('disposition2', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-queryType">Query Type</Label>
                      <Input 
                        id="filter-queryType" 
                        placeholder="Query Type" 
                        value={filters.queryType}
                        onChange={(e) => handleFilterChange('queryType', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-businessSegment">Business Segment</Label>
                      <Input 
                        id="filter-businessSegment" 
                        placeholder="Business Segment" 
                        value={filters.businessSegment}
                        onChange={(e) => handleFilterChange('businessSegment', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-customerMobile">Customer Mobile</Label>
                      <Input 
                        id="filter-customerMobile" 
                        placeholder="Customer Mobile" 
                        value={filters.customerMobile}
                        onChange={(e) => handleFilterChange('customerMobile', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-callTime">Call Time</Label>
                      <Input 
                        id="filter-callTime" 
                        type="time"
                        placeholder="Call Time" 
                        value={filters.callTime}
                        onChange={(e) => handleFilterChange('callTime', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-subType">Sub Type</Label>
                      <Input 
                        id="filter-subType" 
                        placeholder="Sub Type" 
                        value={filters.subType}
                        onChange={(e) => handleFilterChange('subType', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-subSubType">Sub-Sub Type</Label>
                      <Input 
                        id="filter-subSubType" 
                        placeholder="Sub-Sub Type" 
                        value={filters.subSubType}
                        onChange={(e) => handleFilterChange('subSubType', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-voc">VOC</Label>
                      <Input 
                        id="filter-voc" 
                        placeholder="VOC" 
                        value={filters.voc}
                        onChange={(e) => handleFilterChange('voc', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-userRole">User Role</Label>
                      <Input 
                        id="filter-userRole" 
                        placeholder="User Role" 
                        value={filters.userRole}
                        onChange={(e) => handleFilterChange('userRole', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="filter-advisorCategory">Advisor Category</Label>
                      <Input 
                        id="filter-advisorCategory" 
                        placeholder="Advisor Category" 
                        value={filters.advisorCategory}
                        onChange={(e) => handleFilterChange('advisorCategory', e.target.value)}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              
              <div className="flex justify-end">
                <Button variant="outline" onClick={resetFilters}>
                  <Filter className="h-4 w-4 mr-2" />
                  Reset All Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Files</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="allocated">Allocated</TabsTrigger>
          <TabsTrigger value="evaluated">Evaluated</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Audio Files</CardTitle>
              <CardDescription>
                {activeTab === 'all' ? 'All audio files' : 
                 `Audio files with ${activeTab} status`}
                {filteredAudioFiles ? ` (${filteredAudioFiles.length})` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : filteredAudioFiles && filteredAudioFiles.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead>Call ID</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAudioFiles.map((audioFile) => (
                      <TableRow key={audioFile.id}>
                        <TableCell className="flex items-center">
                          <FileAudio className="h-4 w-4 mr-2 text-primary" />
                          {audioFile.originalFilename}
                        </TableCell>
                        <TableCell>{audioFile.callMetrics?.callId || 'N/A'}</TableCell>
                        <TableCell className="capitalize">{audioFile.language}</TableCell>
                        <TableCell>{audioFile.version}</TableCell>
                        <TableCell>{formatDuration(audioFile.duration)}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[audioFile.status as keyof typeof statusColors]}>
                            {audioFile.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                            <span title={new Date(audioFile.uploadedAt).toLocaleString()}>
                              {formatDistanceToNow(new Date(audioFile.uploadedAt), { addSuffix: true })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <a href={audioFile.fileUrl} target="_blank" rel="noopener noreferrer">Listen</a>
                            </Button>
                            {audioFile.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ id: audioFile.id, status: 'archived' })}
                              >
                                Archive
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileAudio className="mx-auto h-12 w-12 mb-4 text-muted-foreground/50" />
                  <p>No audio files found</p>
                  <p className="text-sm">Upload audio files to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AudioFileManagement;