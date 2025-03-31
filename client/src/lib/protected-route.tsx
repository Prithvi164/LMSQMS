import { Route, Redirect } from "wouter";
import { Loader2, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useFeatures, Feature } from "@/hooks/use-features";

// Map routes to feature names
const ROUTE_TO_FEATURE: Record<string, Feature> = {
  "/": "DASHBOARD",
  "/my-quizzes": "MY_QUIZZES",
  "/batch-management": "BATCH_MANAGEMENT",
  "/trainee-management": "TRAINEE_MANAGEMENT",
  "/quiz-management": "QUIZ_MANAGEMENT",
  "/evaluation-templates": "EVALUATION_TEMPLATES",
  "/conduct-evaluation": "CONDUCT_EVALUATION",
  "/mock-call-scenarios": "MOCK_CALL_SCENARIOS",
  "/performance": "DASHBOARD", // Considering this as part of dashboard
  "/settings": "SETTINGS",
};

export function ProtectedRoute({
  path,
  component: Component,
  requiredFeature,
}: {
  path: string;
  component: () => React.JSX.Element;
  requiredFeature?: Feature;
}) {
  const { user, isLoading } = useAuth();
  const { hasAccess } = useFeatures();

  // The feature required for this route
  const featureForRoute = requiredFeature || 
    // Try to map the route to a feature, or default to DASHBOARD
    (path in ROUTE_TO_FEATURE ? ROUTE_TO_FEATURE[path] : "DASHBOARD");

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Check if user has access to the required feature
  if (!hasAccess(featureForRoute)) {
    return (
      <Route path={path}>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <Lock className="h-16 w-16 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Access Restricted</h1>
          <p className="text-muted-foreground">
            You don't have access to this feature based on your current permissions.
          </p>
        </div>
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}