import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, XCircle, CheckCircle, Clock } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";

type DeactivationRequest = {
  id: number;
  userId: number;
  batchId: number;
  requesterId: number;
  managerId: number;
  organizationId: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string;
  approverComments?: string | null;
  user?: {
    fullName: string;
    email: string;
    employeeId: string;
  };
  batch?: {
    name: string;
  };
  requester?: {
    fullName: string;
  };
};

interface DeactivationRequestsListProps {
  organizationId: number;
}

export function DeactivationRequestsList({ organizationId }: DeactivationRequestsListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<DeactivationRequest | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [comments, setComments] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  // Fetch deactivation requests
  const { data: deactivationRequests = [], isLoading, error } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/trainee-deactivation-requests`],
    enabled: !!organizationId,
  });

  // Format date helper
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PP') : 'N/A';
  };

  // Filter requests by status
  const filteredRequests = deactivationRequests.filter(
    (request: DeactivationRequest) => {
      if (activeTab === "pending") return request.status === "pending";
      if (activeTab === "approved") return request.status === "approved";
      if (activeTab === "rejected") return request.status === "rejected";
      return true;
    }
  );

  // Update request status mutation
  const updateRequestMutation = useMutation({
    mutationFn: async ({
      requestId,
      status,
      comments,
    }: {
      requestId: number;
      status: "approved" | "rejected";
      comments: string;
    }) => {
      const response = await fetch(
        `/api/organizations/${organizationId}/trainee-deactivation-requests/${requestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, managerComments: comments }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update request status");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate requests query to refresh data
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/trainee-deactivation-requests`]
      });

      // Also invalidate trainees to reflect status changes
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/batches`]
      });

      // Close dialogs and reset state
      setIsApproveDialogOpen(false);
      setIsRejectDialogOpen(false);
      setSelectedRequest(null);
      setComments("");

      toast({
        title: "Success",
        description: "Request status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'pending') {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
        <Clock className="w-3 h-3 mr-1" /> Pending
      </Badge>;
    } else if (status === 'approved') {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" /> Approved
      </Badge>;
    } else {
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
        <XCircle className="w-3 h-3 mr-1" /> Rejected
      </Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading deactivation requests...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Error loading deactivation requests. Please try again.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trainee Deactivation Requests</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {filteredRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No {activeTab} deactivation requests found.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainee</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Request Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request: DeactivationRequest) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{request.user?.fullName}</p>
                            <p className="text-xs text-muted-foreground">{request.user?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{request.batch?.name}</TableCell>
                        <TableCell>{request.requester?.fullName}</TableCell>
                        <TableCell>{formatDate(request.requestDate)}</TableCell>
                        <TableCell>
                          <StatusBadge status={request.status} />
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                        <TableCell>
                          {request.status === "pending" && (
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setIsApproveDialogOpen(true);
                                }}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" /> Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setIsRejectDialogOpen(true);
                                }}
                              >
                                <XCircle className="w-4 h-4 mr-1" /> Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Approve Dialog */}
        <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Deactivation Request</DialogTitle>
              <DialogDescription>
                You are about to approve the deactivation request for{" "}
                <span className="font-medium">{selectedRequest?.user?.fullName}</span>.
                This will mark the trainee as inactive in the system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="approve-comments">Additional Comments (Optional)</Label>
                <Textarea
                  id="approve-comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Enter any additional comments..."
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsApproveDialogOpen(false);
                  setComments("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                disabled={updateRequestMutation.isPending}
                onClick={() => {
                  if (selectedRequest) {
                    updateRequestMutation.mutate({
                      requestId: selectedRequest.id,
                      status: "approved",
                      comments: comments,
                    });
                  }
                }}
              >
                {updateRequestMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing
                  </>
                ) : (
                  "Approve"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Deactivation Request</DialogTitle>
              <DialogDescription>
                You are about to reject the deactivation request for{" "}
                <span className="font-medium">{selectedRequest?.user?.fullName}</span>.
                Please provide a reason for this rejection.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reject-comments">Reason for Rejection</Label>
                <Textarea
                  id="reject-comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Enter the reason for rejecting this request..."
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsRejectDialogOpen(false);
                  setComments("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={updateRequestMutation.isPending || !comments.trim()}
                onClick={() => {
                  if (selectedRequest && comments.trim()) {
                    updateRequestMutation.mutate({
                      requestId: selectedRequest.id,
                      status: "rejected",
                      comments: comments,
                    });
                  }
                }}
              >
                {updateRequestMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing
                  </>
                ) : (
                  "Reject"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}