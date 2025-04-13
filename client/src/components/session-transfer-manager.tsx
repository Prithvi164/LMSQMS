import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useWebSocket } from '@/hooks/use-websocket';
import { SessionTransferModal } from './session-transfer-modal';

/**
 * This component manages session transfer requests globally in the application.
 * It listens for WebSocket messages about new login attempts and displays
 * approval/denial UI when needed.
 */
export function SessionTransferManager() {
  const { user } = useAuth();
  const [pendingTransfer, setPendingTransfer] = useState<{
    sessionId: string;
    deviceInfo: string;
  } | null>(null);
  
  // Connect to WebSocket for session transfers with current session info
  const { lastMessage, status: wsStatus } = useWebSocket(
    user?.id, 
    typeof window !== 'undefined' ? window.sessionStorage.getItem('sessionId') || undefined : undefined
  );
  
  // Listen for session request messages
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'session_request') {
      console.log('Session transfer request received:', lastMessage);
      
      // Format device info nicely
      const deviceInfo = [
        `Device: ${lastMessage.deviceInfo || 'Unknown Device'}`,
        `IP: ${lastMessage.ipAddress || 'Unknown IP'}`,
        `Browser: ${lastMessage.userAgent || 'Unknown Browser'}`,
        `Time: ${new Date().toLocaleString()}`
      ].join('\n');
      
      // Set the pending transfer which will show the approval modal
      setPendingTransfer({
        sessionId: lastMessage.sessionId,
        deviceInfo
      });
    }
  }, [lastMessage]);
  
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