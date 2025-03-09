import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type PhaseChangeRequest = {
  id: number;
  batch: {
    name: string;
  };
  trainer: {
    fullName: string;
  };
  status: string;
  currentPhase: string;
  requestedPhase: string;
  justification: string;
};

export function ManagerDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch pending phase change requests for the manager
  const { data: requests, isLoading } = useQuery<PhaseChangeRequest[]>({
    queryKey: [`/api/managers/${user?.id}/phase-change-requests`],
    enabled: !!user?.id && user?.role === 'manager'
  });

  const handleApprove = async (requestId: number) => {
    try {
      const response = await fetch(`/api/phase-change-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'approved',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve request');
      }

      toast({
        title: "Success",
        description: "Request approved successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve request",
      });
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      const response = await fetch(`/api/phase-change-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'rejected',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject request');
      }

      toast({
        title: "Success",
        description: "Request rejected successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reject request",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Manager Dashboard</h1>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-6">Pending Phase Change Requests</h2>

          {requests && requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request.id} className="p-4">
                  <div className="grid gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">
                          Batch: {request.batch?.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Requested by: {request.trainer?.fullName}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {request.status}
                      </Badge>
                    </div>

                    <div className="grid gap-2">
                      <div>
                        <span className="font-medium">Current Phase: </span>
                        {request.currentPhase}
                      </div>
                      <div>
                        <span className="font-medium">Requested Phase: </span>
                        {request.requestedPhase}
                      </div>
                      <div>
                        <span className="font-medium">Justification: </span>
                        {request.justification}
                      </div>
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => handleApprove(request.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleReject(request.id)}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                No pending phase change requests found.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="mt-8">
        <Link href="/batches">
          <Button variant="outline">View All Batches</Button>
        </Link>
      </div>
    </div>
  );
}