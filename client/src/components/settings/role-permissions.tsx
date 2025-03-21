import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Info, Shield, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RolePermissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>(roleEnum.enumValues[1]); // Start with 'admin'

  const { data: rolePermissions, isLoading } = useQuery<RolePermission[]>({
    queryKey: ["/api/permissions"],
    enabled: !!user,
    staleTime: 0, // Always fetch fresh data
  });

  // Filter out owner and trainee from role selection
  const availableRoles = roleEnum.enumValues.filter(role => {
    if (user?.role !== 'owner') {
      return role !== 'owner' && role !== 'trainee';
    }
    return role !== 'trainee';
  });

  const getRoleDescription = (role: string) => {
    const descriptions: Record<string, string> = {
      owner: "Full system access and control",
      admin: "Organization-wide administration",
      manager: "Department and team management",
      team_lead: "Team supervision and coordination",
      quality_analyst: "Quality monitoring and assurance",
      trainer: "Training delivery and assessment",
      advisor: "Support and guidance provision"
    };
    return descriptions[role] || role;
  };

  // Get permission description
  const getPermissionDescription = (permission: string) => {
    const descriptions: Record<string, string> = {
      // Manage Section
      manage_billing: "Control payment and billing settings",
      manage_subscription: "Handle subscription-related tasks",
      manage_organization_settings: "Configure organization-wide parameters",
      manage_users: "Create, edit, and delete user accounts",
      manage_organization: "Control organization-wide settings",
      manage_locations: "Manage different office/center locations",
      manage_processes: "Handle workflow processes",
      manage_performance: "Access and manage performance metrics",

      // Create Section
      create_admin: "Create new administrator accounts",
      create_location: "Add new location entries",
      create_process: "Set up new workflow processes",

      // View Section
      view_users: "View user profiles and information",
      view_reports: "Access system reports",
      view_performance: "View performance metrics",

      // Edit Section
      edit_users: "Modify user account details",
      edit_organization: "Update organization settings",

      // Delete Section
      delete_users: "Remove user accounts",

      // Upload Section
      upload_users: "Bulk import user data",

      // Export Section
      export_reports: "Generate and download reports"
    };
    return descriptions[permission] || permission.replace(/_/g, " ");
  };

  const updatePermissionMutation = useMutation({
    mutationFn: async ({
      role,
      permissions,
    }: {
      role: string;
      permissions: string[];
    }) => {
      console.log('Updating permissions for role:', role, 'New permissions:', permissions);
      const res = await apiRequest("PATCH", `/api/permissions/${role}`, {
        permissions,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update permissions');
      }
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
      console.error('Failed to update permissions:', error);
      toast({
        title: "Failed to update permissions",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getPermissionsForRole = useCallback((role: string) => {
    const permissions = rolePermissions?.find((rp) => rp.role === role)?.permissions || [];
    console.log('Current permissions for role:', role, 'Permissions:', permissions);
    return permissions;
  }, [rolePermissions]);

  const handlePermissionToggle = useCallback((permission: string) => {
    const currentPermissions = getPermissionsForRole(selectedRole);
    const newPermissions = currentPermissions.includes(permission)
      ? currentPermissions.filter((p: string) => p !== permission)
      : [...currentPermissions, permission];

    console.log('Toggling permission:', permission, 'New permissions list:', newPermissions);

    updatePermissionMutation.mutate({
      role: selectedRole,
      permissions: newPermissions,
    });
  }, [selectedRole, getPermissionsForRole, updatePermissionMutation]);

  const filterPermissions = (permissions: string[]) => {
    // Filter out course related permissions
    return permissions.filter(permission => 
      !permission.includes('course')
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

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Changes to permissions take effect immediately. Users may need to refresh their page to see updates.
        </AlertDescription>
      </Alert>

      <TooltipProvider>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Role Management
            </CardTitle>
            <CardDescription>
              Define access levels and capabilities for different roles in your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Role Selection with Descriptions */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-medium mb-3">Select Role</h3>
                <div className="grid gap-2">
                  {availableRoles.map((role) => (
                    <div
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedRole === role 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-card hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">
                          {role.replace(/_/g, " ")}
                        </span>
                        <Badge variant={selectedRole === role ? "outline" : "secondary"}>
                          {selectedRole === role ? "Selected" : "Select"}
                        </Badge>
                      </div>
                      <p className="text-sm mt-1 opacity-90">
                        {getRoleDescription(role)}
                      </p>
                    </div>
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
                              Click to toggle this permission
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