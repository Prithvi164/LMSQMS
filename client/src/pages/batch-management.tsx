import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BatchDetail } from "@/components/batch-management/batch-detail";
import { ProcessDetail } from "@/components/batch-management/process-detail";
import { LobDetail } from "@/components/batch-management/lob-detail";
import { LocationDetail } from "@/components/batch-management/location-detail";
import { CreateBatchForm } from "@/components/batch-management/create-batch-form";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";

export default function BatchManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Batch Management</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add New Batch</Button>
          </DialogTrigger>
          <DialogContent 
            className="max-w-4xl"
            aria-describedby="batch-form-description"
          >
            <DialogHeader>
              <DialogTitle>Create New Batch</DialogTitle>
              <DialogDescription id="batch-form-description">
                Fill in the details to create a new training batch. All dates will be calculated automatically based on the selected process.
              </DialogDescription>
            </DialogHeader>
            <CreateBatchForm onClose={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="batch-detail" className="space-y-4">
        <TabsList>
          <TabsTrigger value="batch-detail">Batch Detail</TabsTrigger>
          <TabsTrigger value="process-detail">Process Detail</TabsTrigger>
          <TabsTrigger value="lob-detail">LOB Detail</TabsTrigger>
          <TabsTrigger value="location-detail">Location Detail</TabsTrigger>
        </TabsList>

        <TabsContent value="batch-detail" className="space-y-4">
          <BatchDetail />
        </TabsContent>

        <TabsContent value="process-detail" className="space-y-4">
          <ProcessDetail />
        </TabsContent>

        <TabsContent value="lob-detail" className="space-y-4">
          <LobDetail />
        </TabsContent>

        <TabsContent value="location-detail" className="space-y-4">
          <LocationDetail />
        </TabsContent>
      </Tabs>
    </div>
  );
}