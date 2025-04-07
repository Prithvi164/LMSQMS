import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';

export default function EvaluationFeedbackPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('pending');
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch feedback items
  const { data: feedbackItems = [], isLoading } = useQuery({
    queryKey: ['/api/evaluation-feedback'],
    queryFn: () => apiRequest('/api/evaluation-feedback'),
  });

  // Update feedback mutation
  const updateFeedbackMutation = useMutation({
    mutationFn: async (data: { 
      feedbackId: number; 
      status: 'accepted' | 'rejected';
      agentResponse?: string;
      reportingHeadResponse?: string;
      rejectionReason?: string;
    }) => {
      return apiRequest(`/api/evaluation-feedback/${data.feedbackId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/evaluation-feedback'] });
      setIsDialogOpen(false);
      toast({
        title: 'Feedback updated',
        description: 'The evaluation feedback has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update feedback: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  // Handle accept feedback
  const handleAccept = (feedback: any) => {
    updateFeedbackMutation.mutate({
      feedbackId: feedback.id,
      status: 'accepted',
    });
  };

  // Handle reject feedback dialog
  const openRejectDialog = (feedback: any) => {
    setSelectedFeedback(feedback);
    setRejectionReason('');
    setIsDialogOpen(true);
  };

  // Handle submit rejection
  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Rejection reason is required',
        variant: 'destructive'
      });
      return;
    }

    updateFeedbackMutation.mutate({
      feedbackId: selectedFeedback.id,
      status: 'rejected',
      rejectionReason: rejectionReason
    });
  };

  // Filter feedback items based on the active tab
  const filteredFeedback = feedbackItems.filter((item: any) => {
    if (activeTab === 'pending') return item.status === 'pending';
    if (activeTab === 'accepted') return item.status === 'accepted';
    if (activeTab === 'rejected') return item.status === 'rejected';
    return true;
  });

  // Format date to readable format
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Get status badge based on status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-300">Pending</Badge>;
      case 'accepted':
        return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-300">Accepted</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-300">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Evaluation Feedback</h1>
      
      <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="accepted">Accepted</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="space-y-4">
          {filteredFeedback.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              No {activeTab} feedback items found
            </div>
          ) : (
            filteredFeedback.map((feedback: any) => (
              <Card key={feedback.id} className="mb-4">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Evaluation #{feedback.evaluation.id}</CardTitle>
                      <CardDescription>
                        Evaluated: {formatDate(feedback.evaluation.createdAt)}
                      </CardDescription>
                    </div>
                    {getStatusBadge(feedback.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Final Score</h4>
                      <p className="text-xl font-bold">
                        {feedback.evaluation.finalScore}%
                      </p>
                    </div>
                    
                    {feedback.rejectionReason && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-red-600">Rejection Reason</h4>
                        <p className="text-sm border p-2 rounded bg-red-50 border-red-200">
                          {feedback.rejectionReason}
                        </p>
                      </div>
                    )}
                    
                    {feedback.agentResponse && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Agent Response</h4>
                        <p className="text-sm border p-2 rounded">
                          {feedback.agentResponse}
                        </p>
                      </div>
                    )}
                    
                    {feedback.reportingHeadResponse && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Reporting Head Response</h4>
                        <p className="text-sm border p-2 rounded">
                          {feedback.reportingHeadResponse}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
                
                {feedback.status === 'pending' && (
                  <CardFooter className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => openRejectDialog(feedback)}
                    >
                      Reject
                    </Button>
                    <Button onClick={() => handleAccept(feedback)}>
                      Accept
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
      
      {/* Rejection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Evaluation</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this evaluation. This will be visible to the agent and other stakeholders.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="rejection-reason" className="mb-2 block">
              Rejection Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter the reason for rejection..."
              className="min-h-[100px]"
            />
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={updateFeedbackMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={updateFeedbackMutation.isPending || !rejectionReason.trim()}
            >
              {updateFeedbackMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Rejection'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}