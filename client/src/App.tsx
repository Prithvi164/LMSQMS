import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { PermissionsProvider } from "@/hooks/use-permissions";
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
  const { user } = useAuth();
  const [location] = useLocation();

  const isSettingsPage = location === "/settings";
  const isAuthPage = location.startsWith("/auth");

  return (
    <div className="flex">
      {user && !isAuthPage && !isSettingsPage && <SidebarNav />}
      <main className={`${user && !isSettingsPage ? "flex-1" : "w-full"}`}>
        {user && !isAuthPage && !isSettingsPage && (
          <div className="p-4 border-b flex justify-end">
            <UserProfile />
          </div>
        )}
        <Switch>
          <Route path="/auth" component={AuthPage} />
          <ProtectedRoute path="/" component={Dashboard} />
          <ProtectedRoute path="/learning-paths" component={LearningPaths} />
          <ProtectedRoute path="/performance" component={Performance} />
          <ProtectedRoute path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PermissionsProvider>
          <Router />
          <Toaster />
        </PermissionsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;