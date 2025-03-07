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
import TraineeManagement from "@/pages/trainee-management";
import { BatchDetail } from "@/components/batch-management/batch-detail";
import { BatchMonitoringPage } from "@/pages/batch-monitoring";
import { ProtectedRoute } from "./lib/protected-route";
import { SidebarNav } from "./components/sidebar-nav";
import { UserProfile } from "./components/user-profile";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { BatchDetailsPage } from "@/components/batch-management/batch-details-page";

function Router() {
  const { user } = useAuth();
  const [location] = useLocation();

  const isSettingsPage = location === "/settings";
  const isAuthPage = location.startsWith("/auth");

  // Show onboarding flow for authenticated users who haven't completed onboarding
  if (user && !user.onboardingCompleted && !isAuthPage) {
    return <OnboardingFlow />;
  }

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
          <ProtectedRoute path="/trainee-management" component={TraineeManagement} />
          <ProtectedRoute path="/performance" component={Performance} />
          <ProtectedRoute path="/settings" component={Settings} />
          <ProtectedRoute path="/batch-management" component={BatchDetail} />
          <ProtectedRoute path="/batch-management/:batchId" component={BatchDetail} />
          <ProtectedRoute path="/batch-monitoring" component={BatchMonitoringPage} />
          <ProtectedRoute path="/batch-details/:batchId" component={BatchDetailsPage} />
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