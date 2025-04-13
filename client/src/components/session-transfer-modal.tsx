import React, { useState, useEffect } from 'react';
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SessionTransferModalProps {
  sessionId: string;
  deviceInfo: string;
  isOpen: boolean;
  onApprove: () => void;
  onDeny: () => void;
  onClose: () => void;
}

export function SessionTransferModal({
  sessionId,
  deviceInfo,
  isOpen,
  onApprove,
  onDeny,
  onClose
}: SessionTransferModalProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'approved' | 'denied'>('idle');
  const { toast } = useToast();

  const handleApprove = async () => {
    try {
      setStatus('loading');
      await apiRequest("POST", `/api/session/${sessionId}/approve`);
      setStatus('approved');
      toast({
        title: "Session transfer approved",
        description: "The new device has been granted access to your account.",
        variant: "default",
      });
      setTimeout(() => {
        onApprove();
      }, 2000);
    } catch (error) {
      console.error('Failed to approve session:', error);
      toast({
        title: "Failed to approve session",
        description: "An error occurred while approving the session transfer.",
        variant: "destructive",
      });
      setStatus('idle');
    }
  };

  const handleDeny = async () => {
    try {
      setStatus('loading');
      await apiRequest("POST", `/api/session/${sessionId}/deny`);
      setStatus('denied');
      toast({
        title: "Session transfer denied",
        description: "The new device has been denied access to your account.",
        variant: "default",
      });
      setTimeout(() => {
        onDeny();
      }, 2000);
    } catch (error) {
      console.error('Failed to deny session:', error);
      toast({
        title: "Failed to deny session",
        description: "An error occurred while denying the session transfer.",
        variant: "destructive",
      });
      setStatus('idle');
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Session Transfer Request
          </AlertDialogTitle>
          <AlertDialogDescription>
            Someone is trying to log in to your account from another device.
            <div className="mt-2 p-3 bg-muted rounded-md">
              <p className="font-medium">Device Information:</p>
              <p className="text-sm opacity-90">{deviceInfo}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {status === 'approved' && (
          <div className="flex flex-col items-center justify-center py-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-2" />
            <p className="text-center font-medium">Session transfer approved!</p>
            <p className="text-center text-sm text-muted-foreground">
              This session will be terminated and you'll be logged out.
            </p>
          </div>
        )}
        
        {status === 'denied' && (
          <div className="flex flex-col items-center justify-center py-4">
            <XCircle className="h-16 w-16 text-red-500 mb-2" />
            <p className="text-center font-medium">Session transfer denied!</p>
            <p className="text-center text-sm text-muted-foreground">
              The login attempt has been blocked.
            </p>
          </div>
        )}
        
        {status !== 'approved' && status !== 'denied' && (
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel disabled={status === 'loading'}>Close</AlertDialogCancel>
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={handleDeny}
                disabled={status === 'loading'}
              >
                {status === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Deny Access
              </Button>
              <Button 
                variant="default" 
                onClick={handleApprove}
                disabled={status === 'loading'}
              >
                {status === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Approve Transfer
              </Button>
            </div>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface SessionPendingApprovalProps {
  sessionId: string;
}

export function SessionPendingApproval({ sessionId }: SessionPendingApprovalProps) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'denied' | 'error'>('pending');
  const { toast } = useToast();

  useEffect(() => {
    const checkSessionStatus = async () => {
      try {
        const response = await apiRequest("GET", `/api/session/${sessionId}/status`);
        const data = await response.json();
        
        if (data.status === 'approved') {
          setStatus('approved');
          toast({
            title: "Session Approved",
            description: "Your session has been approved. You will be redirected to login.",
            variant: "default",
          });
          // Redirect to login after a brief delay
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        } else if (data.status === 'denied') {
          setStatus('denied');
          toast({
            title: "Session Denied",
            description: "Your session access has been denied.",
            variant: "destructive",
          });
        } else if (data.status !== 'pending_approval') {
          setStatus('error');
          toast({
            title: "Session Error",
            description: "There was an issue with your session. Please try logging in again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Failed to check session status:', error);
        setStatus('error');
      }
    };

    // Check immediately on component mount
    checkSessionStatus();
    
    // Then set up interval for periodic checks
    const interval = setInterval(checkSessionStatus, 2000);
    return () => clearInterval(interval);
  }, [sessionId, toast]);

  return (
    <div className="flex flex-col items-center justify-center p-6 max-w-md mx-auto">
      <div className="w-full space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <ShieldAlert className="h-12 w-12 text-amber-500" />
          <h1 className="text-2xl font-bold tracking-tight">Waiting for Approval</h1>
          <p className="text-sm text-muted-foreground">
            This account is already logged in on another device. Waiting for approval from the existing session.
          </p>
        </div>

        <div className="bg-muted p-4 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Session Status:</span>
            <Badge variant={
              status === 'pending' ? 'outline' : 
              status === 'approved' ? 'default' :
              'destructive'
            }>
              {status === 'pending' ? 'Pending Approval' : 
              status === 'approved' ? 'Approved' :
              status === 'denied' ? 'Denied' : 'Error'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {status === 'pending' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Waiting for the existing session to approve or deny this login...</span>
              </>
            )}
            {status === 'approved' && (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Session approved! Redirecting to login...</span>
              </>
            )}
            {status === 'denied' && (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span>Session denied. Please try logging in again or contact support.</span>
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span>Error checking session status. Please try logging in again.</span>
              </>
            )}
          </div>
        </div>

        {(status === 'denied' || status === 'error') && (
          <Button 
            variant="default" 
            className="w-full"
            onClick={() => window.location.href = '/login'}
          >
            Back to Login
          </Button>
        )}
      </div>
    </div>
  );
}