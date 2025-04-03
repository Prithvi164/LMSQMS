import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, Check, X, AlertCircle, Cloud as CloudIcon, Info as InformationCircle,
  Upload, Trash2, FileText, Download, RefreshCw, Search, FolderSearch
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';

// Define response types
type CloudStorageResponse = {
  enabled: boolean;
  provider: string;
  config: Record<string, string>;
  isConfigured: boolean;
}

type TestConnectionResponse = {
  success: boolean;
  message: string;
}

type CloudStorageFile = {
  name: string;
  url: string;
  contentType: string;
  size: number;
  createdOn: string;
  lastModified: string;
}

// Define the schema for cloud storage provider configuration
const cloudStorageSchema = z.object({
  provider: z.enum(['azure', 'aws', 'gcp', 'local']),
  enabled: z.boolean(),
  
  // Optional provider-specific fields
  connectionString: z.string().optional(),
  container: z.string().optional(),
  bucket: z.string().optional(),
  region: z.string().optional(),
  folder: z.string().optional(),
  accessKey: z.string().optional(),
  secretKey: z.string().optional(),
  endpoint: z.string().optional(),
});

// Form data type
type CloudStorageFormValues = z.infer<typeof cloudStorageSchema>;

// FilesManager component to handle file operations
type FilesManagerProps = {
  organizationId?: number;
  isEnabled: boolean;
}

