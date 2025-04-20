import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, X, File as FileIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

interface AzureFileUploaderProps {
  containerName: string;
  onUploadSuccess?: (fileData: any) => void;
}

export function AzureFileUploader({ containerName, onUploadSuccess }: AzureFileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [blobName, setBlobName] = useState<string>("");
  const [metadata, setMetadata] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setBlobName(file.name); // Default blob name to file name
    }
  };

  // Clear selected file
  const clearSelectedFile = () => {
    setSelectedFile(null);
    setBlobName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Convert metadata string to object
  const parseMetadata = (metadataStr: string): Record<string, string> => {
    const result: Record<string, string> = {};
    
    if (!metadataStr.trim()) {
      return result;
    }
    
    try {
      // Try to parse as JSON first
      return JSON.parse(metadataStr);
    } catch (e) {
      // If not valid JSON, try to parse as key-value pairs
      metadataStr.split('\n').forEach(line => {
        const [key, value] = line.split(':').map(part => part.trim());
        if (key && value) {
          result[key] = value;
        }
      });
      return result;
    }
  };

  // Upload file mutation
  const uploadFile = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !containerName) {
        throw new Error("File and container name are required");
      }

      console.log(`Starting file upload for container: ${containerName}, file: ${selectedFile.name}`);

      // Create FormData object
      const formData = new FormData();
      formData.append("file", selectedFile);
      
      // Add custom blob name if provided
      if (blobName && blobName !== selectedFile.name) {
        formData.append("blobName", blobName);
        console.log(`Using custom blob name: ${blobName}`);
      }
      
      // Add content type
      formData.append("contentType", selectedFile.type);
      console.log(`File content type: ${selectedFile.type}`);
      
      // Add metadata if provided
      const metadataObj = parseMetadata(metadata);
      Object.entries(metadataObj).forEach(([key, value]) => {
        formData.append(`metadata-${key}`, value);
        console.log(`Added metadata: ${key}=${value}`);
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newValue = prev + Math.random() * 10;
          return newValue > 90 ? 90 : newValue;
        });
      }, 200);

      try {
        // Upload file
        const uploadUrl = `/api/azure-upload/${encodeURIComponent(containerName)}`;
        console.log(`Sending upload request to: ${uploadUrl}`);
        
        const response = await fetch(uploadUrl, {
          method: "POST",
          body: formData,
        });
        
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        console.log(`Upload response status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Upload failed with status ${response.status}: ${errorText}`);
          let errorMessage = "Upload failed";
          
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorMessage;
          } catch (e) {
            errorMessage = errorText || errorMessage;
          }
          
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        console.log("Upload successful:", result);
        return result;
      } catch (error) {
        console.error("Error in upload:", error);
        clearInterval(progressInterval);
        setUploadProgress(0);
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "File uploaded",
        description: `Successfully uploaded ${selectedFile?.name} to ${containerName}`,
      });
      clearSelectedFile();
      setMetadata("");
      setUploadProgress(0);
      
      // Invalidate blob list query
      queryClient.invalidateQueries({ queryKey: [`/api/azure-blobs/${containerName}`] });
      
      // Call success callback if provided
      if (onUploadSuccess) {
        onUploadSuccess(data.file);
      }
    },
    onError: (error: Error) => {
      console.error("Error uploading file:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  // Function to trigger file input click
  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <Card className="shadow-sm border-blue-100">
      <CardHeader className="pb-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardTitle className="text-lg flex items-center text-blue-700">
          <Upload className="mr-2 h-5 w-5" />
          Upload to {containerName}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-5 space-y-4">
        {/* Hidden file input */}
        <Input
          ref={fileInputRef}
          id="file-upload"
          type="file"
          onChange={handleFileChange}
          className="hidden"
        />
        
        {!selectedFile ? (
          <div 
            className="border-2 border-dashed border-blue-200 rounded-lg p-6 
                     text-center hover:border-blue-400 transition-colors cursor-pointer"
            onClick={triggerFileSelect}
            data-action="select-file"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-blue-50 rounded-full">
                <Upload className="h-8 w-8 text-blue-500" />
              </div>
              <div>
                <p className="font-medium text-gray-700">Click to select a file</p>
                <p className="text-sm text-gray-500 mt-1">
                  Drop audio files here or click to browse
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white rounded-md">
                    <FileIcon className="h-8 w-8 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium truncate max-w-xs">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024).toFixed(2)} KB • {selectedFile.type || "Unknown type"}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelectedFile}
                  className="text-red-500 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="blob-name" className="text-sm font-medium">File Name in Azure</Label>
                <Input
                  id="blob-name"
                  value={blobName}
                  onChange={(e) => setBlobName(e.target.value)}
                  placeholder="Leave blank to use original filename"
                  className="border-blue-200 focus:border-blue-400"
                />
              </div>
              
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="metadata" className="text-sm font-medium">
                  Metadata <span className="text-gray-400 font-normal">(Optional)</span>
                </Label>
                <Input
                  id="metadata"
                  value={metadata}
                  onChange={(e) => setMetadata(e.target.value)}
                  placeholder="key1:value1, key2:value2"
                  className="border-blue-200 focus:border-blue-400"
                />
              </div>
            </div>
            
            {/* Upload progress */}
            {uploadProgress > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-blue-700">Uploading file...</span>
                  <span className="text-blue-700 font-medium">{Math.round(uploadProgress)}%</span>
                </div>
                <Progress 
                  value={uploadProgress} 
                  max={100}
                  className="h-2 bg-blue-100" 
                />
              </div>
            )}
          </>
        )}
      </CardContent>
      
      <CardFooter className={`border-t ${selectedFile ? 'bg-blue-50' : 'bg-gray-50'}`}>
        {selectedFile && (
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => uploadFile.mutate()}
            disabled={!selectedFile || uploadFile.isPending}
          >
            {uploadFile.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload to Azure
              </>
            )}
          </Button>
        )}
        {!selectedFile && (
          <Button 
            className="w-full" 
            variant="outline"
            onClick={triggerFileSelect}
          >
            <Upload className="mr-2 h-4 w-4" />
            Select a file to upload
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}