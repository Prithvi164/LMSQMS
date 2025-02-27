import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { User, Organization, OrganizationLocation, OrganizationRole } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AddUserProps {
  users: User[];
  user: User;
  organization: Organization | undefined;
  potentialManagers: User[];
}

export function AddUser({
  users,
  user,
  organization,
  potentialManagers,
}: AddUserProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    fullName: "",
    employeeId: "",
    roleId: "", // Changed from string to number
    locationId: "none",
    email: "",
    phoneNumber: "",
    education: "",
    dateOfJoining: "",
    dateOfBirth: "",
    managerId: "none",
  });

  // Fetch organization settings
  const { data: orgSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/settings`],
    enabled: !!organization?.id,
  });

  // Fetch organization roles
  const { data: roles = [], isLoading: isLoadingRoles } = useQuery<OrganizationRole[]>({
    queryKey: [`/api/organizations/${organization?.id}/roles`],
    enabled: !!organization?.id,
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof newUserData) => {
      try {
        const payload = {
          ...data,
          locationId: data.locationId === "none" ? null : Number(data.locationId),
          managerId: data.managerId === "none" ? null : Number(data.managerId),
          organizationId: organization?.id || null,
          roleId: Number(data.roleId), // Ensure roleId is a number
        };

        const response = await apiRequest("POST", "/api/users", payload);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to create user");
        }
        return response.json();
      } catch (error: any) {
        throw new Error(error.message || "An unexpected error occurred");
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setNewUserData({
        username: "",
        password: "",
        fullName: "",
        employeeId: "",
        roleId: "",
        locationId: "none",
        email: "",
        phoneNumber: "",
        education: "",
        dateOfJoining: "",
        dateOfBirth: "",
        managerId: "none",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get filtered managers based on role
  const getFilteredManagers = (selectedRoleId: string) => {
    if (!potentialManagers || !roles) return [];

    const selectedRole = roles.find(r => r.id.toString() === selectedRoleId);
    if (!selectedRole) return [];

    switch (selectedRole.role) {
      case "admin":
        return potentialManagers.filter(m => roles.find(r => r.id === m.roleId)?.role === "owner");
      case "manager":
        return potentialManagers.filter(m => {
          const role = roles.find(r => r.id === m.roleId)?.role;
          return ["owner", "admin"].includes(role || "");
        });
      case "team_lead":
        return potentialManagers.filter(m => {
          const role = roles.find(r => r.id === m.roleId)?.role;
          return ["owner", "admin", "manager"].includes(role || "");
        });
      case "trainer":
        return potentialManagers.filter(m => {
          const role = roles.find(r => r.id === m.roleId)?.role;
          return ["owner", "admin", "manager", "team_lead"].includes(role || "");
        });
      case "trainee":
        return potentialManagers.filter(m => {
          const role = roles.find(r => r.id === m.roleId)?.role;
          return ["owner", "admin", "manager", "team_lead", "trainer"].includes(role || "");
        });
      case "advisor":
        return potentialManagers.filter(m => {
          const role = roles.find(r => r.id === m.roleId)?.role;
          return ["owner", "admin", "manager", "team_lead"].includes(role || "");
        });
      default:
        return [];
    }
  };

  if (!organization || isLoadingSettings || isLoadingRoles) {
    return (
      <div className="flex items-center justify-center p-8">
        <p>Loading organization settings...</p>
      </div>
    );
  }

  // Get the current user's role
  const currentUserRole = roles.find(r => r.id === user.roleId)?.role;

  // Get available roles based on current user's role
  const getAvailableRoles = () => {
    if (!currentUserRole) return [];

    switch (currentUserRole) {
      case "owner":
        return roles.filter(r => r.role !== "owner");
      case "admin":
        return roles.filter(r => !["owner", "admin"].includes(r.role));
      default:
        return roles.filter(r => r.role === "trainee");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New User</CardTitle>
        <CardDescription>
          {currentUserRole === "owner"
            ? "Create new administrators for your organization"
            : currentUserRole === "admin"
            ? "Create new managers, trainers, or trainees for your organization"
            : "Create new trainee accounts"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = '/api/users/template';
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download CSV Template
            </Button>
            <Label htmlFor="csv-upload" className="cursor-pointer">
              <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                <Upload className="mr-2 h-4 w-4" />
                Upload CSV
              </div>
            </Label>
            <Input
              id="csv-upload"
              type="file"
              className="hidden"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // Handle file upload
                }
              }}
            />
          </div>
        </div>
        <Separator className="my-6" />
        <div>
          <h3 className="text-lg font-medium mb-4">Add Single User</h3>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createUserMutation.mutate(newUserData);
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={newUserData.username}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    username: e.target.value
                  }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={newUserData.fullName}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    fullName: e.target.value
                  }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    email: e.target.value
                  }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="roleId">Role</Label>
                <Select
                  value={newUserData.roleId}
                  onValueChange={(value) => {
                    setNewUserData(prev => ({
                      ...prev,
                      roleId: value,
                      managerId: "none"
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableRoles().map((role) => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        {role.role}
                        <span className="text-muted-foreground ml-2">
                          ({role.description})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="managerId">Reporting Manager</Label>
                <Select
                  value={newUserData.managerId}
                  onValueChange={(value) => setNewUserData(prev => ({
                    ...prev,
                    managerId: value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Manager</SelectItem>
                    {getFilteredManagers(newUserData.roleId).map((manager) => (
                      <SelectItem key={manager.id} value={manager.id.toString()}>
                        {manager.fullName || manager.username}
                        {" "}
                        <span className="text-muted-foreground">
                          ({roles.find(r => r.id === manager.roleId)?.role})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="locationId">Location</Label>
                <Select
                  value={newUserData.locationId}
                  onValueChange={(value) => setNewUserData(prev => ({
                    ...prev,
                    locationId: value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Location</SelectItem>
                    {orgSettings?.locations?.map((location: OrganizationLocation) => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    password: e.target.value
                  }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  value={newUserData.employeeId}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    employeeId: e.target.value
                  }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  value={newUserData.phoneNumber}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    phoneNumber: e.target.value
                  }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dateOfJoining">Date of Joining</Label>
                <Input
                  id="dateOfJoining"
                  type="date"
                  value={newUserData.dateOfJoining}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    dateOfJoining: e.target.value
                  }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={newUserData.dateOfBirth}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    dateOfBirth: e.target.value
                  }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="education">Education</Label>
                <Input
                  id="education"
                  value={newUserData.education}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    education: e.target.value
                  }))}
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full mt-6"
              disabled={createUserMutation.isPending}
            >
              Create User
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}