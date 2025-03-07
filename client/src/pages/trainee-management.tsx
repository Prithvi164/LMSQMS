import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Bell, Users, CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addHours, addMinutes } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

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
  const [selectedTab, setSelectedTab] = useState("active-batches");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch batches using the organization-specific endpoint
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

  // Helper function to convert UTC to IST and compare dates
  const isSameDay = (date1: string, date2: Date) => {
    const d1 = new Date(date1);
    // Convert to IST by adding 5 hours and 30 minutes
    const d1IST = addMinutes(addHours(d1, 5), 30);
    const d2IST = addMinutes(addHours(date2, 5), 30);

    return (
      d1IST.getDate() === d2IST.getDate() &&
      d1IST.getMonth() === d2IST.getMonth() &&
      d1IST.getFullYear() === d2IST.getFullYear()
    );
  };

  // Helper function to format date in IST
  const formatToIST = (dateStr: string) => {
    const date = new Date(dateStr);
    const dateIST = addMinutes(addHours(date, 5), 30);
    return format(dateIST, "PPP");
  };

  // Get all planned batches, sorted by start date
  const plannedBatches = batches
    .filter(batch => batch.status === 'planned')
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  // Filter batches starting today
  const todayBatches = plannedBatches.filter(batch => isSameDay(batch.startDate, new Date()));

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
          <TabsTrigger value="active-batches" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Active Batches
            {todayBatches.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {todayBatches.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active-batches">
          {plannedBatches.length > 0 ? (
            <div className="space-y-6">
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTitle className="text-yellow-800 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Planned Batches
                </AlertTitle>
                <AlertDescription className="text-yellow-700">
                  {todayBatches.length > 0
                    ? `You have ${todayBatches.length} batch(es) that need to be started today.`
                    : 'All scheduled batches are progressing as planned.'}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plannedBatches.map((batch) => (
                  <Card key={batch.id}>
                    <CardContent className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{batch.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {batch.location.name} • {batch.process.name}
                          </p>
                        </div>
                        <Badge
                          variant={isSameDay(batch.startDate, new Date()) ? "destructive" : "outline"}
                          className="capitalize"
                        >
                          {isSameDay(batch.startDate, new Date()) ? "Start Today" : batch.status}
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

                      <Button
                        className="w-full"
                        onClick={() => startBatchMutation.mutate(batch.id)}
                        disabled={startBatchMutation.isPending || !isSameDay(batch.startDate, new Date())}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {startBatchMutation.isPending
                          ? "Starting..."
                          : isSameDay(batch.startDate, new Date())
                            ? "Start Batch"
                            : "Starts " + formatToIST(batch.startDate)
                        }
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                No batches require immediate attention. All scheduled batches are progressing as planned.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="attendance">
          <Alert>
            <AlertDescription>
              Attendance tracking functionality will be implemented here.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="notifications">
          <Alert>
            <AlertDescription>
              Notifications about batch starts and attendance will appear here.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}