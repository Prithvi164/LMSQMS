import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, RefreshCw, FolderOpen, File, Upload, Users } from 'lucide-react';

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

interface Process {
  id: number;
  name: string;
}

interface QualityAnalyst {
  id: number;
  fullName: string;
}

const AzureStorageBrowser = () => {
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [selectedBlobItems, setSelectedBlobItems] = useState<string[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [selectedProcessId, setSelectedProcessId] = useState<string>('');
  const [selectedQA, setSelectedQA] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
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

  // Fetch blobs for selected container
  const { 
    data: blobs, 
    isLoading: isLoadingBlobs,
    refetch: refetchBlobs 
  } = useQuery({
    queryKey: ['/api/azure-blobs', selectedContainer],
    queryFn: async () => {
      if (!selectedContainer) return [];
      console.log(`Fetching blobs for container: ${selectedContainer}`);
      const response = await apiRequest('GET', `/api/azure-blobs/${selectedContainer}`);
      const data = await response.json();
      console.log('Blob response:', data);
      return data;
    },
    enabled: !!selectedContainer,
    refetchOnWindowFocus: false,
  });

  // Fetch processes for the import dialog
  const { data: processes } = useQuery<Process[]>({
    queryKey: ['/api/organizations/processes'],
    refetchOnWindowFocus: false,
  });

  // Fetch quality analysts for allocation
  const { data: qualityAnalysts } = useQuery<QualityAnalyst[]>({
    queryKey: ['/api/users/quality-analysts'],
    refetchOnWindowFocus: false,
  });

  // Handle container selection
  const handleContainerClick = (containerName: string) => {
    setSelectedContainer(containerName);
    setSelectedBlobItems([]);
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
    mutationFn: async ({ containerName, processId, metadataFile }: any) => {
      const formData = new FormData();
      formData.append('metadataFile', metadataFile);
      formData.append('processId', processId);
      
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
    if (!selectedContainer || !selectedProcessId || !uploadFile) {
      toast({
        title: 'Missing information',
        description: 'Please select a container, process, and upload a metadata file.',
        variant: 'destructive',
      });
      return;
    }

    importAudioMutation.mutate({
      containerName: selectedContainer,
      processId: selectedProcessId,
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
            {isLoadingContainers ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : Array.isArray(containers) && containers.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {containers.map((container: Container) => (
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
                  {selectedContainer ? `Files in ${selectedContainer}` : 'Select a container'}
                </CardTitle>
                <CardDescription>
                  {selectedContainer && 'View, import, or allocate audio files'}
                </CardDescription>
              </div>
              {selectedContainer && (
                <div className="flex space-x-2">
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
                        <div className="grid gap-2">
                          <Label htmlFor="process">Process</Label>
                          <Select value={selectedProcessId} onValueChange={setSelectedProcessId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select process" />
                            </SelectTrigger>
                            <SelectContent>
                              {processes?.map((process) => (
                                <SelectItem key={process.id} value={process.id.toString()}>
                                  {process.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
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
                <p>This container is empty</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AzureStorageBrowser;