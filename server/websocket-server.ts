import WebSocket from 'ws';
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

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocket.Server({ server });

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
          
          if (existingSessions && existingSessions.size > 0) {
            // Send request to all existing sessions
            for (const [sessionId, connection] of existingSessions) {
              if (sessionId !== data.sessionId && connection.readyState === WebSocket.OPEN) {
                const requestMessage: SessionMessage = {
                  type: 'session_request',
                  sessionId: data.sessionId,
                  userId: data.userId,
                  deviceInfo: data.deviceInfo,
                  ipAddress: data.ipAddress,
                  userAgent: data.userAgent
                };
                
                connection.send(JSON.stringify(requestMessage));
                
                // Update the session status to pending approval
                await storage.updateUserSessionStatus(
                  data.sessionId, 
                  userSessionStatusEnum.enumValues[1] // 'pending_approval'
                );
              }
            }
          } else {
            // No existing sessions, approve automatically
            const approvalMessage: SessionMessage = {
              type: 'session_approval',
              sessionId: data.sessionId,
              userId: data.userId
            };
            
            ws.send(JSON.stringify(approvalMessage));
            
            // Update the session status to approved
            await storage.updateUserSessionStatus(
              data.sessionId, 
              userSessionStatusEnum.enumValues[2] // 'approved'
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
                userSessionStatusEnum.enumValues[4] // 'expired'
              );
              
              // Remove the connection from the map
              userConnections.get(data.userId)?.delete(ws.sessionId);
              
              // Close the connection
              ws.close();
            }
            
            // Update the new session status to approved
            await storage.updateUserSessionStatus(
              data.sessionId, 
              userSessionStatusEnum.enumValues[2] // 'approved'
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
            
            // Update the session status to denied
            await storage.updateUserSessionStatus(
              data.sessionId, 
              userSessionStatusEnum.enumValues[3] // 'denied'
            );
            
            // Remove the connection from the map
            userConnections.get(data.userId)?.delete(data.sessionId);
            
            // Close the connection
            newSessionConnection.close();
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', async () => {
      console.log('WebSocket connection closed');
      
      if (ws.userId && ws.sessionId) {
        // Remove the connection from the map
        userConnections.get(ws.userId)?.delete(ws.sessionId);
        
        if (userConnections.get(ws.userId)?.size === 0) {
          userConnections.delete(ws.userId);
        }
        
        // Update the session status to expired
        await storage.updateUserSessionStatus(
          ws.sessionId, 
          userSessionStatusEnum.enumValues[4] // 'expired'
        );
        
        // Notify other sessions that this session has disconnected
        const otherSessions = userConnections.get(ws.userId);
        if (otherSessions) {
          for (const [sessionId, connection] of otherSessions) {
            if (connection.readyState === WebSocket.OPEN) {
              const disconnectMessage: SessionMessage = {
                type: 'session_disconnected',
                sessionId: ws.sessionId,
                userId: ws.userId
              };
              
              connection.send(JSON.stringify(disconnectMessage));
            }
          }
        }
      }
    });
  });
  
  console.log('WebSocket server initialized');
  return wss;
}

// Helper function to find a connection by session ID
function findConnectionBySessionId(userId: number, sessionId: string): WebSocketWithSession | undefined {
  return userConnections.get(userId)?.get(sessionId);
}