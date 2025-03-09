import { Route, Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type ProtectedRouteProps = {
  path: string;
  component: () => React.JSX.Element;
  roles?: string[];
};

export function ProtectedRoute({
  path,
  component: Component,
  roles
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

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

  // Check if the route requires specific roles
  if (roles && roles.length > 0) {
    const hasRequiredRole = roles.includes(user.role);
    if (!hasRequiredRole) {
      return (
        <Route path={path}>
          <Redirect to="/" />
        </Route>
      );
    }
  }

  return <Route path={path} component={Component} />;
}