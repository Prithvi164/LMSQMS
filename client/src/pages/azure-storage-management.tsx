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
        
        // Invalidate the containers query to refresh the list
        queryClient.invalidateQueries({ queryKey: ['/api/azure-containers'] });
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
        <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-green-800">Selected Container</h2>
              <p className="text-green-700">{selectedContainer}</p>
            </div>
            <Button 
              onClick={() => setActiveTab("uploader")}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Files
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {/* Container List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Storage Containers</h2>
            <Button onClick={() => {
              // Navigate to the container tab with parameters for showing the create dialog
              window.location.href = "/azure-storage-management?create=true";
            }}>
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
                <Card key={container.name} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg truncate">{container.name}</CardTitle>
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
                      >
                        <Link href={`/azure-storage-browser/${container.name}`}>
                          <FolderOpen className="mr-2 h-4 w-4" />
                          Browse
                        </Link>
                      </Button>
                      <Button 
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedContainer(container.name);
                          setActiveTab("uploader");
                        }}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
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
          <div className="space-y-4 pt-8 border-t">
            <h2 className="text-2xl font-bold">Upload Files to {selectedContainer}</h2>
            <AzureFileUploader 
              containerName={selectedContainer} 
              onUploadSuccess={(fileData) => {
                console.log("File uploaded successfully:", fileData);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default AzureStorageManagement;