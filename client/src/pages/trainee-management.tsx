import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function TraineeManagement() {
  const [selectedTab, setSelectedTab] = useState("active-batches");

  const { data: activeBatches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ["/api/batches/active"],
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
          ) : activeBatches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Active batches will be displayed here */}
              <Card>
                <CardContent className="p-6">
                  <p>Active batches content will be implemented next</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                No active batches found. Active batches will appear here when trainers start them.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="notifications">
          <Alert>
            <AlertDescription>
              Notifications about pending batch starts and attendance will appear here.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}
