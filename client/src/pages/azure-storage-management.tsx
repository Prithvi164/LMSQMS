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
import { Database, FolderOpen, HardDrive, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

export function AzureStorageManagement() {
  // Get container name from URL if present
  const { containerName } = useParams<{ containerName?: string }>();
  const [selectedContainer, setSelectedContainer] = useState<string | null>(containerName || null);
  const [activeTab, setActiveTab] = useState<string>(containerName ? "uploader" : "containers");

  interface Container {
    name: string;
    properties?: {
      publicAccess?: string;
      lastModified?: string;
    };
  }

  // Query to check if container exists (if one is specified)
  const { isLoading, data: containers = [] } = useQuery<Container[]>({
    queryKey: ['/api/azure-containers'],
    enabled: !!containerName, // Only run if containerName is provided
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
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/azure-storage-browser">
                <FolderOpen className="mr-2 h-4 w-4" />
                Browse Files
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="containers">
            <HardDrive className="mr-2 h-4 w-4" /> 
            Containers
          </TabsTrigger>
          <TabsTrigger 
            value="uploader" 
            disabled={!selectedContainer}
            title={!selectedContainer ? "Select a container first" : "Upload files"}
          >
            <Upload className="mr-2 h-4 w-4" /> 
            File Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="containers" className="space-y-4">
          <AzureContainerManager />
        </TabsContent>

        <TabsContent value="uploader" className="space-y-4">
          {selectedContainer ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Upload to {selectedContainer}</h2>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setSelectedContainer(null);
                    setActiveTab("containers");
                  }}
                >
                  Change Container
                </Button>
              </div>
              <AzureFileUploader 
                containerName={selectedContainer} 
                onUploadSuccess={(fileData) => {
                  console.log("File uploaded successfully:", fileData);
                }}
              />
            </div>
          ) : (
            <div className="text-center p-8 border border-dashed rounded-md">
              <p className="text-gray-500 dark:text-gray-400">
                Please select a container first to upload files.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setActiveTab("containers")} 
                className="mt-4"
              >
                Go to Containers
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AzureStorageManagement;