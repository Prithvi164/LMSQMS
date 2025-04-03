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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { format } from 'date-fns';
import { 
  CalendarIcon, 
  Check, 
  FileAudio, 
  Plus, 
  Settings, 
  Headphones, 
  RefreshCw, 
  Filter, 
  FolderOpen, 
  Cloud,
  Download,
  Database
} from 'lucide-react';

// Type definitions
interface Container {
  name: string;
  properties: {
    lastModified: string;
    etag: string;
    leaseStatus: string;
    leaseState: string;
    [key: string]: any;
  };
}

interface BlobItem {
  name: string;
  properties: {
    createdOn: string;
    lastModified: string;
    contentLength: number;
    contentType: string;
    [key: string]: any;
  };
}

interface AudioFile {
  id: number;
  originalFilename: string;
  language: string;
  version: string;
  duration: number;
  callMetrics?: {
    callId: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface QualityAnalyst {
  id: number;
  fullName: string;
  employeeId: string;
  role: string;
  [key: string]: any;
}

interface AllocationData {
  name: string;
  description: string;
  dueDate: Date;
  filters: {
    language: string;
    version: string;
    duration: string;
    callType: string;
    minCsat: number;
    maxCsat: number;
  };
  qualityAnalysts: Array<{id: number, count: number}>;
  audioFileIds: number[];
}

interface Filters {
  language: string;
  version: string;
  duration: string;
  callType: string;
  status: string;
  allocatedTo: string;
}

// Helper functions
const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const getAllocationStatusColor = (allocatedCount: number, totalCount: number) => {
  if (allocatedCount === 0) return 'bg-red-100 text-red-800';
  if (allocatedCount < totalCount) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
};

const AudioFileAllocation = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [selectedAzureFiles, setSelectedAzureFiles] = useState<string[]>([]);
  const [selectAllFiles, setSelectAllFiles] = useState(false);
  const [selectAllAzureFiles, setSelectAllAzureFiles] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    language: '',
    version: '',
    duration: '',
    callType: '',
    status: '',
    allocatedTo: ''
  });
  const [allocationData, setAllocationData] = useState<AllocationData>({
    name: '',
    description: '',
    dueDate: new Date(),
    filters: {
      language: '',
      version: '',
      duration: '',
      callType: '',
      minCsat: 0,
      maxCsat: 5
    },
    qualityAnalysts: [],
    audioFileIds: []
  });
  
  // Database state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  
  // Azure storage state
  const [sourceTab, setSourceTab] = useState<'database' | 'azure'>('database');
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  
  // Data fetching
  const { data: audioFiles = [], isLoading: loadingAudioFiles, refetch: refetchAudioFiles } = useQuery({
    queryKey: ['/api/organizations', user?.organizationId, 'audio-files', 'unallocated'],
    enabled: !!user?.organizationId,
  });
  
  const { data: qualityAnalysts = [], isLoading: loadingQualityAnalysts } = useQuery({
    queryKey: ['/api/users/quality-analysts'],
    enabled: !!user?.organizationId,
  });
  
  const { data: allocations = [], isLoading: loadingAllocations, refetch: refetchAllocations } = useQuery({
    queryKey: ['/api/organizations', user?.organizationId, 'audio-file-allocations'],
    enabled: !!user?.organizationId,
  });
  
  // Azure storage data fetching
  const { data: containers = [], isLoading: loadingContainers } = useQuery({
    queryKey: ['/api/azure/containers'],
    enabled: sourceTab === 'azure',
  });
  
  const { data: blobs = [], isLoading: loadingBlobs } = useQuery({
    queryKey: ['/api/azure/blobs', selectedContainer],
    enabled: !!selectedContainer && sourceTab === 'azure',
  });
  
  // Mutations
  const createAllocationMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/organizations/' + user?.organizationId + '/audio-file-allocations', 'POST', data),
    onSuccess: () => {
      toast({
        title: 'Allocation Created',
        description: 'The audio files have been successfully allocated to quality analysts',
      });
      
      setCreateDialogOpen(false);
      resetAllocationForm();
      queryClient.invalidateQueries({
        queryKey: ['/api/organizations', user?.organizationId, 'audio-file-allocations']
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/organizations', user?.organizationId, 'audio-files', 'unallocated']
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create allocation',
        variant: 'destructive',
      });
    }
  });
  
  const importAzureFilesMutation = useMutation({
    mutationFn: (data: {files: string[], container: string}) => 
      apiRequest('/api/azure/import-files', 'POST', data),
    onSuccess: () => {
      toast({
        title: 'Files Imported',
        description: 'The audio files have been successfully imported from Azure Storage',
      });
      
      setSelectedAzureFiles([]);
      queryClient.invalidateQueries({
        queryKey: ['/api/organizations', user?.organizationId, 'audio-files', 'unallocated']
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to import files from Azure Storage',
        variant: 'destructive',
      });
    }
  });

  useEffect(() => {
    if (selectAllFiles && audioFiles && Array.isArray(audioFiles)) {
      setSelectedFiles(audioFiles.map((file: AudioFile) => file.id));
    } else if (!selectAllFiles) {
      setSelectedFiles([]);
    }
  }, [selectAllFiles, audioFiles]);
  
  useEffect(() => {
    if (selectAllAzureFiles && blobs && Array.isArray(blobs)) {
      setSelectedAzureFiles(blobs.map((blob: BlobItem) => blob.name));
    } else if (!selectAllAzureFiles) {
      setSelectedAzureFiles([]);
    }
  }, [selectAllAzureFiles, blobs]);

  useEffect(() => {
    setAllocationData(prev => ({
      ...prev,
      audioFileIds: selectedFiles
    }));
  }, [selectedFiles]);
  
  // Helper functions for Azure
  const handleToggleAzureFile = (fileName: string) => {
    if (selectedAzureFiles.includes(fileName)) {
      setSelectedAzureFiles(selectedAzureFiles.filter(name => name !== fileName));
    } else {
      setSelectedAzureFiles([...selectedAzureFiles, fileName]);
    }
  };
  
  const handleImportAzureFiles = () => {
    if (selectedAzureFiles.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one file to import',
        variant: 'destructive',
      });
      return;
    }
    
    if (!selectedContainer) {
      toast({
        title: 'Error',
        description: 'No container selected',
        variant: 'destructive',
      });
      return;
    }
    
    importAzureFilesMutation.mutate({
      files: selectedAzureFiles,
      container: selectedContainer
    });
  };
  
  const handleContainerChange = (container: string) => {
    setSelectedContainer(container);
    setSelectedFolder(null);
    setSelectedAzureFiles([]);
  };
  
  const handleFolderChange = (folder: string | null) => {
    setSelectedFolder(folder);
    setSelectedAzureFiles([]);
  };
  
  const extractCallId = (fileName: string) => {
    // Extract call ID from filename
    // Pattern: <anything>_<callId>_<anything>
    const match = fileName.match(/_([A-Za-z0-9]+)_/);
    return match ? match[1] : 'N/A';
  };

  const resetAllocationForm = () => {
    setAllocationData({
      name: '',
      description: '',
      dueDate: new Date(),
      filters: {
        language: '',
        version: '',
        duration: '',
        callType: '',
        minCsat: 0,
        maxCsat: 5
      },
      qualityAnalysts: [],
      audioFileIds: []
    });
    setSelectedFiles([]);
    setSelectAllFiles(false);
  };

  const handleToggleFile = (fileId: number) => {
    if (selectedFiles.includes(fileId)) {
      setSelectedFiles(selectedFiles.filter(id => id !== fileId));
    } else {
      setSelectedFiles([...selectedFiles, fileId]);
    }
  };

  const handleQualityAnalystChange = (analystId: number, count: number) => {
    const updatedAnalysts = [...allocationData.qualityAnalysts];
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
    
    setAllocationData({
      ...allocationData,
      qualityAnalysts: updatedAnalysts
    });
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters({
      ...filters,
      [key]: value === 'all' ? '' : value
    });
  };

  const resetFilters = () => {
    setFilters({
      language: '',
      version: '',
      duration: '',
      callType: '',
      status: '',
      allocatedTo: ''
    });
  };

  const handleCreateAllocation = () => {
    if (!allocationData.name) {
      toast({
        title: 'Error',
        description: 'Please provide a name for the allocation',
        variant: 'destructive',
      });
      return;
    }

    if (allocationData.audioFileIds.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one audio file to allocate',
        variant: 'destructive',
      });
      return;
    }

    if (allocationData.qualityAnalysts.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one quality analyst',
        variant: 'destructive',
      });
      return;
    }

    const totalAllocationCount = allocationData.qualityAnalysts.reduce((sum, qa) => sum + qa.count, 0);
    if (totalAllocationCount !== allocationData.audioFileIds.length) {
      toast({
        title: 'Warning',
        description: `The total allocation count (${totalAllocationCount}) doesn't match the number of selected files (${allocationData.audioFileIds.length}). The allocation will be distributed proportionally.`,
      });
    }

    const data = {
      ...allocationData,
      organizationId: user?.organizationId,
      allocatedBy: user?.id
    };

    createAllocationMutation.mutate(data);
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Audio File Allocation</h1>
      
      <div className="flex justify-between mb-6">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Allocation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Audio File Allocation</DialogTitle>
              <DialogDescription>
                Allocate audio files to quality analysts for evaluation
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Allocation Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g., March Quality Reviews" 
                    value={allocationData.name}
                    onChange={(e) => setAllocationData({...allocationData, name: e.target.value})}
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
                        {allocationData.dueDate ? (
                          format(allocationData.dueDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={allocationData.dueDate}
                        onSelect={(date) => setAllocationData({...allocationData, dueDate: date!})}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input 
                    id="description" 
                    placeholder="Allocation description (optional)" 
                    value={allocationData.description}
                    onChange={(e) => setAllocationData({...allocationData, description: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Quality Analysts</Label>
                  <Badge className="bg-primary">
                    {allocationData.qualityAnalysts.reduce((sum, qa) => sum + qa.count, 0)} / {selectedFiles.length} Files
                  </Badge>
                </div>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      {qualityAnalysts && Array.isArray(qualityAnalysts) ? 
                        qualityAnalysts.filter((qa: QualityAnalyst) => qa.role === 'quality_analyst').map((analyst: QualityAnalyst) => (
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
                                  const current = allocationData.qualityAnalysts.find(a => a.id === analyst.id)?.count || 0;
                                  handleQualityAnalystChange(analyst.id, Math.max(0, current - 1));
                                }}
                              >
                                -
                              </Button>
                              <span className="w-12 text-center">
                                {allocationData.qualityAnalysts.find(a => a.id === analyst.id)?.count || 0}
                              </span>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => {
                                  const current = allocationData.qualityAnalysts.find(a => a.id === analyst.id)?.count || 0;
                                  handleQualityAnalystChange(analyst.id, current + 1);
                                }}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        ))
                      : null}
                      
                      {(!qualityAnalysts || (qualityAnalysts && Array.isArray(qualityAnalysts) && qualityAnalysts.filter((qa: QualityAnalyst) => qa.role === 'quality_analyst').length === 0)) && (
                        <div className="col-span-2 text-center py-4 text-muted-foreground">
                          No quality analysts available
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <Label>Select Audio Files</Label>
                  <Tabs value={sourceTab} onValueChange={(value) => setSourceTab(value as 'database' | 'azure')} className="justify-end">
                    <TabsList>
                      <TabsTrigger value="database">Database</TabsTrigger>
                      <TabsTrigger value="azure">Azure Storage</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                
                <Card>
                  <CardContent className="p-4">
                    {sourceTab === 'database' && (
                      <>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <Label className="mb-2">Language</Label>
                            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select language" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">All Languages</SelectItem>
                                <SelectItem value="english">English</SelectItem>
                                <SelectItem value="spanish">Spanish</SelectItem>
                                <SelectItem value="french">French</SelectItem>
                                <SelectItem value="hindi">Hindi</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="mb-2">Version</Label>
                            <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select version" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">All Versions</SelectItem>
                                <SelectItem value="v1">Version 1</SelectItem>
                                <SelectItem value="v2">Version 2</SelectItem>
                                <SelectItem value="v3">Version 3</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="flex justify-end mb-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="selectAll" 
                              checked={selectAllFiles}
                              onCheckedChange={(checked) => setSelectAllFiles(checked === true)}
                              disabled={!audioFiles || !Array.isArray(audioFiles) || audioFiles.length === 0}
                            />
                            <label htmlFor="selectAll" className="text-sm">Select All</label>
                          </div>
                        </div>
                        
                        {loadingAudioFiles ? (
                          <div className="flex justify-center items-center py-8">
                            <Spinner className="h-8 w-8" />
                          </div>
                        ) : audioFiles && Array.isArray(audioFiles) && audioFiles.length > 0 ? (
                          <div className="max-h-64 overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12"></TableHead>
                                  <TableHead>Filename</TableHead>
                                  <TableHead>Call ID</TableHead>
                                  <TableHead>Language</TableHead>
                                  <TableHead>Version</TableHead>
                                  <TableHead>Duration</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {audioFiles
                                  .filter((file: AudioFile) => 
                                    (!selectedLanguage || file.language === selectedLanguage) &&
                                    (!selectedVersion || file.version === selectedVersion)
                                  )
                                  .map((file: AudioFile) => (
                                    <TableRow key={file.id} className={selectedFiles.includes(file.id) ? "bg-muted/50" : ""}>
                                      <TableCell>
                                        <Checkbox 
                                          checked={selectedFiles.includes(file.id)}
                                          onCheckedChange={() => handleToggleFile(file.id)}
                                        />
                                      </TableCell>
                                      <TableCell className="flex items-center">
                                        <FileAudio className="h-4 w-4 mr-2 text-primary" />
                                        {file.originalFilename}
                                      </TableCell>
                                      <TableCell>{file.callMetrics?.callId || 'N/A'}</TableCell>
                                      <TableCell className="capitalize">{file.language}</TableCell>
                                      <TableCell>{file.version}</TableCell>
                                      <TableCell>{formatDuration(file.duration)}</TableCell>
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Database className="h-16 w-16 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground mb-2">No audio files available</p>
                            <p className="text-sm text-muted-foreground max-w-md">
                              {selectedLanguage || selectedVersion 
                                ? "No files match the selected filters. Try changing your selection."
                                : "There are no unallocated audio files in the database. Import files from Azure Storage or upload new files."}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                    
                    {sourceTab === 'azure' && (
                      <>
                        <div className="flex space-x-2 mb-4">
                          <div className="w-1/2">
                            <Label className="mb-2 block">Container</Label>
                            <Select
                              value={selectedContainer || ''}
                              onValueChange={handleContainerChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select container" />
                              </SelectTrigger>
                              <SelectContent>
                                {loadingContainers ? (
                                  <SelectItem value="loading" disabled>
                                    Loading containers...
                                  </SelectItem>
                                ) : containers && Array.isArray(containers) && containers.length > 0 ? (
                                  containers.map((container: Container) => (
                                    <SelectItem key={container.name} value={container.name}>
                                      {container.name}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="none" disabled>
                                    No containers available
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="w-1/2">
                            <Label className="mb-2 block">Folder</Label>
                            <Select
                              value={selectedFolder || ''}
                              onValueChange={(value) => handleFolderChange(value === 'root' ? null : value)}
                              disabled={!selectedContainer || loadingBlobs}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select folder" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="root">Root (No folder)</SelectItem>
                                {blobs && Array.isArray(blobs) && selectedContainer && (
                                  Array.from(
                                    new Set(
                                      blobs
                                        .filter((blob: BlobItem) => blob.name.includes('/'))
                                        .map((blob: BlobItem) => blob.name.split('/')[0])
                                    )
                                  ).map((folder: string) => (
                                    <SelectItem key={folder} value={folder}>
                                      {folder}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm text-muted-foreground">
                            {selectedContainer && blobs && Array.isArray(blobs) && blobs.length
                              ? `${blobs.length} files found${selectedFolder ? ` in ${selectedFolder}` : ''}` 
                              : 'Select a container to view files'}
                          </p>
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="selectAllAzure" 
                              checked={selectAllAzureFiles}
                              onCheckedChange={(checked) => setSelectAllAzureFiles(checked === true)}
                              disabled={!selectedContainer || !blobs || !Array.isArray(blobs) || blobs.length === 0}
                            />
                            <label htmlFor="selectAllAzure" className="text-sm">Select All</label>
                          </div>
                        </div>
                        
                        {loadingBlobs ? (
                          <div className="flex justify-center items-center py-8">
                            <Spinner className="h-8 w-8" />
                          </div>
                        ) : selectedContainer && blobs && Array.isArray(blobs) && blobs.length > 0 ? (
                          <>
                            <div className="max-h-64 overflow-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead>Filename</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead>Call ID</TableHead>
                                    <TableHead>Last Modified</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {blobs
                                    .filter((blob: BlobItem) => 
                                      !selectedFolder ? 
                                        !blob.name.includes('/') : 
                                        blob.name.startsWith(`${selectedFolder}/`) && blob.name.split('/').length === 2
                                    )
                                    .map((blob: BlobItem) => {
                                      const displayName = selectedFolder ? 
                                        blob.name.split('/')[1] : 
                                        blob.name;
                                      return (
                                        <TableRow 
                                          key={blob.name} 
                                          className={selectedAzureFiles.includes(blob.name) ? "bg-muted/50" : ""}
                                        >
                                          <TableCell>
                                            <Checkbox 
                                              checked={selectedAzureFiles.includes(blob.name)}
                                              onCheckedChange={() => handleToggleAzureFile(blob.name)}
                                            />
                                          </TableCell>
                                          <TableCell className="flex items-center">
                                            <FileAudio className="h-4 w-4 mr-2 text-primary" />
                                            {displayName}
                                          </TableCell>
                                          <TableCell>
                                            {Math.round(blob.properties.contentLength / 1024)} KB
                                          </TableCell>
                                          <TableCell>{extractCallId(blob.name)}</TableCell>
                                          <TableCell>
                                            {new Date(blob.properties.lastModified).toLocaleDateString()}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })
                                  }
                                </TableBody>
                              </Table>
                            </div>
                            
                            <div className="flex justify-end mt-4">
                              <Button 
                                onClick={handleImportAzureFiles}
                                disabled={selectedAzureFiles.length === 0 || importAzureFilesMutation.isPending}
                                size="sm"
                              >
                                {importAzureFilesMutation.isPending ? (
                                  <>
                                    <Spinner className="mr-2 h-4 w-4" />
                                    Importing...
                                  </>
                                ) : (
                                  <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Import Selected Files
                                  </>
                                )}
                              </Button>
                            </div>
                          </>
                        ) : selectedContainer ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileAudio className="mx-auto h-12 w-12 mb-4 text-muted-foreground/50" />
                            <p>No audio files found in this container{selectedFolder ? ` or folder` : ''}</p>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Database className="mx-auto h-12 w-12 mb-4 text-muted-foreground/50" />
                            <p>Select a container to view files</p>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleCreateAllocation} 
                disabled={createAllocationMutation.isPending || selectedFiles.length === 0}
              >
                {createAllocationMutation.isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Headphones className="mr-2 h-4 w-4" />
                    Create Allocation
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => {
              refetchAllocations();
              refetchAudioFiles();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>
                  Filter audio file allocations by various criteria
                </SheetDescription>
              </SheetHeader>
              
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={filters.status} 
                    onValueChange={(value) => handleFilterChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="allocatedTo">Allocated To</Label>
                  <Select 
                    value={filters.allocatedTo} 
                    onValueChange={(value) => handleFilterChange('allocatedTo', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Quality Analysts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Quality Analysts</SelectItem>
                      {qualityAnalysts && Array.isArray(qualityAnalysts) ? 
                        qualityAnalysts
                          .filter((qa: QualityAnalyst) => qa.role === 'quality_analyst')
                          .map((analyst: QualityAnalyst) => (
                            <SelectItem key={analyst.id} value={analyst.id.toString()}>
                              {analyst.fullName}
                            </SelectItem>
                          ))
                      : null}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <SheetFooter>
                <Button onClick={resetFilters} variant="outline">Reset Filters</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
      {loadingAllocations ? (
        <div className="flex justify-center items-center py-12">
          <Spinner className="h-12 w-12" />
        </div>
      ) : allocations && Array.isArray(allocations) && allocations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allocations.map((allocation: any) => (
            <Card key={allocation.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle>{allocation.name}</CardTitle>
                <CardDescription>
                  {allocation.description || 'No description provided'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge
                    className={
                      allocation.status === 'completed' ? 'bg-green-100 text-green-800' :
                      allocation.status === 'overdue' ? 'bg-red-100 text-red-800' :
                      allocation.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }
                  >
                    {allocation.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-muted-foreground">Progress</div>
                  <Badge 
                    className={getAllocationStatusColor(
                      allocation.audioFileAllocations?.filter((afa: any) => afa.status === 'evaluated').length || 0,
                      allocation.audioFileAllocations?.length || 0
                    )}
                  >
                    {allocation.audioFileAllocations?.filter((afa: any) => afa.status === 'evaluated').length || 0}
                    /{allocation.audioFileAllocations?.length || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-muted-foreground">Due Date</div>
                  <span className="text-sm font-medium">
                    {allocation.dueDate ? format(new Date(allocation.dueDate), 'PPP') : 'Not set'}
                  </span>
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="text-sm font-medium mb-2">Quality Analysts</div>
                  <div className="flex flex-wrap gap-2">
                    {allocation.qualityAnalysts?.map((qa: any) => (
                      <Badge key={qa.id} variant="secondary">
                        {qa.fullName}
                      </Badge>
                    ))}
                    {!allocation.qualityAnalysts?.length && (
                      <span className="text-sm text-muted-foreground">No analysts assigned</span>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    // View allocation details
                  }}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  View Details
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg">
          <Headphones className="mx-auto h-12 w-12 mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No Allocations Found</h3>
          <p className="text-muted-foreground mb-6">
            Start by creating a new allocation for quality analysts to evaluate audio files
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Allocation
          </Button>
        </div>
      )}
    </div>
  );
};

export default AudioFileAllocation;