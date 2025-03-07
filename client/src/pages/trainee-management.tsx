import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Bell, Users, CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function TraineeManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("all-batches");

  const {
    data: batches = [],
    isLoading,
    error
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });

  // Helper function to get badge color based on status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned':
        return 'bg-blue-100 text-blue-800';
      case 'induction':
        return 'bg-yellow-100 text-yellow-800';
      case 'training':
        return 'bg-purple-100 text-purple-800';
      case 'certification':
        return 'bg-orange-100 text-orange-800';
      case 'ojt':
        return 'bg-green-100 text-green-800';
      case 'ojt_certification':
        return 'bg-pink-100 text-pink-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all-batches">
          {batches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {batches.map((batch: any) => (
                <Card key={batch.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{batch.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {batch.location?.name} • {batch.process?.name}
                        </p>
                      </div>
                      <Badge className={`capitalize ${getStatusColor(batch.status)}`}>
                        {batch.status}
                      </Badge>
                    </div>

                    <Button 
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        window.location.href = `/batch-management?batch=${batch.id}`;
                      }}
                    >
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                No batches found.
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