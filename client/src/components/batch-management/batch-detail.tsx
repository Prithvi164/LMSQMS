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
import { TrainerAvailability } from "./trainer-availability";

export function BatchDetail() {
  const [activeTab, setActiveTab] = useState("batches");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

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
            <TabsList className="grid w-full grid-cols-5"> {/* Increased cols to 5 */}
              <TabsTrigger value="batches">Batches</TabsTrigger>
              <TabsTrigger value="trainer">Trainer Availability</TabsTrigger> {/* Added Trainer Availability tab */}
              <TabsTrigger value="lob">Line of Business</TabsTrigger>
              <TabsTrigger value="process">Process</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
            </TabsList>
            <TabsContent value="batches" className="mt-6">
              <BatchesTab onCreate={() => setIsCreateDialogOpen(true)}/>
            </TabsContent>
            <TabsContent value="trainer" className="mt-6"> {/* Added Trainer Availability content */}
              <TrainerAvailability />
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