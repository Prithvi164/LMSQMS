import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function BatchDetail() {
  const [batches] = useState([
    // Placeholder data - will be replaced with actual data from API
    {
      id: 1,
      name: "Batch 2024-Q1",
      status: "ongoing",
      trainer: "John Doe",
      startDate: "2024-01-01",
      endDate: "2024-03-31",
      participants: 25,
    },
  ]);

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
          {batches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>{batch.name}</TableCell>
                    <TableCell className="capitalize">{batch.status}</TableCell>
                    <TableCell>{batch.trainer}</TableCell>
                    <TableCell>{batch.startDate}</TableCell>
                    <TableCell>{batch.endDate}</TableCell>
                    <TableCell>{batch.participants}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No batches found. Create a new batch to get started.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}