function FilesManager({ organizationId, isEnabled }: FilesManagerProps) {
  const [files, setFiles] = useState<CloudStorageFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch files from the cloud storage
  const { data: filesList, isLoading: isLoadingFiles, refetch } = useQuery<CloudStorageFile[]>({
    queryKey: ['/api/organizations/:organizationId/cloud-storage/files', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        throw new Error('No organization ID found');
      }
      return await apiRequest(`/api/organizations/${organizationId}/cloud-storage/files`);
    },
    enabled: !!organizationId && isEnabled,
  });

  // Update local files state when data is loaded
  useEffect(() => {
    if (filesList) {
      setFiles(filesList);
    }
  }, [filesList]);

  // Mutation for uploading files
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!organizationId) {
        throw new Error('No organization ID found');
      }
      return await apiRequest(`/api/organizations/${organizationId}/cloud-storage/upload`, {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      toast({
        title: 'File Uploaded',
        description: 'File has been uploaded successfully.',
      });
      // Refetch the files list
      refetch();
      setUploadProgress(0);
      setIsUploading(false);
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to upload file');
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload file.',
        variant: 'destructive',
      });
      setUploadProgress(0);
      setIsUploading(false);
    }
  });

  // Mutation for deleting files
  const deleteMutation = useMutation({
    mutationFn: async (fileUrl: string) => {
      if (!organizationId) {
        throw new Error('No organization ID found');
      }
      return await apiRequest(`/api/organizations/${organizationId}/cloud-storage/delete`, {
        method: 'POST',
        body: JSON.stringify({ fileUrl }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'File Deleted',
        description: 'File has been deleted successfully.',
      });
      // Refetch the files list
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: 'Deletion Failed',
        description: error.message || 'Failed to delete file.',
        variant: 'destructive',
      });
    }
  });

  // Mutation for generating pre-signed URL
  const getPresignedUrlMutation = useMutation({
    mutationFn: async (fileUrl: string) => {
      if (!organizationId) {
        throw new Error('No organization ID found');
      }
      return await apiRequest(`/api/organizations/${organizationId}/cloud-storage/presigned-url`, {
        method: 'POST',
        body: JSON.stringify({ fileUrl }),
      });
    },
    onSuccess: (data: { url: string }) => {
      // Open the presigned URL in a new tab
      window.open(data.url, '_blank');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to generate download link',
        description: error.message || 'Could not generate a download link for this file.',
        variant: 'destructive',
      });
    }
  });

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    setUploadProgress(10); // Start with 10% to show progress has begun

    // Simulate progress (in a real app this would be tied to actual upload progress)
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        const newProgress = prev + Math.random() * 15;
        return newProgress > 90 ? 90 : newProgress; // Cap at 90% until actual completion
      });
    }, 500);

    uploadMutation.mutate(formData, {
      onSuccess: () => {
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
      onError: () => {
        clearInterval(progressInterval);
        setUploadProgress(0);
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    });
  };

  // Filter files based on search term
  const filteredFiles = searchTerm.trim() === '' 
    ? files 
    : files.filter(file => 
        file.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle download
  const handleDownload = (fileUrl: string) => {
    getPresignedUrlMutation.mutate(fileUrl);
  };

  // Handle delete
  const handleDelete = (fileUrl: string) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      deleteMutation.mutate(fileUrl);
    }
  };

  // If the feature is not enabled, show a message
  if (!isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <FolderSearch className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Cloud Storage is Not Enabled</h3>
        <p className="text-muted-foreground max-w-md">
          You need to enable cloud storage in the Settings tab before you can manage files.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* File Upload and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            size="sm"
            disabled={isLoadingFiles}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingFiles ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <div className="relative">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
              ref={fileInputRef}
              disabled={isUploading}
            />
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Files Table */}
      {isLoadingFiles ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading files...</span>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Files Found</h3>
          <p className="text-muted-foreground">
            {searchTerm ? 'No files match your search criteria.' : 'Upload files to see them here.'}
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded On</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFiles.map((file) => (
              <TableRow key={file.url}>
                <TableCell className="font-medium">
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="truncate max-w-[200px]" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{file.contentType || 'Unknown'}</TableCell>
                <TableCell>{formatFileSize(file.size)}</TableCell>
                <TableCell>
                  {format(new Date(file.createdOn), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(file.url)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(file.url)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default function CloudStorageSettings() {
  const [activeTab, setActiveTab] = useState('settings');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'success' | 'error'>('untested');
  const [showWizard, setShowWizard] = useState(false);

  // Fetch existing cloud storage configuration
  // First fetch the current user to get the organization ID
  const { data: currentUser } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      return await apiRequest('/api/user');
    }
  });

  // Then fetch the cloud storage configuration using the organization ID from the user
  const { 
    data: storageConfig, 
    isLoading, 
    error 
  } = useQuery<CloudStorageResponse>({
    queryKey: ['/api/organizations/:organizationId/cloud-storage', currentUser?.organizationId],
    queryFn: async () => {
      if (!currentUser?.organizationId) {
        throw new Error('No organization ID found');
      }
      return await apiRequest(`/api/organizations/${currentUser.organizationId}/cloud-storage`);
    },
    enabled: !!currentUser?.organizationId // Only run query when we have an organization ID
  });

  // Form for cloud storage settings
  const form = useForm<CloudStorageFormValues>({
    resolver: zodResolver(cloudStorageSchema),
    defaultValues: {
      provider: 'local',
      enabled: false,
      connectionString: '',
      container: '',
      bucket: '',
      region: '',
      folder: '',
      accessKey: '',
      secretKey: '',
      endpoint: '',
    }
  });

  // Update form when data is loaded
  useEffect(() => {
    if (storageConfig) {
      form.reset({
        provider: storageConfig.provider as any,
        enabled: storageConfig.enabled,
        connectionString: storageConfig.config?.connectionString || '',
        container: storageConfig.config?.container || '',
        bucket: storageConfig.config?.bucket || '',
        region: storageConfig.config?.region || '',
        folder: storageConfig.config?.folder || '',
        accessKey: storageConfig.config?.accessKey || '',
        secretKey: storageConfig.config?.secretKey || '',
        endpoint: storageConfig.config?.endpoint || '',
      });
      
      // Update connection status
      setConnectionStatus(storageConfig.isConfigured ? 'success' : 'error');
      
      // Show wizard if not configured
      if (!storageConfig.isConfigured && !storageConfig.enabled) {
        setShowWizard(true);
      }
    }
  }, [storageConfig, form]);

  // Mutation to update cloud storage settings
  const updateMutation = useMutation({
    mutationFn: async (data: CloudStorageFormValues) => {
      if (!currentUser?.organizationId) {
        throw new Error('No organization ID found');
      }
      return await apiRequest(`/api/organizations/${currentUser.organizationId}/cloud-storage`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Settings updated',
        description: 'Your cloud storage settings have been saved.',
      });
      
      // Invalidate the query to refetch the data
      queryClient.invalidateQueries({ 
        queryKey: ['/api/organizations/:organizationId/cloud-storage', currentUser?.organizationId] 
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update settings.',
        variant: 'destructive',
      });
    },
  });

  // Mutation to test connection
  const testConnectionMutation = useMutation({
    mutationFn: async (data: CloudStorageFormValues) => {
      if (!currentUser?.organizationId) {
        throw new Error('No organization ID found');
      }
      return await apiRequest(`/api/organizations/${currentUser.organizationId}/cloud-storage/test-connection`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      setConnectionStatus(data?.success ? 'success' : 'error');
      toast({
        title: data?.success ? 'Connection successful' : 'Connection failed',
        description: data?.success 
          ? 'Successfully connected to cloud storage.' 
          : 'Failed to connect to cloud storage. Please check your settings.',
        variant: data?.success ? 'default' : 'destructive',
      });
    },
    onError: () => {
      setConnectionStatus('error');
      toast({
        title: 'Connection failed',
        description: 'Failed to test connection. Please check your settings.',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setTestingConnection(false);
    }
  });

  // Watch provider to conditionally render fields
  const provider = form.watch('provider');
  
  // Handle form submission
  const onSubmit = (data: CloudStorageFormValues) => {
    updateMutation.mutate(data);
  };

  // Test connection with current form values
  const testConnection = () => {
    setTestingConnection(true);
    const formData = form.getValues();
    testConnectionMutation.mutate(formData);
  };

  // Test connection with existing/saved settings
  const testExistingConnection = () => {
    setTestingConnection(true);
    testConnectionMutation.mutate({ 
      ...form.getValues(),
      testExisting: true 
    } as any);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-16">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading cloud storage settings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">Cloud Storage Settings</h1>
        
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Cloud Storage Configuration</CardTitle>
            <CardDescription>
              Configure cloud storage for audio files and other documents.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to load cloud storage settings. Please try again later.
              </AlertDescription>
            </Alert>
            
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                This could be due to:
              </p>
              <ul className="list-disc pl-6 text-sm text-muted-foreground mt-2">
                <li>Connection issues with the server</li>
                <li>Missing or invalid organization settings</li>
                <li>Temporary service disruption</li>
              </ul>
            </div>
            
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-4"
              variant="outline"
            >
              <span className="mr-2">Try Again</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Cloud Storage Settings</h1>
      
      {/* Wizard for first-time setup */}
      {showWizard && (
        <Card className="max-w-3xl mx-auto mb-8">
          <CardHeader>
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-primary/10 mr-4">
                <CloudIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Cloud Storage Setup Wizard</CardTitle>
                <CardDescription>
                  Configure cloud storage for your organization
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <InformationCircle className="h-4 w-4" />
              <AlertTitle>Getting Started</AlertTitle>
              <AlertDescription>
                You haven't configured cloud storage yet. Follow these steps to securely store your audio files in the cloud.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4 mt-4">
              <div className="flex items-start space-x-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border bg-primary text-white">
                  1
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium">Choose a storage provider</h4>
                  <p className="text-sm text-muted-foreground">
                    Select from Azure Blob Storage, AWS S3, Google Cloud Storage, or use local storage for development.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border bg-primary text-white">
                  2
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium">Enter your credentials</h4>
                  <p className="text-sm text-muted-foreground">
                    Add the necessary credentials for your selected provider. Your data is encrypted and stored securely.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border bg-primary text-white">
                  3
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium">Test the connection</h4>
                  <p className="text-sm text-muted-foreground">
                    Verify your credentials by testing the connection before saving your settings.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border bg-primary text-white">
                  4
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium">Enable cloud storage</h4>
                  <p className="text-sm text-muted-foreground">
                    Once tested successfully, enable cloud storage to start storing your audio files securely.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button variant="outline" onClick={() => setShowWizard(false)}>
              Continue to Setup
            </Button>
          </CardFooter>
        </Card>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>
        
        <TabsContent value="settings">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Cloud Storage Configuration</CardTitle>
                  <CardDescription>
                    Configure cloud storage for audio files and other documents.
                  </CardDescription>
                </div>
                
                <Badge 
                  variant={
                    connectionStatus === 'untested' ? 'outline' : 
                    connectionStatus === 'success' ? 'default' : 
                    'destructive'
                  }
                  className="ml-auto"
                >
                  {connectionStatus === 'untested' && 'Not Tested'}
                  {connectionStatus === 'success' && (
                    <span className="flex items-center">
                      <Check className="mr-1 h-3 w-3" />
                      Connected
                    </span>
                  )}
                  {connectionStatus === 'error' && (
                    <span className="flex items-center">
                      <X className="mr-1 h-3 w-3" />
                      Not Connected
                    </span>
                  )}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Cloud Storage</FormLabel>
                          <FormDescription>
                            When enabled, audio files will be stored in the configured cloud storage.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Storage Provider</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a storage provider" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="azure">Azure Blob Storage</SelectItem>
                            <SelectItem value="aws">AWS S3</SelectItem>
                            <SelectItem value="gcp">Google Cloud Storage</SelectItem>
                            <SelectItem value="local">Local Storage (Development)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select your preferred cloud storage provider.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Separator className="my-4" />
                  
                  {/* Provider-specific fields */}
                  {provider === 'azure' && (
                    <>
                      <FormField
                        control={form.control}
                        name="connectionString"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Connection String</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter Azure connection string" {...field} type="password" />
                            </FormControl>
                            <FormDescription>
                              The connection string for your Azure Storage account.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="container"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Container Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., audio-files" {...field} />
                            </FormControl>
                            <FormDescription>
                              The name of the Azure Blob Storage container.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  
                  {provider === 'aws' && (
                    <>
                      <FormField
                        control={form.control}
                        name="accessKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Access Key</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter AWS access key" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="secretKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secret Key</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter AWS secret key" type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="region"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Region</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., us-east-1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="bucket"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bucket Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., my-audio-files" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  
                  {provider === 'gcp' && (
                    <>
                      <FormField
                        control={form.control}
                        name="accessKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>JSON Key</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter GCP service account JSON key" type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="bucket"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bucket Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., my-gcp-bucket" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  
                  {provider === 'local' && (
                    <FormField
                      control={form.control}
                      name="folder"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Storage Folder</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., ./uploads" {...field} />
                          </FormControl>
                          <FormDescription>
                            Local folder path for development purposes only.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <div className="pt-4 flex gap-4">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={testConnection}
                      disabled={testingConnection}
                    >
                      {testingConnection ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        'Test Connection'
                      )}
                    </Button>
                    
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={testExistingConnection}
                      disabled={testingConnection}
                    >
                      {testingConnection ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        'Test Current Settings'
                      )}
                    </Button>
                    
                    <Button 
                      type="submit" 
                      className="ml-auto"
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Settings'
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="files">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Cloud Storage Files</CardTitle>
                  <CardDescription>
                    Browse and manage files stored in your cloud storage
                  </CardDescription>
                </div>
                {connectionStatus !== 'success' && (
                  <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Cloud Storage Not Configured</AlertTitle>
                    <AlertDescription>
                      Please configure and enable cloud storage in the Settings tab first.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardHeader>
            
            <CardContent>
              <FilesManager
                organizationId={currentUser?.organizationId}
                isEnabled={storageConfig?.enabled && connectionStatus === 'success'}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}