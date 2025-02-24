import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import LearningPaths from "@/pages/learning-paths";
import Performance from "@/pages/performance";
import Settings from "@/pages/settings";
import { ProtectedRoute } from "./lib/protected-route";
import { UserProfile } from "./components/user-profile";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/learning-paths" component={LearningPaths} />
      <ProtectedRoute path="/performance" component={Performance} />
      <ProtectedRoute path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user } = useAuth();
  return (
    <div className="flex">
      <main className="w-full">
        {user && (
          <div className="p-4 border-b flex justify-end">
            <UserProfile />
          </div>
        )}
        <Router />
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;