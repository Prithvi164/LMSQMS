import { createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import type { RolePermission } from "@shared/schema";

type PermissionsContextType = {
  hasPermission: (permission: string) => boolean;
  isLoading: boolean;
  error: Error | null;
};

const PermissionsContext = createContext<PermissionsContextType | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const { data: rolePermissions, isLoading, error } = useQuery<RolePermission>({
    queryKey: [`/api/permissions/${user?.role}`],
    enabled: !!user,
  });

  const hasPermission = (permission: string): boolean => {
    if (!user || !rolePermissions) return true; // Temporarily return true until permissions are set up
    return rolePermissions.permissions.includes(permission);
  };

  return (
    <PermissionsContext.Provider
      value={{
        hasPermission,
        isLoading,
        error: error as Error | null,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}

export function PermissionGuard({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return null;
  }

  return <>{children}</>;
}