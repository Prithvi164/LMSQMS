import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { permissionEnum, roleEnum } from "@shared/schema";
import type { RolePermission } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger,
  TooltipProvider 
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export function RolePermissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>(roleEnum.enumValues[1]); // Start with 'admin'

  const { data: rolePermissions, isLoading } = useQuery<RolePermission[]>({
    queryKey: ["/api/permissions"],
    enabled: !!user,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Filter out owner and trainee from role selection
  const availableRoles = roleEnum.enumValues.filter(role => {
    if (user?.role !== 'owner') {
      return role !== 'owner' && role !== 'trainee'; // Filter out both owner and trainee
    }
    return role !== 'trainee'; // Always filter out trainee
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

  // Get permission description
  const getPermissionDescription = (permission: string) => {
    const descriptions: Record<string, string> = {
      create_admin: "Create new admin users for the organization",
      manage_users: "Create, edit, and delete user accounts",
      view_users: "View user profiles and basic information",
      edit_users: "Modify user details and settings",
      delete_users: "Remove users from the system",
      upload_users: "Bulk import users via file upload",
      manage_organization: "Control organization-wide settings",
      manage_performance: "Access and manage performance metrics",
      export_reports: "Generate and download reports",
      // Removed course and learning path related descriptions
    };
    return descriptions[permission] || permission.replace(/_/g, " ");
  };

  const filterPermissions = (permissions: string[]) => {
    // Filter out course and learning path related permissions
    return permissions.filter(permission => 
      !permission.includes('course') && 
      !permission.includes('learning_path')
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Role Permissions</h1>
      </div>

      <TooltipProvider>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Role Management
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  Select a role to manage its permissions. Changes are applied immediately.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Role Selection */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-medium mb-3">Select Role</h3>
                <div className="flex flex-wrap gap-2">
                  {availableRoles.map((role) => (
                    <Badge
                      key={role}
                      variant={selectedRole === role ? "default" : "outline"}
                      className={`cursor-pointer hover:bg-primary/90 transition-colors ${
                        selectedRole === role ? 'shadow-sm' : ''
                      }`}
                      onClick={() => setSelectedRole(role)}
                    >
                      {role.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Permissions Grid */}
              <div className="grid gap-6">
                {Object.entries(groupPermissionsByCategory(filterPermissions(permissionEnum.enumValues))).map(
                  ([category, permissions]) => (
                    <div key={category} className="space-y-4">
                      <h3 className="text-lg font-semibold capitalize">
                        {category.replace("_", " ")}
                      </h3>
                      <div className="grid gap-3 bg-card p-4 rounded-lg border">
                        {permissions.map((permission) => (
                          <Tooltip key={permission}>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors">
                                <div className="space-y-1">
                                  <p className="font-medium capitalize">
                                    {permission.replace(/_/g, " ")}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {getPermissionDescription(permission)}
                                  </p>
                                </div>
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
                            </TooltipTrigger>
                            <TooltipContent side="left" align="center">
                              {getPermissionDescription(permission)}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>
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