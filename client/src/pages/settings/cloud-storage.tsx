import { useState, useEffect } from 'react';
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
import { Loader2, Check, X, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

export default function CloudStorageSettings() {
  const [activeTab, setActiveTab] = useState('settings');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'success' | 'error'>('untested');

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
      <Alert variant="destructive" className="mx-auto my-8 max-w-2xl">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load cloud storage settings. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Cloud Storage Settings</h1>
      
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
          <Card className="max-w-3xl mx-auto p-6">
            <div className="py-8 text-center">
              <h3 className="text-lg font-medium mb-2">Files Management Coming Soon</h3>
              <p className="text-muted-foreground">
                This feature will allow you to browse, upload, and manage files in your cloud storage.
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}