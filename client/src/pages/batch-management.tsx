import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchDetail } from "@/components/batch-management/batch-detail";
import { ProcessDetail } from "@/components/batch-management/process-detail";

export default function BatchManagement() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <Tabs defaultValue="batch-detail" className="space-y-4">
        <TabsList>
          <TabsTrigger value="batch-detail">Batch Detail</TabsTrigger>
          <TabsTrigger value="process-detail">Process Detail</TabsTrigger>
        </TabsList>

        <TabsContent value="batch-detail" className="space-y-4">
          <BatchDetail />
        </TabsContent>

        <TabsContent value="process-detail" className="space-y-4">
          <ProcessDetail />
        </TabsContent>
      </Tabs>
    </div>
  );
}