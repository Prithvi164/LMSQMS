import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import LearningPaths from "@/pages/learning-paths";
import Performance from "@/pages/performance";
import Settings from "@/pages/settings";
import { ProtectedRoute } from "./lib/protected-route";
import { SidebarNav } from "./components/sidebar-nav";
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="flex">
          <SidebarNav />
          <main className="flex-1">
            <div className="p-4 border-b flex justify-end">
              <UserProfile />
            </div>
            <Router />
          </main>
        </div>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;