import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatIST } from "../../../../server/utils/timezone";

export function BatchDetailsPage() {
  const [selectedTab, setSelectedTab] = useState("attendance");
  const { batchId } = useParams();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch batch details
  const { data: batch, isLoading, error } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}`],
    enabled: !!user?.organizationId && !!batchId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading batch details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading batch details. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!batch) {
    return (
      <Alert>
        <AlertDescription>Batch not found.</AlertDescription>
      </Alert>
    );
  }

  if (batch.status === 'planned') {
    return (
      <Alert>
        <AlertDescription>
          Detailed tracking is only available after the batch has started.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Batch Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{batch.name}</h1>
          <p className="text-muted-foreground">
            {batch.location.name} • {batch.process.name}
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">
          {batch.status}
        </Badge>
      </div>

      {/* Batch Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Overall Progress</span>
              <span>{batch.progress || 0}%</span>
            </div>
            <Progress value={batch.progress || 0} />
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="training-plan">Training Planner</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Daily Attendance</h2>
              {/* Attendance tracking interface will be implemented here */}
              <Alert>
                <AlertDescription>
                  Attendance tracking interface will be implemented here.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training-plan" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Training Schedule</h2>
              {/* Training planner interface will be implemented here */}
              <Alert>
                <AlertDescription>
                  Training planner interface will be implemented here.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
