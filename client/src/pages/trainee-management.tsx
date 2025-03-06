import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Bell, Users, CalendarDays, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

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

  // Fetch active batches that require attention (planned status and start date is today)
  const { data: activeBatches = [], isLoading: batchesLoading } = useQuery<Batch[]>({
    queryKey: ["/api/batches/active"],
  });

  // Filter batches that need to be started today
  const pendingStartBatches = activeBatches.filter(batch => {
    const batchStartDate = new Date(batch.startDate);
    const today = new Date();
    return (
      batch.status === 'planned' &&
      batchStartDate.getDate() === today.getDate() &&
      batchStartDate.getMonth() === today.getMonth() &&
      batchStartDate.getFullYear() === today.getFullYear()
    );
  });

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
            {pendingStartBatches.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingStartBatches.length}
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
          {batchesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-3/4 mb-4" />
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : pendingStartBatches.length > 0 ? (
            <div className="space-y-6">
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTitle className="text-yellow-800 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Batches Requiring Attention
                </AlertTitle>
                <AlertDescription className="text-yellow-700">
                  The following batches are scheduled to start today and need to be initiated.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingStartBatches.map((batch) => (
                  <Card key={batch.id}>
                    <CardContent className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{batch.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {batch.location.name} • {batch.process.name}
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {batch.status}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm">
                          <span className="font-medium">Start Date:</span>{" "}
                          {format(new Date(batch.startDate), "PP")}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">LOB:</span>{" "}
                          {batch.line_of_business.name}
                        </p>
                      </div>

                      <Button 
                        className="w-full"
                        onClick={() => {
                          // Start batch functionality will be implemented here
                          console.log("Starting batch:", batch.id);
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Start Batch
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