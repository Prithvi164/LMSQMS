import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { PermissionsProvider } from "@/hooks/use-permissions";
import { FeaturesProvider } from "@/hooks/use-features";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";

import Performance from "@/pages/performance";
import Settings from "@/pages/settings";
import TraineeManagement from "@/pages/trainee-management";
import QuizManagement from "@/pages/quiz-management";
import { BatchMonitoringPage } from "@/pages/batch-monitoring";
import { QuizTakingPage } from "@/pages/quiz-taking";
import { QuizResultsPage } from "@/pages/quiz-results";
import { MyQuizzesPage } from "@/pages/my-quizzes";
import MockCallScenarios from "@/pages/mock-call-scenarios";
import EvaluationTemplates from "@/pages/evaluation-templates";
import ConductEvaluation from "@/pages/conduct-evaluation"; 
import { ProtectedRoute } from "./lib/protected-route";
import { SidebarNav } from "./components/sidebar-nav";
import { UserProfile } from "./components/user-profile";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { BatchDetailsPage } from "@/components/batch-management/batch-details-page";
import { BatchDetail } from "@/components/batch-management/batch-detail";
import { BatchDashboardPage } from "@/pages/batch-dashboard-page";

interface BatchDetailProps {
  onCreateBatch?: () => void;
}

function Router() {
  const { user } = useAuth();
  const [location] = useLocation();

  const isSettingsPage = location === "/settings";
  const isAuthPage = location.startsWith("/auth");

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
          <ProtectedRoute path="/" component={Dashboard} requiredFeature="DASHBOARD" />

          {/* LMS Features */}
          <ProtectedRoute path="/trainee-management" component={TraineeManagement} requiredFeature="TRAINEE_MANAGEMENT" />
          <ProtectedRoute path="/performance" component={Performance} requiredFeature="DASHBOARD" />
          <ProtectedRoute path="/settings" component={Settings} requiredFeature="SETTINGS" />
          <ProtectedRoute path="/batch-management" component={() => <BatchDetail onCreateBatch={() => {}} />} requiredFeature="BATCH_MANAGEMENT" />
          <ProtectedRoute path="/batch-monitoring" component={BatchMonitoringPage} requiredFeature="BATCH_MONITORING" />
          <ProtectedRoute path="/batch-details/:batchId" component={BatchDetailsPage} requiredFeature="BATCH_MANAGEMENT" />
          <ProtectedRoute path="/batch-dashboard/:batchId" component={BatchDashboardPage} requiredFeature="BATCH_MANAGEMENT" />
          <ProtectedRoute path="/quiz-management" component={QuizManagement} requiredFeature="QUIZ_MANAGEMENT" />
          <ProtectedRoute path="/my-quizzes" component={MyQuizzesPage} requiredFeature="MY_QUIZZES" />
          <ProtectedRoute path="/quiz/:quizId" component={QuizTakingPage} requiredFeature="MY_QUIZZES" />
          <ProtectedRoute path="/quiz-results/:attemptId" component={QuizResultsPage} requiredFeature="MY_QUIZZES" />
          
          {/* QMS Features */}
          <ProtectedRoute path="/mock-call-scenarios" component={MockCallScenarios} requiredFeature="MOCK_CALL_SCENARIOS" />
          <ProtectedRoute path="/evaluation-templates" component={EvaluationTemplates} requiredFeature="EVALUATION_TEMPLATES" />
          <ProtectedRoute path="/conduct-evaluation" component={ConductEvaluation} requiredFeature="CONDUCT_EVALUATION" /> 
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
          <FeaturesProvider>
            <Router />
            <Toaster />
          </FeaturesProvider>
        </PermissionsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;