import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  useQuery,
  useMutation,
} from "@tanstack/react-query";
import { type User, type InsertUser } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";

export type LoginData = {
  username: string;
  password: string;
  deviceInfo?: string;
};

export type LoginResponse = User & {
  sessionId?: string;
  userId?: number;
  status?: 'active' | 'pending_approval' | 'approved' | 'denied' | 'expired';
  message?: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (data: LoginData) => Promise<LoginResponse | undefined>;
  register: (data: InsertUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  
  // Fetch the current user
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/user", { credentials: "include" });
        if (res.status === 401) return null;
        if (!res.ok) throw new Error("Failed to fetch user");
        const userData = await res.json();
        
        // If the response includes a session ID, store it
        if (userData?.sessionId) {
          setSessionId(userData.sessionId);
        }
        
        return userData;
      } catch (err) {
        throw err;
      }
    },
  });
  
  // Connect to WebSocket for session management if user is logged in
  const { status: wsStatus, lastMessage, sendMessage } = useWebSocket(
    user?.id,
    sessionId
  );
  
  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      console.log('WebSocket message received in auth context:', lastMessage);
      
      // Handle session expiration/transfer
      if (lastMessage.type === 'session_expired') {
        toast({
          title: "Session Expired",
          description: lastMessage.message || "Your session has been transferred to another device.",
          variant: "destructive",
        });
        
        // Force logout
        queryClient.setQueryData(["/api/user"], null);
        window.location.href = '/login';
      }
      
      // Handle new session requests
      if (lastMessage.type === 'session_request') {
        toast({
          title: "New Login Attempt",
          description: "Someone is trying to log in to your account from another device.",
          variant: "default",
        });
        
        // You would show the approval modal here or dispatch an event
        // We'll handle this in the UI components
      }
    }
  }, [lastMessage, toast]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      try {
        const res = await apiRequest("POST", "/api/login", credentials);
        // Since apiRequest already checks for errors and clones the response, we can safely call json()
        return await res.json();
      } catch (error) {
        console.error("Login error:", error);
        throw error;
      }
    },
    onSuccess: (response: LoginResponse) => {
      // Only update the user in the query cache if this is an active session
      if (!response.status || response.status === 'active') {
        queryClient.setQueryData(["/api/user"], response);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      try {
        const res = await apiRequest("POST", "/api/register", data);
        // Since apiRequest already checks for errors and clones the response, we can safely call json()
        return await res.json();
      } catch (error) {
        console.error("Registration error:", error);
        throw error;
      }
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        // Using fetch directly instead of apiRequest to avoid body stream issues
        const response = await fetch("/api/logout", {
          method: "POST",
          credentials: "include"
        });
        
        // Special case for 503 Service Unavailable - force logout on client side
        if (response.status === 503) {
          console.warn("Server unavailable during logout, forcing client-side logout");
          return { forced: true };
        }
        
        if (!response.ok) {
          let errorMessage: string;
          try {
            const data = await response.json();
            errorMessage = data.message || response.statusText;
          } catch {
            errorMessage = response.statusText;
          }
          throw new Error(`${response.status}: ${errorMessage}`);
        }
        
        return { success: true }; // Return something to indicate success
      } catch (error) {
        console.error("Logout error:", error);
        // If the error is a network error or the server is unreachable,
        // we'll force a client-side logout
        if (error instanceof Error && 
            (error.message.includes("Failed to fetch") || 
             error.message.includes("NetworkError") ||
             error.message.includes("503"))) {
          console.warn("Network error during logout, forcing client-side logout");
          return { forced: true };
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      // Clear the user data from the cache regardless of how logout happened
      queryClient.setQueryData(["/api/user"], null);
      
      // Clear all queries from cache to ensure fresh data on next login
      queryClient.clear();
      
      // Show a toast for forced logout if needed
      if (result.forced) {
        toast({
          title: "Logged out",
          description: "You've been logged out. The server may be temporarily unavailable.",
          duration: 5000,
        });
      }
    },
    onError: (error: Error) => {
      console.error("Logout mutation error:", error);
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
      
      // If we get a serious error, we could still force a client-side logout as a fallback
      queryClient.setQueryData(["/api/user"], null);
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        login: async (data) => {
          const response = await loginMutation.mutateAsync(data);
          
          // Only update the user in the query cache if this is an active session
          if (response && (!response.status || response.status === 'active')) {
            queryClient.setQueryData(["/api/user"], response);
          }
          
          return response;
        },
        register: async (data) => {
          await registerMutation.mutateAsync(data);
        },
        logout: async () => {
          await logoutMutation.mutateAsync();
        },
        updateUser: (updatedUser: User) => {
          queryClient.setQueryData(["/api/user"], updatedUser);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}