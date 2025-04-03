import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Loader2, 
  RefreshCw, 
  FolderOpen, 
  File, 
  Upload, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Calendar,
  FileDown,
  FileSpreadsheet,
  FileText,
  ArrowLeft,
  Folder
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Types
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

// Process interface removed as it's no longer needed

interface QualityAnalyst {
  id: number;
  fullName: string;
}

const AzureStorageBrowser = () => {
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [selectedBlobItems, setSelectedBlobItems] = useState<string[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  // selectedProcessId removed as per user request
  const [selectedQA, setSelectedQA] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [folderSelectMode, setFolderSelectMode] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const ITEMS_PER_PAGE = 5;
  
  const { toast } = useToast();

  // Fetch containers
  const { 
    data: containers, 
    isLoading: isLoadingContainers,
    refetch: refetchContainers
  } = useQuery({
    queryKey: ['/api/azure-containers'],
    refetchOnWindowFocus: false,
  });

  // Fetch folders within a container
  const {
    data: folderList,
    isLoading: isLoadingFolders,
    refetch: refetchFolders
  } = useQuery({
    queryKey: ['/api/azure-folders', selectedContainer],
    queryFn: async () => {
      if (!selectedContainer) return [];
      console.log(`Fetching folders for container: ${selectedContainer}`);
      const response = await apiRequest('GET', `/api/azure-folders/${selectedContainer}`);
      const data = await response.json();
      console.log('Folder response:', data);
      
      // Update the folders state
      if (data && Array.isArray(data)) {
        setFolders(data);
      }
      
      return data;
    },
    enabled: !!selectedContainer && !selectedFolder,
    refetchOnWindowFocus: false
  });

  // Fetch blobs for selected container, optionally filtered by folder
  const { 
    data: blobs, 
    isLoading: isLoadingBlobs,
    refetch: refetchBlobs 
  } = useQuery({
    queryKey: ['/api/azure-blobs', selectedContainer, selectedFolder],
    queryFn: async () => {
      if (!selectedContainer) return [];
      
      let url = `/api/azure-blobs/${selectedContainer}`;
      if (selectedFolder) {
        url += `?folderPath=${encodeURIComponent(selectedFolder)}`;
      }
      
      console.log(`Fetching blobs for container: ${selectedContainer}${selectedFolder ? `, folder: ${selectedFolder}` : ''}`);
      const response = await apiRequest('GET', url);
      const data = await response.json();
      console.log('Blob response:', data);
      return data;
    },
    enabled: !!selectedContainer,
    refetchOnWindowFocus: false,
  });

  // Process fetching logic removed as per user request

  // Fetch quality analysts for allocation
  const { data: qualityAnalysts } = useQuery<QualityAnalyst[]>({
    queryKey: ['/api/users/quality-analysts'],
    refetchOnWindowFocus: false,
  });

  // Handle container selection
  const handleContainerClick = (containerName: string) => {
    setSelectedContainer(containerName);
    setSelectedBlobItems([]);
    setSelectedFolder(null);
    setFolderSelectMode(false);
  };
  
  // Handle folder selection
  const handleFolderClick = (folderName: string) => {
    setSelectedFolder(folderName);
    setSelectedBlobItems([]);
  };
  
  // Handle back button to return from folder to container view
  const handleBackToContainer = () => {
    setSelectedFolder(null);
  };
  
  // Download standard metadata template
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/azure-metadata-template');
      
      if (!response.ok) {
        throw new Error('Failed to download metadata template');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audio-file-metadata-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Template Downloaded',
        description: 'Standard metadata template has been downloaded successfully.',
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download metadata template',
        variant: 'destructive',
      });
    }
  };
  
  // Download custom template with filenames from current Azure container
  const handleDownloadCustomTemplate = () => {
    if (!selectedContainer) {
      toast({
        title: 'No Container Selected',
        description: 'Please select a container first to download a custom template.',
        variant: 'destructive',
      });
      return;
    }
    
    // Download the generated custom template
    const a = document.createElement('a');
    a.href = '/custom-audio-template.xlsx';
    a.download = `${selectedContainer}-template.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    toast({
      title: 'Custom Template Downloaded',
      description: 'Custom metadata template with your filenames has been downloaded.',
    });
  };
  
  // Download minimal template with essential fields only
  const handleDownloadMinimalTemplate = () => {
    // Download the generated minimal template
    const a = document.createElement('a');
    a.href = '/minimal-audio-template.xlsx';
    a.download = 'minimal-audio-template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    toast({
      title: 'Minimal Template Downloaded',
      description: 'Minimal metadata template with essential fields only has been downloaded.',
    });
  };
  
  // Download template guide
  const handleDownloadGuide = () => {
    const a = document.createElement('a');
    a.href = '/audio-file-template-guide.md';
    a.download = 'audio-file-template-guide.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    toast({
      title: 'Template Guide Downloaded',
      description: 'Template guide documentation has been downloaded.',
    });
  };

  // Handle blob selection for batch operations
  const handleBlobSelection = (blobName: string) => {
    setSelectedBlobItems(prev => {
      if (prev.includes(blobName)) {
        return prev.filter(item => item !== blobName);
      } else {
        return [...prev, blobName];
      }
    });
  };

  // Import audio files mutation
  const importAudioMutation = useMutation({
    mutationFn: async ({ containerName, metadataFile }: any) => {
      const formData = new FormData();
      formData.append('metadataFile', metadataFile);
      // processId removed as requested
      
      return apiRequest('POST', `/api/azure-audio-import/${containerName}`, formData);
    },
    onSuccess: () => {
      toast({
        title: 'Import successful',
        description: 'Audio files were successfully imported from Azure.',
      });
      setImportDialogOpen(false);
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/audio-files'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Import failed',
        description: error.message || 'There was an error importing audio files.',
        variant: 'destructive',
      });
    },
  });

  // Allocate audio files mutation (this would need to be implemented)
  const allocateAudioMutation = useMutation({
    mutationFn: async ({ audioFileIds, qualityAnalystId, dueDate }: any) => {
      return apiRequest('POST', '/api/azure-audio-allocate', { 
        audioFileIds, 
        qualityAnalystId, 
        dueDate 
      });
    },
    onSuccess: () => {
      toast({
        title: 'Allocation successful',
        description: 'Audio files were successfully allocated to quality analyst.',
      });
      setAllocateDialogOpen(false);
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/audio-file-allocations'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Allocation failed',
        description: error.message || 'There was an error allocating audio files.',
        variant: 'destructive',
      });
    },
  });

  // Handle import form submission
  const handleImport = () => {
    if (!selectedContainer || !uploadFile) {
      toast({
        title: 'Missing information',
        description: 'Please select a container and upload a metadata file.',
        variant: 'destructive',
      });
      return;
    }

    importAudioMutation.mutate({
      containerName: selectedContainer,
      metadataFile: uploadFile,
    });
  };

  // Handle allocation form submission
  const handleAllocate = () => {
    if (!selectedBlobItems.length || !selectedQA) {
      toast({
        title: 'Missing information',
        description: 'Please select audio files and a quality analyst.',
        variant: 'destructive',
      });
      return;
    }

    allocateAudioMutation.mutate({
      audioFileIds: selectedBlobItems,
      qualityAnalystId: parseInt(selectedQA),
      dueDate: dueDate || undefined,
    });
  };

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Azure Storage Browser</h1>
      <p className="text-gray-500 mb-6">
        Browse, import, and allocate audio files from your Azure Storage account
      </p>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Containers Panel */}
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Containers</span>
              <Button variant="outline" size="sm" onClick={() => refetchContainers()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardTitle>
            <CardDescription>
              Select a container to view its contents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input 
                placeholder="Search containers..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page on search
                }}
                className="mb-2"
              />
            </div>
            {isLoadingContainers ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : Array.isArray(containers) && containers.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {/* Group containers by time periods */}
                  {(() => {
                    // Filter and sort containers first
                    const filteredContainers = containers
                      .filter(container => 
                        container.name.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .sort((a, b) => 
                        new Date(b.properties.lastModified).getTime() - 
                        new Date(a.properties.lastModified).getTime()
                      );
                    
                    // Calculate total pages
                    const totalPages = Math.ceil(filteredContainers.length / ITEMS_PER_PAGE);
                    
                    // Get current page of containers
                    const paginatedContainers = filteredContainers.slice(
                      (currentPage - 1) * ITEMS_PER_PAGE, 
                      currentPage * ITEMS_PER_PAGE
                    );
                    
                    // Group containers by time periods
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const thisWeekStart = new Date(today);
                    thisWeekStart.setDate(today.getDate() - today.getDay());
                    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    
                    // Create groups
                    const groups: {[key: string]: Container[]} = {
                      "Today": [],
                      "This Week": [],
                      "This Month": [],
                      "Older": []
                    };
                    
                    // Categorize containers
                    paginatedContainers.forEach(container => {
                      const modifiedDate = new Date(container.properties.lastModified);
                      
                      if (modifiedDate >= today) {
                        groups["Today"].push(container);
                      } else if (modifiedDate >= thisWeekStart) {
                        groups["This Week"].push(container);
                      } else if (modifiedDate >= thisMonthStart) {
                        groups["This Month"].push(container);
                      } else {
                        groups["Older"].push(container);
                      }
                    });
                    
                    // Render groups with headings
                    return (
                      <>
                        {Object.entries(groups).map(([groupName, groupContainers]) => 
                          groupContainers.length > 0 && (
                            <div key={groupName} className="mb-4">
                              <h3 className="text-sm font-medium text-gray-500 mb-2">{groupName}</h3>
                              <div className="space-y-2">
                                {groupContainers.map((container: Container) => (
                                  <div
                                    key={container.name}
                                    className={`flex items-center space-x-3 p-3 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                      selectedContainer === container.name ? 'bg-gray-100 dark:bg-gray-800 border-l-4 border-primary' : ''
                                    }`}
                                    onClick={() => handleContainerClick(container.name)}
                                  >
                                    <FolderOpen className="h-5 w-5 text-blue-500" />
                                    <div>
                                      <p className="font-medium">{container.name}</p>
                                      <p className="text-xs text-gray-500">
                                        Last modified: {new Date(container.properties.lastModified).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        )}
                        
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between pt-4 border-t">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                              disabled={currentPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Previous
                            </Button>
                            <div className="text-sm text-gray-500">
                              Page {currentPage} of {totalPages}
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                              disabled={currentPage === totalPages}
                            >
                              Next
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center p-4 text-gray-500">
                No containers found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Blobs Panel */}
        <Card className="md:col-span-8">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>
                  {selectedContainer 
                    ? selectedFolder 
                      ? `Files in ${selectedContainer}/${selectedFolder}` 
                      : folderSelectMode 
                        ? `Select folder in ${selectedContainer}` 
                        : `Files in ${selectedContainer}`
                    : 'Select a container'}
                </CardTitle>
                <CardDescription>
                  {selectedContainer && (
                    selectedFolder 
                      ? 'View audio files in selected folder' 
                      : folderSelectMode 
                        ? 'Select a date folder to browse files' 
                        : 'View, import, or allocate audio files'
                  )}
                </CardDescription>
              </div>
              {selectedContainer && (
                <div className="flex space-x-2">
                  {/* Template download buttons */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <FileDown className="h-4 w-4 mr-2" />
                        Templates <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Excel Templates</DropdownMenuLabel>
                      <DropdownMenuItem onClick={handleDownloadTemplate}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Standard Template
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDownloadCustomTemplate}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Custom Template
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDownloadMinimalTemplate}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Minimal Template
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleDownloadGuide}>
                        <FileText className="h-4 w-4 mr-2" />
                        Template Guide
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {!folderSelectMode && !selectedFolder && (
                    <Button 
                      variant="outline" 
                      onClick={() => setFolderSelectMode(true)}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Date Folders
                    </Button>
                  )}
                  
                  {(folderSelectMode || selectedFolder) && (
                    <Button 
                      variant="outline" 
                      onClick={handleBackToContainer}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  )}
                  
                  <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Import Audio Files from Azure</DialogTitle>
                        <DialogDescription>
                          Upload an Excel file containing metadata for the audio files in this container.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        {/* Process selection removed as per user request */}
                        <div className="grid gap-2">
                          <Label htmlFor="metadataFile">Metadata Excel File</Label>
                          <Input
                            id="metadataFile"
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                          />
                          <p className="text-xs text-gray-500">
                            The Excel file should contain columns matching audio filenames in Azure.
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleImport}
                          disabled={importAudioMutation.isPending}
                        >
                          {importAudioMutation.isPending && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          )}
                          Import Files
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button variant="outline" onClick={() => refetchBlobs()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              )}
            </div>
            {selectedContainer && selectedBlobItems.length > 0 && (
              <div className="mt-2 flex items-center space-x-2">
                <Badge variant="outline">{selectedBlobItems.length} items selected</Badge>
                <Dialog open={allocateDialogOpen} onOpenChange={setAllocateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm">
                      <Users className="h-4 w-4 mr-2" />
                      Allocate Selected
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Allocate Audio Files</DialogTitle>
                      <DialogDescription>
                        Assign the selected audio files to a quality analyst for evaluation.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="qualityAnalyst">Quality Analyst</Label>
                        <Select value={selectedQA} onValueChange={setSelectedQA}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select quality analyst" />
                          </SelectTrigger>
                          <SelectContent>
                            {qualityAnalysts?.map((qa) => (
                              <SelectItem key={qa.id} value={qa.id.toString()}>
                                {qa.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="dueDate">Due Date (Optional)</Label>
                        <Input
                          id="dueDate"
                          type="datetime-local"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAllocateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleAllocate}
                        disabled={allocateAudioMutation.isPending}
                      >
                        {allocateAudioMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Allocate Files
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selectedContainer ? (
              <div className="text-center p-12 text-gray-500">
                <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">No container selected</h3>
                <p>Select a container from the left panel to view its contents</p>
              </div>
            ) : folderSelectMode ? (
              // Folder selection mode - display folders
              isLoadingFolders ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : Array.isArray(folders) && folders.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {folders.map((folder) => (
                    <Card 
                      key={folder}
                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => handleFolderClick(folder)}
                    >
                      <CardContent className="p-4 flex items-center space-x-3">
                        <Folder className="h-6 w-6 text-blue-500" />
                        <div>
                          <p className="font-medium">{folder}</p>
                          <p className="text-xs text-gray-500">
                            Date folder
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center p-12 text-gray-500">
                  <Folder className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium mb-2">No folders found</h3>
                  <p>This container has no date folders</p>
                </div>
              )
            ) : isLoadingBlobs ? (
              <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : Array.isArray(blobs) && blobs.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <span className="sr-only">Select</span>
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Last Modified</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blobs.map((blob: BlobItem) => (
                      <TableRow key={blob.name}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedBlobItems.includes(blob.name)}
                            onChange={() => handleBlobSelection(blob.name)}
                            className="rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            <File className="h-4 w-4 text-gray-500" />
                            <span className="truncate max-w-[200px]" title={blob.name}>
                              {blob.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{blob.properties.contentType || 'application/octet-stream'}</TableCell>
                        <TableCell>{formatFileSize(blob.properties.contentLength)}</TableCell>
                        <TableCell>{new Date(blob.properties.lastModified).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center p-12 text-gray-500">
                <File className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">No files found</h3>
                <p>
                  {selectedFolder 
                    ? `No files found in the ${selectedFolder} folder` 
                    : "This container is empty"
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AzureStorageBrowser;