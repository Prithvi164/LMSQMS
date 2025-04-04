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
  Folder,
  Download
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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

interface QualityAnalyst {
  id: number;
  fullName: string;
}

const AzureStorageBrowser = () => {
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [selectedBlobItems, setSelectedBlobItems] = useState<string[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [metadataFile, setMetadataFile] = useState<File | null>(null);
  const [autoAssignToQA, setAutoAssignToQA] = useState(false);
  const [selectedQA, setSelectedQA] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [selectedEvaluationTemplate, setSelectedEvaluationTemplate] = useState('');
  const [importEvaluationTemplate, setImportEvaluationTemplate] = useState('');
  const [maxAssignmentsPerQA, setMaxAssignmentsPerQA] = useState(5);
  const [qaAssignmentCounts, setQaAssignmentCounts] = useState<Record<string, number>>({});
  const [selectedFolder, setSelectedFolder] = useState('');
  const [dateFolders, setDateFolders] = useState<string[]>([]);
  const [filterOptions, setFilterOptions] = useState({
    language: '',
    startDate: '',
    endDate: '',
    minDuration: '',
    maxDuration: '',
  });
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  
  const { toast } = useToast();

  // Fetch containers
  const { data: containers = [], isPending: isLoadingContainers } = useQuery({
    queryKey: ['/api/azure/containers'],
    select: (data) => data.containers || [],
  });

  // Group containers by prefix/category
  const groupContainers = (containers: Container[]) => {
    return containers.filter((container: Container) => 
      container.name.startsWith('audio-') || 
      container.name.startsWith('recording-') ||
      container.name.includes('call')
    );
  };

  // Fetch blobs in selected container
  const { 
    data: blobsData = { blobs: [] }, 
    isPending: isLoadingBlobs,
    refetch: refetchBlobs 
  } = useQuery({
    queryKey: ['/api/azure/blobs', selectedContainer, selectedFolder],
    enabled: !!selectedContainer,
    select: (data) => {
      // If we have filter options, apply them
      let filteredBlobs = data.blobs;
      
      if (filterOptions.language && filteredBlobs.length > 0) {
        filteredBlobs = filteredBlobs.filter((blob: any) => 
          blob.metadata && 
          blob.metadata.language && 
          blob.metadata.language.toLowerCase() === filterOptions.language.toLowerCase()
        );
      }
      
      if (filterOptions.startDate && filteredBlobs.length > 0) {
        const startDate = new Date(filterOptions.startDate);
        filteredBlobs = filteredBlobs.filter((blob: any) => {
          const blobDate = blob.metadata && blob.metadata.callDate 
            ? new Date(blob.metadata.callDate) 
            : new Date(blob.properties.createdOn);
          return blobDate >= startDate;
        });
      }
      
      if (filterOptions.endDate && filteredBlobs.length > 0) {
        const endDate = new Date(filterOptions.endDate);
        filteredBlobs = filteredBlobs.filter((blob: any) => {
          const blobDate = blob.metadata && blob.metadata.callDate 
            ? new Date(blob.metadata.callDate) 
            : new Date(blob.properties.createdOn);
          return blobDate <= endDate;
        });
      }
      
      if (filterOptions.minDuration && filteredBlobs.length > 0) {
        const minDuration = parseInt(filterOptions.minDuration);
        filteredBlobs = filteredBlobs.filter((blob: any) => {
          const duration = blob.metadata && blob.metadata.durationSeconds 
            ? parseInt(blob.metadata.durationSeconds) 
            : 0;
          return duration >= minDuration;
        });
      }
      
      if (filterOptions.maxDuration && filteredBlobs.length > 0) {
        const maxDuration = parseInt(filterOptions.maxDuration);
        filteredBlobs = filteredBlobs.filter((blob: any) => {
          const duration = blob.metadata && blob.metadata.durationSeconds 
            ? parseInt(blob.metadata.durationSeconds) 
            : 0;
          return duration <= maxDuration || duration === 0;
        });
      }
      
      // Extract available languages from metadata
      if (filteredBlobs.length > 0) {
        const languages = new Set<string>();
        filteredBlobs.forEach((blob: any) => {
          if (blob.metadata && blob.metadata.language) {
            languages.add(blob.metadata.language);
          }
        });
        setAvailableLanguages(Array.from(languages));
      }
      
      return { blobs: filteredBlobs };
    }
  });

  const blobs = blobsData.blobs;

  // Fetch quality analysts
  const { data: qualityAnalysts = [] } = useQuery({
    queryKey: ['/api/quality-analysts'],
    select: (data) => data.qualityAnalysts || [],
  });
  
  // Fetch evaluation templates
  const { data: evaluationTemplates = [] } = useQuery({
    queryKey: ['/api/evaluation-templates'],
    select: (data) => data.templates || [],
  });

  // Mutation for import audio files
  const importAudioMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await apiRequest('/api/azure/import-audio', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Import successful',
        description: 'Audio files have been imported with metadata',
      });
      setImportDialogOpen(false);
      setMetadataFile(null);
      queryClient.invalidateQueries({ queryKey: ['/api/azure/blobs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Import failed',
        description: error.message || 'An error occurred while importing files',
        variant: 'destructive',
      });
    },
  });
  
  // Mutation for allocating audio files to quality analysts
  const allocateAudioMutation = useMutation({
    mutationFn: async (data: {
      containerName: string;
      blobNames: string[];
      qaIds: string[];
      dueDate?: string;
      evaluationTemplateId?: string;
      maxAssignmentsPerQA: Record<string, number>;
    }) => {
      return await apiRequest('/api/azure/allocate-audio', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Allocation successful',
        description: 'Audio files have been allocated to quality analysts',
      });
      setAllocateDialogOpen(false);
      setSelectedBlobItems([]);
      queryClient.invalidateQueries({ queryKey: ['/api/qa-assignments'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Allocation failed',
        description: error.message || 'An error occurred while allocating files',
        variant: 'destructive',
      });
    },
  });

  // Handle container selection
  const handleContainerSelect = (containerName: string) => {
    setSelectedContainer(containerName);
    setSelectedBlobItems([]);
    setSelectedFolder('');
    // Reset filter options when changing containers
    setFilterOptions({
      language: '',
      startDate: '',
      endDate: '',
      minDuration: '',
      maxDuration: '',
    });
  };

  // Handle blob selection
  const handleBlobSelection = (blobName: string) => {
    setSelectedBlobItems((prev) => {
      if (prev.includes(blobName)) {
        return prev.filter((name) => name !== blobName);
      } else {
        return [...prev, blobName];
      }
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

  // Handle metadata file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMetadataFile(e.target.files[0]);
    }
  };

  // Handle import submission
  const handleImport = async () => {
    if (!selectedContainer || selectedBlobItems.length === 0) {
      toast({
        title: 'Import failed',
        description: 'Please select a container and at least one file',
        variant: 'destructive',
      });
      return;
    }

    const formData = new FormData();
    formData.append('containerName', selectedContainer);
    
    // Add selected blobs
    selectedBlobItems.forEach(blobName => {
      formData.append('blobNames', blobName);
    });
    
    // Add metadata file if available
    if (metadataFile) {
      formData.append('metadataFile', metadataFile);
    }
    
    // Add auto-assign flag and QA IDs if enabled
    formData.append('autoAssignToQA', autoAssignToQA.toString());
    
    if (autoAssignToQA) {
      selectedQA.forEach(qaId => {
        formData.append('qaIds', qaId);
      });
      
      // Add maxAssignmentsPerQA as JSON
      formData.append('maxAssignmentsPerQA', JSON.stringify(qaAssignmentCounts));
      
      // Add evaluation template if selected
      if (importEvaluationTemplate) {
        formData.append('evaluationTemplateId', importEvaluationTemplate);
      }
      
      // Add due date if available
      if (dueDate) {
        formData.append('dueDate', dueDate);
      }
    }
    
    importAudioMutation.mutate(formData);
  };

  // Handle allocation submission
  const handleAllocate = async () => {
    if (selectedQA.length === 0) {
      toast({
        title: 'Allocation failed',
        description: 'Please select at least one quality analyst',
        variant: 'destructive',
      });
      return;
    }
    
    if (!selectedEvaluationTemplate) {
      toast({
        title: 'Allocation failed',
        description: 'Please select an evaluation template',
        variant: 'destructive',
      });
      return;
    }

    const data = {
      containerName: selectedContainer || '',
      blobNames: selectedBlobItems,
      qaIds: selectedQA,
      evaluationTemplateId: selectedEvaluationTemplate,
      maxAssignmentsPerQA: qaAssignmentCounts,
    };
    
    if (dueDate) {
      data.dueDate = dueDate;
    }
    
    allocateAudioMutation.mutate(data);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="grid lg:grid-cols-7 gap-6">
        {/* Left sidebar for containers */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Storage Containers</CardTitle>
            <CardDescription>
              Select a container to view files
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingContainers ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : Array.isArray(containers) && containers.length > 0 ? (
              <div>
                <div className="space-y-1">
                  {groupContainers(containers).map((container: Container) => (
                    <Button
                      key={container.name}
                      variant={selectedContainer === container.name ? "secondary" : "ghost"}
                      className="w-full justify-start text-left font-normal"
                      onClick={() => handleContainerSelect(container.name)}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      <span className="truncate">{container.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center p-4 text-gray-500">
                No containers found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main content area for files */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {selectedContainer ? (
                    <span className="flex items-center">
                      <span className="mr-2">{selectedContainer}</span>
                      {selectedFolder && (
                        <span className="text-sm text-gray-500 flex items-center">
                          <ChevronRight className="h-4 w-4 mx-1" />
                          {selectedFolder}
                        </span>
                      )}
                    </span>
                  ) : 'Select a Container'}
                </CardTitle>
                <CardDescription>
                  {selectedContainer ? 'View, import, or allocate audio files' : 'Choose a container from the sidebar'}
                </CardDescription>
              </div>
              {selectedContainer && (
                <div className="flex items-center space-x-2">
                  <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh]">
                      <DialogHeader>
                        <DialogTitle>Import Audio Files</DialogTitle>
                        <DialogDescription>
                          Import selected audio files with metadata for quality analysis.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <ScrollArea className="max-h-[60vh] pr-4">
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <div className="p-4 border rounded-md bg-gray-50">
                              <h3 className="font-medium mb-2">Selected Files</h3>
                              {selectedBlobItems.length > 0 ? (
                                <div className="max-h-28 overflow-y-auto">
                                  <ul className="space-y-1">
                                    {selectedBlobItems.map(blobName => (
                                      <li key={blobName} className="text-sm text-gray-600 truncate">
                                        <File className="h-3 w-3 inline mr-1" /> {blobName}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">No files selected</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid gap-2">
                            <Label htmlFor="metadataFile">Metadata Excel File</Label>
                            <Input 
                              id="metadataFile" 
                              type="file" 
                              accept=".xlsx,.xls" 
                              onChange={handleFileChange}
                            />
                            <p className="text-xs text-gray-500">
                              The Excel file only needs a <span className="font-bold">filename</span> column matching audio filenames in Azure. The system will automatically analyze audio files to extract duration.
                            </p>
                          </div>
                          
                          <div className="flex items-center space-x-2 py-2">
                            <Checkbox 
                              id="autoAssignQA"
                              checked={autoAssignToQA}
                              onCheckedChange={(checked) => setAutoAssignToQA(checked === true)}
                            />
                            <Label 
                              htmlFor="autoAssignQA" 
                              className="text-sm font-medium cursor-pointer"
                            >
                              Auto-assign files to quality analysts
                            </Label>
                          </div>
                          
                          {autoAssignToQA && (
                            <div className="space-y-4 px-4 py-2 border-l-2 border-gray-200">
                              <div className="grid gap-2">
                                <Label htmlFor="qualityAnalyst">Quality Analysts (Multi-select)</Label>
                                <div className="flex items-center mb-2">
                                  <Checkbox 
                                    id="select-all-qa-import"
                                    checked={qualityAnalysts?.length > 0 && selectedQA.length === qualityAnalysts.length}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        // Select all quality analysts
                                        setSelectedQA(qualityAnalysts?.map(qa => qa.id.toString()) || []);
                                      } else {
                                        // Deselect all
                                        setSelectedQA([]);
                                      }
                                    }}
                                  />
                                  <Label 
                                    htmlFor="select-all-qa-import" 
                                    className="ml-2 text-sm font-medium cursor-pointer"
                                  >
                                    Select All Quality Analysts
                                  </Label>
                                </div>
                                <div className="border rounded-md p-4 space-y-3 max-h-60 overflow-y-auto">
                                  {qualityAnalysts?.map((qa) => (
                                    <div key={qa.id} className="flex items-center justify-between space-x-2 pb-2 border-b">
                                      <div className="flex items-center gap-2">
                                        <Checkbox
                                          id={`qa-${qa.id}`}
                                          checked={selectedQA.includes(qa.id.toString())}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setSelectedQA(prev => [...prev, qa.id.toString()]);
                                            } else {
                                              setSelectedQA(prev => prev.filter(id => id !== qa.id.toString()));
                                            }
                                          }}
                                        />
                                        <Label 
                                          htmlFor={`qa-${qa.id}`} 
                                          className="text-sm font-medium cursor-pointer"
                                        >
                                          {qa.fullName}
                                        </Label>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Label 
                                          htmlFor={`qa-limit-${qa.id}`} 
                                          className="text-xs text-gray-500"
                                        >
                                          Max cases:
                                        </Label>
                                        <Input
                                          id={`qa-limit-${qa.id}`}
                                          type="number"
                                          className="w-16 h-8 text-xs"
                                          min={1}
                                          max={100}
                                          value={qaAssignmentCounts[qa.id.toString()] || maxAssignmentsPerQA}
                                          onChange={(e) => {
                                            const count = parseInt(e.target.value) || maxAssignmentsPerQA;
                                            setQaAssignmentCounts(prev => ({
                                              ...prev,
                                              [qa.id.toString()]: count
                                            }));
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                  <p className="text-xs text-gray-500">
                                    Files will be distributed evenly between selected QAs
                                  </p>
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      const newCounts: Record<string, number> = {};
                                      selectedQA.forEach(qaId => {
                                        newCounts[qaId] = maxAssignmentsPerQA;
                                      });
                                      setQaAssignmentCounts(newCounts);
                                    }}
                                  >
                                    Reset Limits
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="grid gap-2">
                                <Label htmlFor="importEvaluationTemplate">Evaluation Template</Label>
                                <Select 
                                  value={importEvaluationTemplate} 
                                  onValueChange={setImportEvaluationTemplate}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select an evaluation template" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.isArray(evaluationTemplates) && evaluationTemplates.map((template: any) => (
                                      <SelectItem key={template.id} value={template.id.toString()}>
                                        {template.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500">
                                  The selected evaluation template will be used for all files being imported.
                                </p>
                              </div>
                              
                              <div className="grid gap-2">
                                <Label htmlFor="importDueDate">Due Date (Optional)</Label>
                                <Input
                                  id="importDueDate"
                                  type="datetime-local"
                                  value={dueDate}
                                  onChange={(e) => setDueDate(e.target.value)}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                      
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
                        <Label htmlFor="qualityAnalyst">Quality Analysts (Multi-select)</Label>
                        <div className="flex items-center mb-2">
                          <Checkbox 
                            id="select-all-qa"
                            checked={qualityAnalysts?.length > 0 && selectedQA.length === qualityAnalysts.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                // Select all quality analysts
                                setSelectedQA(qualityAnalysts?.map(qa => qa.id.toString()) || []);
                              } else {
                                // Deselect all
                                setSelectedQA([]);
                              }
                            }}
                          />
                          <Label 
                            htmlFor="select-all-qa" 
                            className="ml-2 text-sm font-medium cursor-pointer"
                          >
                            Select All Quality Analysts
                          </Label>
                        </div>
                        <div className="border rounded-md p-4 space-y-3 max-h-60 overflow-y-auto">
                          {qualityAnalysts?.map((qa) => (
                            <div key={qa.id} className="flex items-center justify-between space-x-2 pb-2 border-b">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`alloc-qa-${qa.id}`}
                                  checked={selectedQA.includes(qa.id.toString())}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedQA(prev => [...prev, qa.id.toString()]);
                                    } else {
                                      setSelectedQA(prev => prev.filter(id => id !== qa.id.toString()));
                                    }
                                  }}
                                />
                                <Label 
                                  htmlFor={`alloc-qa-${qa.id}`} 
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  {qa.fullName}
                                </Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Label 
                                  htmlFor={`alloc-qa-limit-${qa.id}`} 
                                  className="text-xs text-gray-500"
                                >
                                  Max cases:
                                </Label>
                                <Input
                                  id={`alloc-qa-limit-${qa.id}`}
                                  type="number"
                                  className="w-16 h-8 text-xs"
                                  min={1}
                                  max={100}
                                  value={qaAssignmentCounts[qa.id.toString()] || maxAssignmentsPerQA}
                                  onChange={(e) => {
                                    const count = parseInt(e.target.value) || maxAssignmentsPerQA;
                                    setQaAssignmentCounts(prev => ({
                                      ...prev,
                                      [qa.id.toString()]: count
                                    }));
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-500">
                            Files will be distributed evenly between selected QAs
                          </p>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const newCounts: Record<string, number> = {};
                              selectedQA.forEach(qaId => {
                                newCounts[qaId] = maxAssignmentsPerQA;
                              });
                              setQaAssignmentCounts(newCounts);
                            }}
                          >
                            Reset Limits
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="evaluationTemplate">Evaluation Template</Label>
                        <Select 
                          value={selectedEvaluationTemplate} 
                          onValueChange={setSelectedEvaluationTemplate}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select an evaluation template" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.isArray(evaluationTemplates) && evaluationTemplates.map((template: any) => (
                              <SelectItem key={template.id} value={template.id.toString()}>
                                {template.name}
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
              <div>
                <div className="bg-gray-50 p-4 rounded-md mb-4">
                  <h3 className="font-medium mb-3">Filter Options</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="filterLanguage">Language</Label>
                      <Select
                        value={filterOptions.language}
                        onValueChange={(value) => setFilterOptions({...filterOptions, language: value})}
                      >
                        <SelectTrigger id="filterLanguage">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All Languages</SelectItem>
                          {availableLanguages.map(lang => (
                            <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="filterStartDate">Start Date</Label>
                      <Input
                        id="filterStartDate"
                        type="date"
                        value={filterOptions.startDate}
                        onChange={(e) => setFilterOptions({...filterOptions, startDate: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="filterEndDate">End Date</Label>
                      <Input
                        id="filterEndDate"
                        type="date"
                        value={filterOptions.endDate}
                        onChange={(e) => setFilterOptions({...filterOptions, endDate: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="filterMinDuration">Min Duration (seconds)</Label>
                      <Input
                        id="filterMinDuration"
                        type="number"
                        min="0"
                        value={filterOptions.minDuration}
                        onChange={(e) => setFilterOptions({...filterOptions, minDuration: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="filterMaxDuration">Max Duration (seconds)</Label>
                      <Input
                        id="filterMaxDuration"
                        type="number"
                        min="0"
                        value={filterOptions.maxDuration}
                        onChange={(e) => setFilterOptions({...filterOptions, maxDuration: e.target.value})}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setFilterOptions({
                            language: '',
                            startDate: '',
                            endDate: '',
                            minDuration: '',
                            maxDuration: '',
                          });
                        }}
                      >
                        Reset Filters
                      </Button>
                    </div>
                  </div>
                </div>
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