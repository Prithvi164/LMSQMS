import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
    {
      id: 1,
      name: "Batch 2024-Q1",
      status: "ongoing",
      trainer: "John Doe",
      startDate: "2024-01-01",
      endDate: "2024-03-31",
      participants: 25,
      lineOfBusiness: "Customer Support",
      location: "San Francisco"
    },
    {
      id: 2,
      name: "Batch 2024-Q2",
      status: "planned",
      trainer: "Jane Smith",
      startDate: "2024-04-01",
      endDate: "2024-06-30",
      participants: 30,
      lineOfBusiness: "Technical Support",
      location: "New York"
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ongoing':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'planned':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'completed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Batch Details</h2>
          <p className="text-muted-foreground">
            Manage and monitor your training batches
          </p>
        </div>
        <Button className="w-full md:w-auto" size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Create New Batch
        </Button>
      </div>

      {/* Search and Filter Section */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search batches..."
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Filter</Button>
              <Button variant="outline">Export</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch List Section */}
      <Card>
        <CardHeader>
          <CardTitle>Current Batches</CardTitle>
          <CardDescription>
            A comprehensive list of all training batches and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Batch Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Line of Business</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Participants</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getStatusColor(batch.status)}>
                          {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{batch.lineOfBusiness}</TableCell>
                      <TableCell>{batch.location}</TableCell>
                      <TableCell>{batch.trainer}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{batch.startDate}</div>
                          <div className="text-muted-foreground">to</div>
                          <div>{batch.endDate}</div>
                        </div>
                      </TableCell>
                      <TableCell>{batch.participants}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed p-8 text-center animate-in fade-in-50">
              <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                <h3 className="mt-4 text-lg font-semibold">No batches found</h3>
                <p className="mb-4 mt-2 text-sm text-muted-foreground">
                  You haven't created any batches yet. Start by creating a new batch.
                </p>
                <Button size="sm" className="relative">
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Batch
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}