import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchDetail } from "@/components/batch-management/batch-detail";
import { ProcessDetail } from "@/components/batch-management/process-detail";
import { LobDetail } from "@/components/batch-management/lob-detail";
import { LocationDetail } from "@/components/batch-management/location-detail";

export default function BatchManagement() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
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