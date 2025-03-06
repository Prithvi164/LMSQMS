import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProcessDetail } from "./process-detail";
import { LocationDetail } from "./location-detail";
import { LobDetail } from "./lob-detail";
import { BatchesTab } from "./batches-tab";
import { CreateBatchForm } from "./create-batch-form";
import { TraineeManagement } from "./trainee-management";
import { useAuth } from "@/hooks/use-auth";
import { useParams } from "wouter";

export function BatchDetail() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("batches");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const params = useParams();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Batch Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch Management Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="batches">Batches</TabsTrigger>
              <TabsTrigger value="lob">Line of Business</TabsTrigger>
              <TabsTrigger value="process">Process</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
            </TabsList>
            <TabsContent value="batches" className="mt-6">
              <BatchesTab onCreate={() => setIsCreateDialogOpen(true)} />
            </TabsContent>
            <TabsContent value="lob" className="mt-6">
              <LobDetail />
            </TabsContent>
            <TabsContent value="process" className="mt-6">
              <ProcessDetail />
            </TabsContent>
            <TabsContent value="location" className="mt-6">
              <LocationDetail />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add TraineeManagement when batch ID is available */}
      {params.batchId && (
        <Card>
          <CardContent className="pt-6">
            <TraineeManagement
              batchId={parseInt(params.batchId)}
              organizationId={user?.organizationId || 0}
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
          </DialogHeader>
          <CreateBatchForm />
        </DialogContent>
      </Dialog>
    </div>
  );
}