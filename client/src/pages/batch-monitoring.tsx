import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

export function BatchMonitoringPage() {
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const { user } = useAuth();

  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ['/api/organizations', user?.organizationId, 'batches'],
    select: (data) => data || [],
    enabled: !!user?.organizationId // Only run query if organizationId exists
  });

  const { data: batchTrainees, isLoading: traineesLoading } = useQuery({
    queryKey: ['/api/organizations', user?.organizationId, 'batches', selectedBatchId, 'trainees'],
    enabled: !!selectedBatchId && !!user?.organizationId,
    select: (data) => data || []
  });

  const renderPhaseProgress = (batch: any) => {
    const phases = ['planned', 'induction', 'training', 'certification', 'ojt', 'ojt_certification'];
    const currentPhaseIndex = phases.indexOf(batch.status);
    const progress = ((currentPhaseIndex + 1) / phases.length) * 100;

    return (
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm font-medium">Phase Progress</span>
          <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} />
      </div>
    );
  };

  if (!user || !user.organizationId) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">Please log in to view batch information.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Batch Monitoring</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Active Batches</CardTitle>
          </CardHeader>
          <CardContent>
            {batchesLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !batches?.length ? (
              <p className="text-center text-muted-foreground">No active batches found.</p>
            ) : (
              <div className="space-y-4">
                {batches.map((batch: any) => (
                  <div 
                    key={batch.id} 
                    className={`p-4 border rounded-lg cursor-pointer hover:bg-accent ${
                      selectedBatchId === batch.id ? 'bg-accent' : ''
                    }`}
                    onClick={() => setSelectedBatchId(batch.id)}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium">{batch.name}</h3>
                      <Badge>{batch.status}</Badge>
                    </div>
                    {renderPhaseProgress(batch)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedBatchId && (
          <Card>
            <CardHeader>
              <CardTitle>Batch Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="trainees">
                <TabsList>
                  <TabsTrigger value="trainees">Trainees</TabsTrigger>
                  <TabsTrigger value="performance">Performance</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                </TabsList>

                <TabsContent value="trainees">
                  {traineesLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : !batchTrainees?.length ? (
                    <p className="text-center text-muted-foreground">No trainees found in this batch.</p>
                  ) : (
                    <div className="space-y-4">
                      {batchTrainees.map((trainee: any) => (
                        <div key={trainee.id} className="p-4 border rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{trainee.user?.fullName}</span>
                            <Badge variant="outline">{trainee.status}</Badge>
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            {trainee.user?.employeeId}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="performance">
                  <div className="text-center py-8 text-muted-foreground">
                    Performance metrics will be available once the batch starts training.
                  </div>
                </TabsContent>

                <TabsContent value="attendance">
                  <div className="text-center py-8 text-muted-foreground">
                    Attendance tracking will be available during active training phases.
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default BatchMonitoringPage;