import { useState, useEffect, useCallback, useRef } from 'react';

// WebSocket connection states
export type WebSocketStatus = 'connecting' | 'open' | 'closing' | 'closed' | 'error';

/**
 * Hook for managing WebSocket connections to handle session transfers
 */
export function useWebSocket(userId?: number, sessionId?: string) {
  const [status, setStatus] = useState<WebSocketStatus>('closed');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<any[]>([]);

  // Create a WebSocket connection
  const connect = useCallback((): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      // Don't attempt to connect if userId is not available
      if (!userId) {
        console.log('Not connecting WebSocket - userId not available');
        setStatus('closed');
        resolve(false);
        return;
      }

    // Close any existing connection
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      try {
        socketRef.current.close();
      } catch (error) {
        console.error('Error closing existing WebSocket:', error);
      }
    }
    
    // Clear any existing heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    try {
      // Determine if we're using HTTP or HTTPS
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      
      // Connect to our WebSocket server with userId and sessionId as query parameters
      let wsUrl = `${protocol}//${host}/ws/sessions?userId=${userId}`;
      if (sessionId) {
        wsUrl += `&sessionId=${sessionId}`;
      }
      
      console.log('Connecting to WebSocket:', wsUrl);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      setStatus('connecting');

      socket.onopen = () => {
        setStatus('open');
        console.log('WebSocket connection established');
        
        // Register the session immediately when the connection opens
        if (userId && sessionId) {
          socket.send(JSON.stringify({
            type: 'register',
            userId,
            sessionId
          }));
          console.log('Registered session:', { userId, sessionId });
        }
        
        // Send any queued messages
        while (messageQueueRef.current.length > 0) {
          const queuedMessage = messageQueueRef.current.shift();
          if (queuedMessage) {
            socket.send(JSON.stringify(queuedMessage));
            console.log('Sent queued message:', queuedMessage);
          }
        }
        
        // Set up heartbeat to keep the connection alive
        heartbeatIntervalRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'heartbeat' }));
          }
        }, 30000); // Send heartbeat every 30 seconds
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          setLastMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      socket.onclose = (event) => {
        setStatus('closed');
        console.log('WebSocket connection closed:', event.code, event.reason);
        
        // Clear heartbeat interval
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        
        // Attempt to reconnect after a delay unless this was a clean close
        if (event.code !== 1000) {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            connect().catch(error => {
              console.error('Error during reconnection attempt:', error);
            });
          }, 5000); // Try to reconnect after 5 seconds
        }
      };

      socket.onerror = (error) => {
        setStatus('error');
        console.error('WebSocket error:', error);
        reject(error);
      };
    } catch (error) {
      setStatus('error');
      console.error('Error creating WebSocket connection:', error);
      reject(error);
    }
    });
  }, [userId, sessionId]);

  /**
   * Send a WebSocket message
   * If the connection is not open, queue the message for when it reconnects
   */
  const sendMessage = useCallback((message: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      console.log('Sent WebSocket message:', message);
      return true;
    } else {
      console.warn('WebSocket not ready, queueing message:', message);
      messageQueueRef.current.push(message);
      
      // If socket is closed or in error state, try to reconnect
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED || socketRef.current.readyState === WebSocket.CLOSING) {
        connect().catch(error => {
          console.error('Error reconnecting WebSocket:', error);
        });
      }
      return false;
    }
  }, [connect]);

  // Function to send specific session messages
  const sendSessionApproval = useCallback((approvalSessionId: string) => {
    if (!userId) return false;
    
    return sendMessage({
      type: 'session_approval',
      sessionId: approvalSessionId,
      userId
    });
  }, [userId, sendMessage]);
  
  const sendSessionDenial = useCallback((denialSessionId: string) => {
    if (!userId) return false;
    
    return sendMessage({
      type: 'session_denial',
      sessionId: denialSessionId,
      userId
    });
  }, [userId, sendMessage]);
  
  const sendSessionRequest = useCallback((deviceInfo?: string, ipAddress?: string, userAgent?: string) => {
    if (!userId || !sessionId) return false;
    
    return sendMessage({
      type: 'session_request',
      sessionId,
      userId,
      deviceInfo,
      ipAddress,
      userAgent
    });
  }, [userId, sessionId, sendMessage]);

  // Initialize the connection when the component mounts or when userId/sessionId changes
  useEffect(() => {
    // Only try to connect if we have userId
    if (userId) {
      connect().catch(error => {
        console.error('Error initializing WebSocket connection:', error);
      });
    } else {
      console.log('Not connecting WebSocket - userId not available');
    }
    
    // Clean up when unmounting
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  return {
    status,
    lastMessage,
    sendMessage,
    sendSessionApproval,
    sendSessionDenial,
    sendSessionRequest,
    connect
  };
}