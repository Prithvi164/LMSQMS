import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useWebSocket } from '@/hooks/use-websocket';
import { SessionTransferModal } from './session-transfer-modal';
import { useQuery } from '@tanstack/react-query';

/**
 * This component manages session transfer requests globally in the application.
 * It listens for WebSocket messages about new login attempts and displays
 * approval/denial UI when needed.
 * 
 * If WebSockets are not working, it falls back to polling API endpoints.
 */
export function SessionTransferManager() {
  const { user } = useAuth();
  const [pendingTransfer, setPendingTransfer] = useState<{
    sessionId: string;
    deviceInfo: string;
  } | null>(null);
  
  // Get session ID from session storage
  const getCurrentSessionId = useCallback(() => {
    return typeof window !== 'undefined' 
      ? window.sessionStorage.getItem('sessionId') || undefined 
      : undefined;
  }, []);
  
  // Connect to WebSocket for session transfers with current session info
  const { lastMessage, status: wsStatus } = useWebSocket(
    user?.id, 
    getCurrentSessionId()
  );
  
  // Log WebSocket status changes for debugging
  useEffect(() => {
    console.log(`WebSocket status changed to: ${wsStatus}`, { 
      userId: user?.id, 
      sessionId: getCurrentSessionId()
    });
  }, [wsStatus, user?.id, getCurrentSessionId]);

  // REST fallback - poll for pending sessions if WebSocket is closed or failed
  const shouldPoll = wsStatus === 'closed' || wsStatus === 'error';
  
  // Poll for pending sessions every 10 seconds if WebSocket is not working
  const { data: pendingSessions } = useQuery({
    queryKey: ['/api/user/pending-sessions'],
    queryFn: async () => {
      if (!user?.id || !shouldPoll) return { sessions: [] };
      console.log('Polling for pending sessions as WebSocket fallback');
      
      try {
        const res = await fetch('/api/user/pending-sessions', {
          credentials: 'include'
        });
        
        if (!res.ok) {
          throw new Error('Failed to fetch pending sessions');
        }
        
        return await res.json();
      } catch (error) {
        console.error('Error polling for pending sessions:', error);
        return { sessions: [] };
      }
    },
    refetchInterval: shouldPoll ? 10000 : false, // Only poll if WebSocket is down
    enabled: !!user?.id && shouldPoll,
  });
  
  // Process pending sessions from REST polling
  useEffect(() => {
    if (pendingSessions?.sessions?.length > 0 && !pendingTransfer) {
      console.log('Pending session found via API polling:', pendingSessions.sessions[0]);
      
      // Use the most recent pending session
      const latestSession = pendingSessions.sessions[0];
      
      // Format device info nicely
      const deviceInfo = [
        `Device: ${latestSession.device || 'Unknown Device'}`,
        `Time: ${new Date(latestSession.loginAt).toLocaleString()}`
      ].join('\n');
      
      // Set the pending transfer to show the approval modal
      setPendingTransfer({
        sessionId: latestSession.sessionId,
        deviceInfo
      });
      
      // Play a notification sound if possible
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(err => console.log('Could not play notification sound:', err));
      } catch (e) {
        console.log('Audio notification not supported');
      }
    }
  }, [pendingSessions, pendingTransfer]);

  // Listen for session request messages via WebSocket
  useEffect(() => {
    console.log('Last message received:', lastMessage);
    
    if (lastMessage && lastMessage.type === 'session_request') {
      console.log('Session transfer request received via WebSocket:', lastMessage);
      
      // Format device info nicely
      const deviceInfo = [
        `Device: ${lastMessage.deviceInfo || 'Unknown Device'}`,
        `IP: ${lastMessage.ipAddress || 'Unknown IP'}`,
        `Browser: ${lastMessage.userAgent || 'Unknown Browser'}`,
        `Time: ${new Date().toLocaleString()}`
      ].join('\n');
      
      // Always display the modal with audio notification
      try {
        // Play a notification sound if possible
        const audio = new Audio('/notification.mp3');
        audio.play().catch(err => console.log('Could not play notification sound:', err));
      } catch (e) {
        console.log('Audio notification not supported');
      }
      
      // Set the pending transfer which will show the approval modal
      setPendingTransfer({
        sessionId: lastMessage.sessionId,
        deviceInfo
      });
    } else if (lastMessage && lastMessage.type === 'session_expired') {
      // Handle session expiration (when another device is approved)
      console.log('Session expired notification received');
      window.location.href = '/login?expired=true';
    }
  }, [lastMessage]);
  
  // Periodically check if the current session is still valid
  useEffect(() => {
    // Only run this if user is logged in
    if (!user?.id) return;
    
    const sessionCheckInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/user/session-check', {
          credentials: 'include'
        });
        
        if (res.status === 401 || res.status === 403) {
          // Session is no longer valid
          console.log('Session check failed, redirecting to login');
          window.location.href = '/login?expired=true';
        }
      } catch (error) {
        console.error('Error checking session status:', error);
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(sessionCheckInterval);
  }, [user?.id]);
  
  const handleClose = () => {
    setPendingTransfer(null);
  };
  
  const handleApprove = () => {
    // The actual approval is handled in the SessionTransferModal component
    setTimeout(() => {
      setPendingTransfer(null);
    }, 2000);
  };
  
  const handleDeny = () => {
    // The actual denial is handled in the SessionTransferModal component
    setTimeout(() => {
      setPendingTransfer(null);
    }, 2000);
  };
  
  // Only render the modal if user is logged in and there's a pending transfer
  if (!user || !pendingTransfer) {
    return null;
  }
  
  return (
    <SessionTransferModal
      sessionId={pendingTransfer.sessionId}
      deviceInfo={pendingTransfer.deviceInfo}
      isOpen={!!pendingTransfer}
      onApprove={handleApprove}
      onDeny={handleDeny}
      onClose={handleClose}
    />
  );
}