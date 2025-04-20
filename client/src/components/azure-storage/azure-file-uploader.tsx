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
import { Loader2, Upload, X } from "lucide-react";
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload File to Azure Storage</CardTitle>
        <CardDescription>
          Upload a file to the {containerName} container in Azure Blob Storage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File selector */}
        <div className="space-y-2">
          <Label htmlFor="file-upload">Select File</Label>
          <div className="flex items-center gap-2">
            <Input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              onChange={handleFileChange}
              className="flex-1"
              disabled={uploadFile.isPending}
            />
            {selectedFile && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearSelectedFile}
                disabled={uploadFile.isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* File information */}
        {selectedFile && (
          <div className="p-3 border rounded-md bg-gray-50 dark:bg-gray-900">
            <p className="font-medium truncate">{selectedFile.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {(selectedFile.size / 1024).toFixed(2)} KB • {selectedFile.type || "Unknown type"}
            </p>
          </div>
        )}

        {/* Custom blob name */}
        <div className="space-y-2">
          <Label htmlFor="blob-name">
            Blob Name (Optional)
          </Label>
          <Input
            id="blob-name"
            value={blobName}
            onChange={(e) => setBlobName(e.target.value)}
            placeholder="Custom name for the blob (file) in Azure"
            disabled={uploadFile.isPending || !selectedFile}
          />
          <p className="text-xs text-gray-500">
            Leave blank to use the original filename.
          </p>
        </div>

        {/* Metadata */}
        <div className="space-y-2">
          <Label htmlFor="metadata">
            Metadata (Optional)
          </Label>
          <Textarea
            id="metadata"
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
            placeholder="key1: value1&#10;key2: value2&#10;&#10;Or paste JSON object"
            className="min-h-[100px]"
            disabled={uploadFile.isPending || !selectedFile}
          />
          <p className="text-xs text-gray-500">
            Add metadata as key-value pairs (one per line) or a JSON object.
          </p>
        </div>

        {/* Upload progress */}
        {uploadProgress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Uploading...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} max={100} />
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
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
      </CardFooter>
    </Card>
  );
}