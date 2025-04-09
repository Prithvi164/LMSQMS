import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { permissionEnum, roleEnum } from "@shared/schema";
import type { RolePermission } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Info, 
  Shield, 
  AlertTriangle, 
  Users, 
  FileText, 
  Settings, 
  Lock, 
  Edit, 
  CheckSquare, 
  FileDown, 
  FileUp,
  BarChart,
  HelpCircle,
  Building,
  Activity,
  BookOpen,
  MessageSquare,
  Save
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

export function RolePermissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>(roleEnum.enumValues[1]); // Start with 'admin'
  const [currentRolePermissions, setCurrentRolePermissions] = useState<string[]>([]);

  const { data: rolePermissions, isLoading } = useQuery<RolePermission[]>({
    queryKey: ["/api/permissions"],
    enabled: !!user,
    staleTime: 0 // Always fetch fresh data
  });
  
  // Update permissions when data is loaded
  useEffect(() => {
    if (rolePermissions) {
      const permissions = rolePermissions.find((rp: RolePermission) => rp.role === selectedRole)?.permissions || [];
      setCurrentRolePermissions(permissions);
    }
  }, [rolePermissions, selectedRole]);

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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Lock className="h-5 w-5 text-primary" />;
      case 'admin': return <Settings className="h-5 w-5 text-primary" />;
      case 'manager': return <Users className="h-5 w-5 text-primary" />;
      case 'team_lead': return <Users className="h-5 w-5 text-primary" />;
      case 'quality_analyst': return <BarChart className="h-5 w-5 text-primary" />;
      case 'trainer': return <BookOpen className="h-5 w-5 text-primary" />;
      case 'advisor': return <HelpCircle className="h-5 w-5 text-primary" />;
      default: return <Users className="h-5 w-5 text-primary" />;
    }
  };

  // Organize permissions by functional areas
  interface PermissionCategory {
    name: string;
    icon: React.ReactNode;
    description: string;
    permissions: string[];
  }

  const permissionCategories: PermissionCategory[] = [
    {
      name: "User Management",
      icon: <Users className="h-5 w-5" />,
      description: "Control user accounts and access",
      permissions: ['view_users', 'edit_users', 'delete_users', 'upload_users', 'manage_users', 'add_users']
    },
    {
      name: "Organization Settings",
      icon: <Building className="h-5 w-5" />,
      description: "Manage organization structure and configuration",
      permissions: ['view_organization', 'manage_holidaylist', 'manage_locations', 'manage_processes', 'manage_lineofbusiness']
    },
    {
      name: "Training Management",
      icon: <BookOpen className="h-5 w-5" />,
      description: "Control training process and batches",
      permissions: ['manage_batches', 'manage_batch_users_add', 'manage_batch_users_remove', 'view_quiz', 'edit_quiz', 'delete_quiz', 'create_quiz', 'manage_quiz', 'take_quiz']
    },
    {
      name: "Performance & Evaluation",
      icon: <Activity className="h-5 w-5" />,
      description: "Manage performance tracking and evaluation forms",
      permissions: ['view_performance', 'manage_performance', 'view_evaluation_form', 'edit_evaluation_form', 'delete_evaluation_form', 'create_evaluation_form', 'manage_evaluation_form']
    },
    {
      name: "Reporting & Analytics",
      icon: <FileText className="h-5 w-5" />,
      description: "Access to reports and analytics data",
      permissions: ['export_reports']
    },
    {
      name: "Feedback & Communication",
      icon: <MessageSquare className="h-5 w-5" />,
      description: "Manage feedback and allocation systems",
      permissions: ['view_feedback', 'manage_feedback', 'view_allocation', 'manage_allocation']
    },
    {
      name: "Billing & Subscription",
      icon: <FileDown className="h-5 w-5" />,
      description: "Control billing and subscription settings",
      permissions: ['manage_billing', 'manage_subscription']
    }
  ];

  // Get permission description
  const getPermissionDescription = (permission: string) => {
    const descriptions: Record<string, string> = {
      // User Management
      manage_users: "Create, edit, and delete user accounts",
      view_users: "View user profiles and information",
      edit_users: "Modify user account details",
      delete_users: "Remove user accounts",
      upload_users: "Bulk import user data",
      add_users: "Create new user accounts",
      
      // Organization Settings
      view_organization: "View organization structure and settings",
      manage_holidaylist: "Full access to holiday management (add, edit, delete holidays)",
      manage_locations: "Full access to manage office/center locations",
      manage_processes: "Full access to workflow processes management",
      manage_lineofbusiness: "Full access to line of business management",
      
      // Legacy - for backward compatibility
      manage_organization_settings: "Configure organization-wide parameters",
      manage_organization: "Control organization-wide settings",
      edit_organization: "Update organization settings",
      create_location: "Add new location entries",
      create_process: "Set up new workflow processes",
      
      // Performance
      manage_performance: "Access and manage performance metrics",
      view_performance: "View performance metrics",
      export_reports: "Generate and download reports",
      
      // Training Management
      manage_batches: "Create, edit, and delete training batches",
      manage_batch_users_add: "Add users to training batches",
      manage_batch_users_remove: "Remove users from training batches",
      
      // Quiz Management
      view_quiz: "View quiz details and questions",
      edit_quiz: "Modify existing quizzes",
      delete_quiz: "Remove quizzes from the system",
      create_quiz: "Create new quizzes",
      manage_quiz: "Full control over quiz management",
      take_quiz: "Ability to take quizzes",
      
      // Evaluation Forms
      view_evaluation_form: "View evaluation form details",
      edit_evaluation_form: "Modify existing evaluation forms",
      delete_evaluation_form: "Remove evaluation forms",
      create_evaluation_form: "Create new evaluation forms",
      manage_evaluation_form: "Full control over evaluation forms",
      
      // Feedback & Allocation
      view_feedback: "View feedback data",
      manage_feedback: "Control feedback systems",
      view_allocation: "View allocation information",
      manage_allocation: "Control allocation systems",
      
      // Billing & Subscription
      manage_billing: "Control payment and billing settings",
      manage_subscription: "Handle subscription-related tasks",
    };
    return descriptions[permission] || permission.replace(/_/g, " ");
  };

  const getPermissionIcon = (permission: string) => {
    if (permission.startsWith('view_')) return <Info className="h-4 w-4 text-blue-500" />;
    if (permission.startsWith('manage_')) return <Settings className="h-4 w-4 text-purple-500" />;
    if (permission.startsWith('edit_')) return <Edit className="h-4 w-4 text-amber-500" />;
    if (permission.startsWith('create_')) return <CheckSquare className="h-4 w-4 text-green-500" />;
    if (permission.startsWith('delete_')) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (permission.startsWith('upload_')) return <FileUp className="h-4 w-4 text-teal-500" />;
    if (permission.startsWith('export_')) return <FileDown className="h-4 w-4 text-indigo-500" />;
    return <HelpCircle className="h-4 w-4 text-gray-500" />;
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
    onSuccess: (data) => {
      // Force a refetch of the data instead of just invalidating
      queryClient.setQueryData(["/api/permissions"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((rp: any) => 
          rp.role === data.role ? data : rp
        );
      });
      
      // Also invalidate to ensure fresh data on next fetch
      queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
      
      // Also invalidate the specific role permissions
      queryClient.invalidateQueries({ queryKey: [`/api/permissions/${data.role}`] });
      
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

  // Update current permissions when selected role changes
  useEffect(() => {
    if (rolePermissions) {
      const permissions = rolePermissions.find((rp) => rp.role === selectedRole)?.permissions || [];
      setCurrentRolePermissions(permissions);
    }
  }, [selectedRole, rolePermissions]);

  const handlePermissionToggle = useCallback((permission: string) => {
    // Use the local state instead of the callback to get permissions
    const newPermissions = currentRolePermissions.includes(permission)
      ? currentRolePermissions.filter((p: string) => p !== permission)
      : [...currentRolePermissions, permission];
    
    // Update local state immediately for a responsive UI
    setCurrentRolePermissions(newPermissions);

    // Then send the update to the server
    updatePermissionMutation.mutate({
      role: selectedRole,
      permissions: newPermissions,
    });
  }, [selectedRole, currentRolePermissions, updatePermissionMutation]);

  type PermissionType = typeof permissionEnum.enumValues[number];

  const handleCategoryPermissions = (categoryPermissions: string[], enabled: boolean) => {
    // Filter to only include permissions that exist in the system
    const validPermissions = categoryPermissions.filter(p => 
      permissionEnum.enumValues.includes(p as PermissionType)
    ) as PermissionType[];
    
    let newPermissions = [...currentRolePermissions];
    
    if (enabled) {
      // Add all permissions from this category that aren't already enabled
      validPermissions.forEach(p => {
        if (!newPermissions.includes(p)) {
          newPermissions.push(p);
        }
      });
    } else {
      // Remove all permissions from this category
      newPermissions = newPermissions.filter(p => !validPermissions.includes(p as PermissionType));
    }
    
    // Update state and send to server
    setCurrentRolePermissions(newPermissions);
    updatePermissionMutation.mutate({
      role: selectedRole,
      permissions: newPermissions,
    });
  };

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
        <h1 className="text-3xl font-bold">Roles & Permissions</h1>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Changes to permissions take effect immediately. Users may need to refresh their page to see updates.
        </AlertDescription>
      </Alert>

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
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Role Hierarchy Panel */}
            <div className="lg:col-span-2 space-y-5">
              <div className="border rounded-lg overflow-hidden">
                <div className="p-3 border-b bg-muted/30">
                  <h3 className="font-medium">Role Hierarchy</h3>
                </div>
                <div className="p-4 space-y-3">
                  {availableRoles.map((role) => (
                    <div
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                        selectedRole === role 
                          ? 'bg-primary/10 border-primary' 
                          : 'bg-card hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(role)}
                          <div>
                            <h4 className="font-medium capitalize">
                              {role.replace(/_/g, " ")}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {getRoleDescription(role)}
                            </p>
                          </div>
                        </div>
                        {selectedRole === role && (
                          <Badge variant="outline">Selected</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Permissions Panel */}
            <div className="lg:col-span-3 border rounded-lg overflow-hidden">
              <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getRoleIcon(selectedRole)}
                  <div>
                    <h3 className="text-base font-medium capitalize">
                      {selectedRole.replace(/_/g, " ")} Permissions
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {getRoleDescription(selectedRole)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      // Reset to defaults logic would go here
                      toast({
                        title: "Reset to defaults",
                        description: "Permissions have been reset to role defaults",
                      });
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
              
              <div className="p-4 space-y-6">
                {permissionCategories.map(category => {
                  const validCategoryPermissions = category.permissions.filter(p => 
                    permissionEnum.enumValues.includes(p as PermissionType)
                  ) as PermissionType[];
                  
                  if (validCategoryPermissions.length === 0) return null;
                  
                  const allChecked = validCategoryPermissions.every(p => 
                    currentRolePermissions.includes(p)
                  );
                  const someChecked = validCategoryPermissions.some(p => 
                    currentRolePermissions.includes(p)
                  ) && !allChecked;
                  
                  return (
                    <div key={category.name}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {category.icon}
                          <h3 className="font-medium">{category.name}</h3>
                        </div>
                        <Checkbox 
                          checked={allChecked} 
                          className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:opacity-70"
                          data-state={someChecked ? "indeterminate" : allChecked ? "checked" : "unchecked"}
                          disabled={selectedRole === 'owner' && user?.role !== 'owner'}
                          onCheckedChange={(checked) => handleCategoryPermissions(
                            category.permissions, 
                            checked === true ? true : false
                          )}
                        />
                      </div>
                      
                      <div className="space-y-3 pl-7">
                        {validCategoryPermissions.map(permission => (
                          <div key={permission} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getPermissionIcon(permission)}
                              <div>
                                <p className="text-sm capitalize">
                                  {permission.replace(/_/g, " ")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {getPermissionDescription(permission)}
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={currentRolePermissions.includes(permission)}
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
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
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