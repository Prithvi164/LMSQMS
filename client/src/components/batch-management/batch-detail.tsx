import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProcessDetail } from "./process-detail";
import { LocationDetail } from "./location-detail";
import { LobDetail } from "./lob-detail";
import { BatchesTab } from "./batches-tab";
import { CreateBatchForm } from "./create-batch-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BatchDetailProps {
  onCreateBatch?: () => void;
}

export function BatchDetail({ onCreateBatch }: BatchDetailProps) {
  // Always default to "batches" tab when component mounts
  const [activeTab, setActiveTab] = useState("batches");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Get user and permission details
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  
  // Check if user has permission to manage line of business
  const canManageLineOfBusiness = hasPermission("manage_lineofbusiness");
  
  // For owners, we want to override any permission check
  const isOwner = user?.role === 'owner';
  
  // The effective permission is true if user is owner OR has the specific permission
  const canViewLineOfBusiness = isOwner || canManageLineOfBusiness;
  
  // Debug logging for permission status
  console.log('Batch Detail Component - LOB Permission Check:', {
    role: user?.role,
    hasManageLineOfBusinessPermission: canManageLineOfBusiness,
    isOwner,
    canViewLineOfBusiness
  });
  
  // Save the active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("batchManagementActiveTab", activeTab);
  }, [activeTab]);
  
  // If user tries to access the Line of Business tab but doesn't have permission, switch to batches tab
  useEffect(() => {
    if (activeTab === "lob" && !canViewLineOfBusiness) {
      setActiveTab("batches");
      console.log("No permission to view Line of Business, redirecting to Batches tab");
    }
  }, [activeTab, canViewLineOfBusiness]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Batch Management Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={`grid w-full ${canViewLineOfBusiness ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <TabsTrigger value="batches">Batches</TabsTrigger>
              {/* Only show Line of Business tab if user has permission */}
              {canViewLineOfBusiness && (
                <TabsTrigger value="lob">Line of Business</TabsTrigger>
              )}
              <TabsTrigger value="process">Process</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
            </TabsList>
            <TabsContent value="batches" className="mt-6">
              <BatchesTab onCreate={() => {
                setIsCreateDialogOpen(true);
                onCreateBatch?.();
              }} />
            </TabsContent>
            {/* Only render Line of Business tab content if user has permission */}
            {canViewLineOfBusiness && (
              <TabsContent value="lob" className="mt-6">
                <LobDetail />
              </TabsContent>
            )}
            <TabsContent value="process" className="mt-6">
              <ProcessDetail />
            </TabsContent>
            <TabsContent value="location" className="mt-6">
              <LocationDetail />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
          </DialogHeader>
          <CreateBatchForm onSuccess={() => setIsCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}