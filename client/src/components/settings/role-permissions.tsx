import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { permissionEnum, roleEnum } from "@shared/schema";
import type { RolePermission } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function RolePermissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>(roleEnum.enumValues[1]); // Start with 'admin'

  const { data: rolePermissions, isLoading } = useQuery<RolePermission[]>({
    queryKey: ["/api/permissions"],
    enabled: !!user,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Filter out owner from role selection if user is not an owner
  const availableRoles = roleEnum.enumValues.filter(role => {
    if (user?.role !== 'owner') {
      return role !== 'owner'; // Only owner can see/modify owner permissions
    }
    return true;
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({
      role,
      permissions,
    }: {
      role: string;
      permissions: string[];
    }) => {
      const res = await apiRequest("PATCH", `/api/permissions/${role}`, {
        permissions,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
      toast({
        title: "Permissions updated",
        description: "Role permissions have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update permissions",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getPermissionsForRole = useCallback((role: string) => {
    return rolePermissions?.find((rp) => rp.role === role)?.permissions || [];
  }, [rolePermissions]);

  const handlePermissionToggle = useCallback((permission: string) => {
    const currentPermissions = getPermissionsForRole(selectedRole);
    const newPermissions = currentPermissions.includes(permission)
      ? currentPermissions.filter((p: string) => p !== permission)
      : [...currentPermissions, permission];

    updatePermissionMutation.mutate({
      role: selectedRole,
      permissions: newPermissions,
    });
  }, [selectedRole, getPermissionsForRole, updatePermissionMutation]);

  if (isLoading) {
    return <div>Loading permissions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Role Permissions</h1>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          <div className="flex gap-2">
            {availableRoles.map((role) => (
              <Badge
                key={role}
                variant={selectedRole === role ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedRole(role)}
              >
                {role}
              </Badge>
            ))}
          </div>

          <div className="grid gap-4">
            {Object.entries(groupPermissionsByCategory(permissionEnum.enumValues)).map(
              ([category, permissions]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold mb-2 capitalize">
                    {category.replace("_", " ")}
                  </h3>
                  <div className="grid gap-2">
                    {permissions.map((permission) => (
                      <div
                        key={permission}
                        className="flex items-center justify-between py-2"
                      >
                        <span className="capitalize">
                          {permission.replace(/_/g, " ")}
                        </span>
                        <Switch
                          checked={getPermissionsForRole(selectedRole).includes(
                            permission
                          )}
                          onCheckedChange={() => handlePermissionToggle(permission)}
                          disabled={
                            selectedRole === 'owner' && user?.role !== 'owner' ||
                            updatePermissionMutation.isPending
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// Helper function to group permissions by category
function groupPermissionsByCategory(permissions: string[]) {
  return permissions.reduce((acc, permission) => {
    const category = permission.split("_")[0];
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(permission);
    return acc;
  }, {} as Record<string, string[]>);
}