import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus } from "lucide-react";
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
import { AddTraineeForm } from "./add-trainee-form";

export function BatchDetail() {
  const [activeTab, setActiveTab] = useState("batches");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddTraineeDialogOpen, setIsAddTraineeDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  const handleAddTrainee = (batch: any) => {
    setSelectedBatch(batch);
    setIsAddTraineeDialogOpen(true);
  };

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
              <BatchesTab 
                onCreate={() => setIsCreateDialogOpen(true)}
                onAddTrainee={handleAddTrainee}
              />
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

      {/* Create Batch Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
          </DialogHeader>
          <CreateBatchForm />
        </DialogContent>
      </Dialog>

      {/* Add Trainee Dialog */}
      {selectedBatch && (
        <Dialog 
          open={isAddTraineeDialogOpen} 
          onOpenChange={(open) => {
            setIsAddTraineeDialogOpen(open);
            if (!open) setSelectedBatch(null);
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Add Trainee to Batch</DialogTitle>
            </DialogHeader>
            <AddTraineeForm 
              isOpen={isAddTraineeDialogOpen}
              onClose={() => {
                setIsAddTraineeDialogOpen(false);
                setSelectedBatch(null);
              }}
              batchData={selectedBatch}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}