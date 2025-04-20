import React, { useState } from "react";
import { Link, useParams } from "wouter";
import { AzureContainerManager } from "@/components/azure-storage/azure-container-manager";
import { AzureFileUploader } from "@/components/azure-storage/azure-file-uploader";
import { Button } from "@/components/ui/button";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { FolderOpen, HardDrive, Upload, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

export function AzureStorageManagement() {
  // Get container name from URL if present
  const { containerName } = useParams<{ containerName?: string }>();
  const [selectedContainer, setSelectedContainer] = useState<string | null>(containerName || null);
  const [activeTab, setActiveTab] = useState<string>(containerName ? "uploader" : "containers");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newContainerName, setNewContainerName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  
  // Container name validation regex
  const containerNameRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

  interface Container {
    name: string;
    properties?: {
      publicAccess?: string;
      lastModified?: string;
    };
  }
  
  // Mutation to create a container
  const createContainer = useMutation({
    mutationFn: async () => {
      // Validate container name
      if (!containerNameRegex.test(newContainerName)) {
        setValidationError(
          "Container name must be 3-63 characters, use only lowercase letters, numbers, and dashes, and begin and end with a letter or number."
        );
        return null;
      }
      
      const data = {
        containerName: newContainerName,
        isPublic
      };
      
      return apiRequest('POST', '/api/azure-containers', data);
    },
    onSuccess: (data) => {
      if (data) {
        toast({
          title: "Container created",
          description: `Container "${newContainerName}" created successfully.`,
        });
        setNewContainerName("");
        setIsPublic(false);
        setIsCreateDialogOpen(false);
        setValidationError(null);
        
        // Invalidate the containers query to refresh the list and select the new container
        queryClient.invalidateQueries({ queryKey: ['/api/azure-containers'] });
        
        // Set the newly created container as selected
        setSelectedContainer(newContainerName);
      }
    },
    onError: (error: any) => {
      console.error("Error creating container:", error);
      
      // Extract more detailed error message if available
      let errorMessage = "Failed to create container. Please try again.";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      // Display error toast with more detailed message
      toast({
        title: "Error Creating Container",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Query to fetch all containers
  const { isLoading, data: containers = [], error, refetch } = useQuery<Container[]>({
    queryKey: ['/api/azure-containers'],
  });

  // Set selected container if it exists in the list
  React.useEffect(() => {
    if (containerName && containers && containers.length > 0) {
      const exists = containers.some((container) => container.name === containerName);
      if (exists) {
        setSelectedContainer(containerName);
        setActiveTab("uploader");
      }
    }
    
    // Check for URL parameters
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === 'true') {
      setIsCreateDialogOpen(true);
    }
  }, [containerName, containers]);

  return (
    <div className="container mx-auto py-8 px-4">
      <header className="mb-8">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/azure-storage-management">Azure Storage</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {selectedContainer && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink>{selectedContainer}</BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold">Azure Storage Management</h1>
          <Button asChild variant="outline" size="sm">
            <Link href="/azure-storage-browser">
              <FolderOpen className="mr-2 h-4 w-4" />
              Browse Files
            </Link>
          </Button>
        </div>
      </header>

      {/* Selected container info */}
      {selectedContainer && (
        <div className="mb-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow-sm overflow-hidden">
          <div className="border border-green-200 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-green-800 flex items-center">
                  <HardDrive className="mr-2 h-5 w-5" />
                  {selectedContainer}
                </h2>
                <p className="text-green-700 text-sm mt-1">Ready for file operations</p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedContainer(null)}
                  className="border-red-200 text-red-700 hover:bg-red-50"
                >
                  Deselect
                </Button>
                <Button 
                  onClick={() => {
                    // Scroll to the upload section
                    const uploadSection = document.getElementById('upload-section');
                    if (uploadSection) {
                      uploadSection.scrollIntoView({ behavior: 'smooth' });
                      
                      // Try to trigger the file selection dialog
                      setTimeout(() => {
                        const selectFileButton = document.querySelector('[data-action="select-file"]');
                        if (selectFileButton && selectFileButton instanceof HTMLButtonElement) {
                          selectFileButton.click();
                        }
                      }, 300);
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Files
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {/* Container List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Storage Containers</h2>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <HardDrive className="mr-2 h-4 w-4" />
              Create Container
            </Button>
          </div>
          
          {isLoading ? (
            <div className="text-center p-8">Loading containers...</div>
          ) : error ? (
            <div className="text-center p-8 text-red-500">
              Failed to load containers. 
              <Button variant="link" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : containers.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-lg">
              No containers found. Create a container to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {containers.map((container) => (
                <Card 
                  key={container.name} 
                  className={`overflow-hidden hover:shadow-md transition-shadow ${selectedContainer === container.name ? 'ring-2 ring-primary/50' : ''}`}
                  onClick={() => setSelectedContainer(container.name)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg truncate">{container.name}</CardTitle>
                      {selectedContainer === container.name && (
                        <div className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          Selected
                        </div>
                      )}
                    </div>
                    <CardDescription>
                      {container.properties?.publicAccess
                        ? `Public Access: ${container.properties.publicAccess}`
                        : "Private Access"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-sm text-gray-500">
                      Last Modified: {container.properties?.lastModified 
                        ? new Date(container.properties.lastModified).toLocaleString() 
                        : "Unknown"}
                    </p>
                  </CardContent>
                  <CardFooter className="pt-2">
                    <div className="flex gap-2 w-full">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link href={`/azure-storage-browser/${container.name}`}>
                          <FolderOpen className="mr-2 h-4 w-4" />
                          Browse Files
                        </Link>
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
        
        {/* File Upload Section */}
        {selectedContainer && (
          <div id="upload-section" className="space-y-4 pt-8 border-t">
            <h2 className="text-2xl font-bold">Upload Files to {selectedContainer}</h2>
            <AzureFileUploader 
              containerName={selectedContainer} 
              onUploadSuccess={(fileData) => {
                console.log("File uploaded successfully:", fileData);
                // Show success toast with details
                toast({
                  title: "File Uploaded Successfully",
                  description: `${fileData.name || fileData.originalname} uploaded to ${selectedContainer}`,
                  variant: "default",
                });
              }}
            />
          </div>
        )}
      </div>
      
      {/* Container Creation Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Storage Container</DialogTitle>
            <DialogDescription>
              Create a new Azure Storage container for storing audio files.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="container-name">Container Name</Label>
              <Input
                id="container-name"
                placeholder="Enter container name"
                value={newContainerName}
                onChange={(e) => {
                  setNewContainerName(e.target.value.toLowerCase());
                  setValidationError(null);
                }}
              />
              {validationError && (
                <p className="text-sm text-red-500">{validationError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Container names must be 3-63 characters, use only lowercase letters, numbers, 
                and dashes, and begin and end with a letter or number.
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="is-public" 
                checked={isPublic} 
                onCheckedChange={(checked) => setIsPublic(checked === true)}
              />
              <Label htmlFor="is-public" className="text-sm">
                Make container public (allows anonymous access)
              </Label>
            </div>
          </div>
          
          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setNewContainerName("");
                  setIsPublic(false);
                  setValidationError(null);
                }}
                disabled={!newContainerName || createContainer.isPending}
              >
                Clear
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createContainer.mutate()}
                disabled={!newContainerName || createContainer.isPending}
              >
                {createContainer.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Container"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AzureStorageManagement;