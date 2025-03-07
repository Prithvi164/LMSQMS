import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Bell, Users, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addHours, addMinutes } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

// Type for batch data
type Batch = {
  id: number;
  name: string;
  startDate: string;
  status: string;
  location: {
    name: string;
  };
  process: {
    name: string;
  };
  line_of_business: {
    name: string;
  };
};

export default function TraineeManagement() {
  const [selectedTab, setSelectedTab] = useState("all-batches");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Fetch all batches
  const {
    data: batches = [],
    isLoading,
    error
  } = useQuery<Batch[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });

  // Mutation for starting a batch
  const startBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      const response = await fetch(`/api/batches/${batchId}/start`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start batch');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/batches`] });
      toast({
        title: "Batch Started",
        description: "The batch has been successfully started and moved to induction phase.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error Starting Batch",
        description: error.message,
      });
    },
  });

  // Helper function to format date in IST
  const formatToIST = (dateStr: string) => {
    const date = new Date(dateStr);
    const dateIST = addMinutes(addHours(date, 5), 30);
    return format(dateIST, "PPP");
  };

  // Group batches by status
  const batchesByStatus = batches.reduce((acc, batch) => {
    if (!acc[batch.status]) {
      acc[batch.status] = [];
    }
    acc[batch.status].push(batch);
    return acc;
  }, {} as Record<string, Batch[]>);

  const plannedBatches = batchesByStatus['planned'] || [];
  const inductionBatches = batchesByStatus['induction'] || [];
  const trainingBatches = batchesByStatus['training'] || [];
  const certificationBatches = batchesByStatus['certification'] || [];
  const ojtBatches = batchesByStatus['ojt'] || [];
  const completedBatches = batchesByStatus['completed'] || [];

  const handleBatchClick = (batchId: number) => {
    navigate(`/batch-monitoring/${batchId}`);
  };

  const renderBatchCard = (batch: Batch) => (
    <Card
      key={batch.id}
      className="cursor-pointer hover:ring-2 hover:ring-primary transition-all"
      onClick={() => handleBatchClick(batch.id)}
    >
      <CardContent className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg">{batch.name}</h3>
            <p className="text-sm text-muted-foreground">
              {batch.location.name} • {batch.process.name}
            </p>
          </div>
          <Badge
            variant={batch.status === 'planned' ? "outline" : "secondary"}
            className="capitalize"
          >
            {batch.status}
          </Badge>
        </div>

        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-medium">Start Date:</span>{" "}
            {formatToIST(batch.startDate)}
          </p>
          <p className="text-sm">
            <span className="font-medium">LOB:</span>{" "}
            {batch.line_of_business.name}
          </p>
        </div>

        {batch.status === 'planned' && (
          <Button
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              startBatchMutation.mutate(batch.id);
            }}
            disabled={startBatchMutation.isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {startBatchMutation.isPending ? "Starting..." : "Start Batch"}
          </Button>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading batches...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading batches. Please refresh the page to try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Trainee Management</h1>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="all-batches" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Batches
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all-batches">
          <div className="space-y-6">
            {plannedBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Planned Batches</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {plannedBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {inductionBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Induction Phase</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inductionBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {trainingBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Training Phase</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {trainingBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {certificationBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Certification Phase</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {certificationBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {ojtBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">OJT Phase</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ojtBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {completedBatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Completed Batches</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {completedBatches.map(renderBatchCard)}
                </div>
              </div>
            )}

            {batches.length === 0 && (
              <Alert>
                <AlertDescription>
                  No batches found. Create a new batch to get started.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <Alert>
            <AlertDescription>
              Notifications about batch progress and important updates will appear here.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}