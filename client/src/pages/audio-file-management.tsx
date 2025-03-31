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
import { UploadCloud, FileAudio, Upload, Filter, Clock, FilePlus, FileSpreadsheet } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
    language: '',
    version: '',
    status: '',
    duration: ''
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
      return apiRequest('POST', '/api/audio-files/batch-upload', formData);
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: `Successfully uploaded ${data.success} audio files${data.failed > 0 ? `, ${data.failed} failed` : ''}.`,
      });
      setBatchUploadDialogOpen(false);
      setUploadAudioFiles([]);
      setMetadataFile(null);
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to process batch upload: ${error.toString()}`,
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
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update audio file status: ${error.toString()}`,
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
    formData.append('organizationId', user?.organizationId.toString() || '');
    formData.append('processId', user?.processId?.toString() || '1');
    
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
    } catch (error) {
      toast({
        title: 'Error',
        description: `An error occurred: ${error.toString()}`,
        variant: 'destructive',
      });
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    setFilters({
      language: '',
      version: '',
      status: '',
      duration: ''
    });
  };

  const getFilteredAudioFiles = () => {
    if (!audioFiles) return [];

    let filteredFiles = [...audioFiles];
    
    if (activeTab !== 'all') {
      filteredFiles = filteredFiles.filter(file => file.status === activeTab);
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
                    <p className="text-sm mt-2">Required columns: filename, language, version, call_date, call_type, agent_id</p>
                    <p className="text-sm mt-2">Optional columns: call_id, customer_satisfaction, handle_time</p>
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
          <Card className="w-fit">
            <CardContent className="p-4">
              <div className="flex space-x-4">
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
                  <Label htmlFor="filter-duration">Duration</Label>
                  <Select value={filters.duration} onValueChange={(value) => handleFilterChange('duration', value)}>
                    <SelectTrigger id="filter-duration" className="w-36">
                      <SelectValue placeholder="Any length" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any length</SelectItem>
                      <SelectItem value="short">Short (&lt; 3min)</SelectItem>
                      <SelectItem value="medium">Medium (3-10min)</SelectItem>
                      <SelectItem value="long">Long (&gt; 10min)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <Button variant="outline" onClick={resetFilters}>
                    <Filter className="h-4 w-4 mr-2" />
                    Reset Filters
                  </Button>
                </div>
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