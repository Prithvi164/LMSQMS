import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchDetail } from "@/components/batch-management/batch-detail";
import { ProcessDetail } from "@/components/batch-management/process-detail";

export default function BatchManagement() {
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Batch Management</h1>

      <Tabs defaultValue="batch-detail" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="batch-detail">Batch Detail</TabsTrigger>
          <TabsTrigger value="process-detail">Process Detail</TabsTrigger>
        </TabsList>

        <TabsContent value="batch-detail" className="mt-6">
          <BatchDetail />
        </TabsContent>

        <TabsContent value="process-detail" className="mt-6">
          <ProcessDetail />
        </TabsContent>
      </Tabs>
    </div>
  );
}