import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage';
import { userSessionStatusEnum } from '@shared/schema';

interface SessionMessage {
  type: 'session_request' | 'session_approval' | 'session_denial' | 'session_disconnected';
  sessionId: string;
  userId: number;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface WebSocketWithSession extends WebSocket {
  userId?: number;
  sessionId?: string;
}

// Map to store active connections by userId
const userConnections: Map<number, Map<string, WebSocketWithSession>> = new Map();

/**
 * Find a WebSocket connection by userId and sessionId
 */
function findConnectionBySessionId(userId: number, sessionId: string): WebSocketWithSession | undefined {
  const userSessions = userConnections.get(userId);
  if (userSessions) {
    return userSessions.get(sessionId);
  }
  return undefined;
}

/**
 * Remove a WebSocket connection when it's closed
 */
function removeConnection(userId: number | undefined, sessionId: string | undefined) {
  if (userId && sessionId && userConnections.has(userId)) {
    const userSessions = userConnections.get(userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        userConnections.delete(userId);
      }
    }
  }
}

export function setupWebSocketServer(server: Server) {
  // Use a specific path to prevent conflict with Vite's WebSocket
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/sessions'
  });

  wss.on('connection', (ws: WebSocketWithSession) => {
    console.log('WebSocket connection established');
    
    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'register') {
          // Register the connection with the user ID and session ID
          ws.userId = data.userId;
          ws.sessionId = data.sessionId;
          
          // Store the connection in the map
          if (!userConnections.has(data.userId)) {
            userConnections.set(data.userId, new Map());
          }
          userConnections.get(data.userId)?.set(data.sessionId, ws);
          
          console.log(`User ${data.userId} registered with session ${data.sessionId}`);
        } 
        else if (data.type === 'session_request') {
          // A new session is requesting approval from an existing session
          const existingSessions = userConnections.get(data.userId);
          console.log(`Processing session request for user ${data.userId} from session ${data.sessionId}`);
          
          // First, update the session status to pending approval
          await storage.updateUserSessionStatus(
            data.sessionId, 
            'pending_approval'
          );
          
          // Check if there are any active existing sessions
          if (existingSessions && existingSessions.size > 0) {
            console.log(`Found ${existingSessions.size} existing sessions for user ${data.userId}`);
            let activeSessions = 0;
            let connectionErrors = 0;
            
            // Send request to all existing sessions
            for (const [sessionId, connection] of existingSessions) {
              if (sessionId !== data.sessionId) {
                try {
                  if (connection.readyState === WebSocket.OPEN) {
                    console.log(`Sending session request to existing session ${sessionId}`);
                    activeSessions++;
                    
                    const requestMessage: SessionMessage = {
                      type: 'session_request',
                      sessionId: data.sessionId,
                      userId: data.userId,
                      deviceInfo: data.deviceInfo,
                      ipAddress: data.ipAddress,
                      userAgent: data.userAgent
                    };
                    
                    connection.send(JSON.stringify(requestMessage));
                  } else {
                    console.log(`Skipping session ${sessionId}: not open (readyState: ${connection.readyState})`);
                    connectionErrors++;
                    
                    // Remove dead connections
                    if (connection.readyState === WebSocket.CLOSED || connection.readyState === WebSocket.CLOSING) {
                      console.log(`Removing dead connection for session ${sessionId}`);
                      existingSessions.delete(sessionId);
                    }
                  }
                } catch (err) {
                  console.error(`Error sending to session ${sessionId}:`, err);
                  connectionErrors++;
                }
              } else {
                console.log(`Skipping session ${sessionId}: is the requesting session`);
              }
            }
            
            // If we couldn't notify any active sessions due to connection issues, auto-approve
            if (activeSessions === 0) {
              console.log(`No active sessions available for user ${data.userId}, approving automatically. Connection errors: ${connectionErrors}`);
              const approvalMessage: SessionMessage = {
                type: 'session_approval',
                sessionId: data.sessionId,
                userId: data.userId
              };
              
              ws.send(JSON.stringify(approvalMessage));
              
              // Update the session status to approved
              await storage.updateUserSessionStatus(
                data.sessionId, 
                'approved'
              );
              
              // Expire all other sessions
              for (const [otherSessionId, connection] of existingSessions) {
                if (otherSessionId !== data.sessionId) {
                  await storage.updateUserSessionStatus(otherSessionId, 'expired');
                  try {
                    if (connection.readyState === WebSocket.OPEN) {
                      connection.send(JSON.stringify({
                        type: 'session_expired',
                        message: 'Your session has been transferred to another device'
                      }));
                    }
                  } catch (e) {
                    console.error(`Error notifying expired session ${otherSessionId}:`, e);
                  }
                }
              }
            }
          } else {
            // No existing sessions, approve automatically
            console.log(`No existing sessions found for user ${data.userId}, approving automatically`);
            const approvalMessage: SessionMessage = {
              type: 'session_approval',
              sessionId: data.sessionId,
              userId: data.userId
            };
            
            ws.send(JSON.stringify(approvalMessage));
            
            // Update the session status to approved
            await storage.updateUserSessionStatus(
              data.sessionId, 
              'approved'
            );
          }
        } 
        else if (data.type === 'session_approval') {
          // An existing session approved a new session
          const newSessionConnection = findConnectionBySessionId(data.userId, data.sessionId);
          
          if (newSessionConnection) {
            const approvalMessage: SessionMessage = {
              type: 'session_approval',
              sessionId: data.sessionId,
              userId: data.userId
            };
            
            newSessionConnection.send(JSON.stringify(approvalMessage));
            
            // Close the current session
            if (ws.sessionId && ws.sessionId !== data.sessionId) {
              // Update the old session status to expired
              await storage.updateUserSessionStatus(
                ws.sessionId, 
                'expired'
              );
              
              // Close the current WebSocket connection
              const closeMessage = {
                type: 'session_expired',
                message: 'Your session has been transferred to another device'
              };
              ws.send(JSON.stringify(closeMessage));
              ws.close();
            }
            
            // Update the new session status to active
            await storage.updateUserSessionStatus(
              data.sessionId, 
              'active'
            );
          }
        } 
        else if (data.type === 'session_denial') {
          // An existing session denied a new session
          const newSessionConnection = findConnectionBySessionId(data.userId, data.sessionId);
          
          if (newSessionConnection) {
            const denialMessage: SessionMessage = {
              type: 'session_denial',
              sessionId: data.sessionId,
              userId: data.userId
            };
            
            newSessionConnection.send(JSON.stringify(denialMessage));
            
            // Update the new session status to denied
            await storage.updateUserSessionStatus(
              data.sessionId, 
              'denied'
            );
            
            // Close the connection for the denied session
            newSessionConnection.close();
          }
        }
        else if (data.type === 'heartbeat') {
          // Update last activity time
          if (ws.sessionId) {
            // Only update the last activity time without changing the status
            await storage.updateSessionLastActivity(ws.sessionId);
          }
          
          // Return the heartbeat
          ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', async () => {
      // Handle disconnection
      console.log(`WebSocket disconnected: userId=${ws.userId}, sessionId=${ws.sessionId}`);
      
      if (ws.userId && ws.sessionId) {
        try {
          // Update session status to expired
          await storage.updateUserSessionStatus(
            ws.sessionId, 
            'expired'
          );
          
          // Notify other sessions that this one has disconnected
          const userSessions = userConnections.get(ws.userId);
          if (userSessions) {
            for (const [sessionId, connection] of userSessions) {
              if (sessionId !== ws.sessionId && connection.readyState === WebSocket.OPEN) {
                const disconnectMessage: SessionMessage = {
                  type: 'session_disconnected',
                  sessionId: ws.sessionId,
                  userId: ws.userId
                };
                connection.send(JSON.stringify(disconnectMessage));
              }
            }
          }
          
          // Remove the connection from the map
          removeConnection(ws.userId, ws.sessionId);
        } catch (error) {
          console.error('Error handling WebSocket disconnect:', error);
        }
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  // Set up a periodic task to clean up expired sessions
  setInterval(async () => {
    try {
      const cleanedCount = await storage.cleanupExpiredSessions();
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired sessions`);
      }
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }, 30 * 60 * 1000); // Run every 30 minutes
  
  // Set up a periodic task to clean up inactive sessions
  setInterval(async () => {
    try {
      // Consider a session inactive if there's been no activity for 20 minutes
      const inactivityThreshold = 20 * 60 * 1000; // 20 minutes in milliseconds
      const inactiveCount = await storage.cleanupInactiveSessions(inactivityThreshold);
      
      if (inactiveCount > 0) {
        console.log(`Marked ${inactiveCount} inactive sessions as expired`);
        
        // Notify any connected clients about their expired sessions
        for (const [userId, sessions] of userConnections) {
          for (const [sessionId, ws] of sessions) {
            try {
              // Check if this session is still valid
              const session = await storage.getUserSession(sessionId);
              
              // If session is marked as expired, notify the client
              if (session && session.status === 'expired') {
                const disconnectMessage: SessionMessage = {
                  type: 'session_disconnected',
                  sessionId,
                  userId
                };
                
                ws.send(JSON.stringify(disconnectMessage));
                console.log(`Notified user ${userId} of expired session ${sessionId} due to inactivity`);
                
                // Close the WebSocket connection
                setTimeout(() => {
                  try {
                    ws.close();
                  } catch (e) {
                    console.error('Error closing WebSocket:', e);
                  }
                }, 1000);
              }
            } catch (error) {
              console.error(`Error checking session validity for ${sessionId}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up inactive sessions:', error);
    }
  }, 5 * 60 * 1000); // Run every 5 minutes
  
  console.log('WebSocket server initialized');
  return wss;
}