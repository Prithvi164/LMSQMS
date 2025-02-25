import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function BatchDetail() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Batch Details</h2>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add New Batch
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Current Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Batch list will be implemented here */}
          <p className="text-muted-foreground">No batches found. Create a new batch to get started.</p>
        </CardContent>
      </Card>
    </div>
  );
}
