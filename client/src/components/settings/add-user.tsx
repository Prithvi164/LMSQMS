import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { User, Organization, OrganizationLocation, OrganizationProcess, OrganizationLineOfBusiness } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
//import { MultiSelect } from "@/components/ui/multi-select"; // Custom multi-select component - Assuming this is already defined elsewhere.


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
  const [selectedLOB, setSelectedLOB] = useState<string | null>(null);
  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    fullName: "",
    employeeId: "",
    role: "trainee",
    locationId: "none",
    email: "",
    phoneNumber: "",
    education: "",
    dateOfJoining: "",
    dateOfBirth: "",
    managerId: "none",
    processes: [] as number[],
  });

  // Fetch organization settings
  const { data: orgSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/settings`],
    enabled: !!organization?.id,
  });

  // Fetch Line of Businesses
  const { data: lineOfBusinesses = [], isLoading: isLoadingLOB } = useQuery<OrganizationLineOfBusiness[]>({
    queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`],
    enabled: !!organization?.id,
  });

  // Fetch organization processes
  const { data: processes = [], isLoading: isLoadingProcesses } = useQuery<OrganizationProcess[]>({
    queryKey: [`/api/organizations/${organization?.id}/processes`],
    enabled: !!organization?.id && !['owner', 'admin'].includes(newUserData.role),
  });

  // Get filtered processes based on selected LOB
  const filteredProcesses = selectedLOB 
    ? processes.filter(process => process.lineOfBusinessId === parseInt(selectedLOB))
    : processes;

  // Get filtered managers based on role
  const getFilteredManagers = (selectedRole: string) => {
    if (!potentialManagers) return [];

    switch (selectedRole) {
      case "admin":
        return potentialManagers.filter(m => m.role === "owner");
      case "manager":
        return potentialManagers.filter(m => ["owner", "admin"].includes(m.role));
      case "team_lead":
        return potentialManagers.filter(m => ["owner", "admin", "manager"].includes(m.role));
      case "trainer":
        return potentialManagers.filter(m => ["owner", "admin", "manager", "team_lead"].includes(m.role));
      case "trainee":
        return potentialManagers.filter(m => ["owner", "admin", "manager", "team_lead", "trainer"].includes(m.role));
      case "advisor":
        return potentialManagers.filter(m => ["owner", "admin", "manager", "team_lead"].includes(m.role));
      default:
        return [];
    }
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof newUserData) => {
      try {
        const payload = {
          ...data,
          locationId: data.locationId === "none" ? null : Number(data.locationId),
          managerId: data.managerId === "none" ? null : Number(data.managerId),
          organizationId: organization?.id || null,
          processes: data.processes,
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
        role: "trainee",
        locationId: "none",
        email: "",
        phoneNumber: "",
        education: "",
        dateOfJoining: "",
        dateOfBirth: "",
        managerId: "none",
        processes: [],
      });
      setSelectedLOB(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!organization || isLoadingSettings || isLoadingProcesses || isLoadingLOB) {
    return (
      <div className="flex items-center justify-center p-8">
        <p>Loading organization settings...</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New User</CardTitle>
        <CardDescription>
          {user.role === "owner"
            ? "Create new administrators for your organization"
            : user.role === "admin"
            ? "Create new managers, trainers, or trainees for your organization"
            : "Create new trainee accounts"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* CSV Upload Section */}
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
              {/* Basic fields */}
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
                <Label htmlFor="role">Role</Label>
                <Select
                  value={newUserData.role}
                  onValueChange={(value) => {
                    setNewUserData(prev => ({
                      ...prev,
                      role: value,
                      managerId: "none",
                      processes: []
                    }));
                    setSelectedLOB(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {user.role === "owner" ? (
                      <>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="team_lead">Team Lead</SelectItem>
                        <SelectItem value="trainer">Trainer</SelectItem>
                        <SelectItem value="trainee">Trainee</SelectItem>
                        <SelectItem value="advisor">Advisor</SelectItem>
                      </>
                    ) : user.role === "admin" ? (
                      <>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="team_lead">Team Lead</SelectItem>
                        <SelectItem value="trainer">Trainer</SelectItem>
                        <SelectItem value="trainee">Trainee</SelectItem>
                        <SelectItem value="advisor">Advisor</SelectItem>
                      </>
                    ) : (
                      <SelectItem value="trainee">Trainee</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Line of Business and Process Selection */}
              {!['owner', 'admin'].includes(newUserData.role) && (
                <>
                  <div>
                    <Label>Line of Business</Label>
                    <Select
                      value={selectedLOB || ""}
                      onValueChange={(value) => {
                        setSelectedLOB(value);
                        setNewUserData(prev => ({
                          ...prev,
                          processes: [] // Clear selected processes when LOB changes
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Line of Business" />
                      </SelectTrigger>
                      <SelectContent>
                        {lineOfBusinesses.map((lob) => (
                          <SelectItem key={lob.id} value={lob.id.toString()}>
                            {lob.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Processes</Label>
                    <Select
                      value={newUserData.processes.map(String)}
                      onValueChange={(values) => {
                        setNewUserData(prev => ({
                          ...prev,
                          processes: values.map(v => parseInt(v))
                        }));
                      }}
                      multiple
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select processes" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredProcesses.map((process) => (
                          <SelectItem key={process.id} value={process.id.toString()}>
                            {process.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(!selectedLOB && filteredProcesses.length === 0) && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Please select a Line of Business first
                      </p>
                    )}
                    {(selectedLOB && filteredProcesses.length === 0) && (
                      <p className="text-sm text-muted-foreground mt-1">
                        No processes available for this Line of Business
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Other fields */}
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
                    {getFilteredManagers(newUserData.role).map((manager) => (
                      <SelectItem key={manager.id} value={manager.id.toString()}>
                        {manager.fullName || manager.username}
                        {" "}
                        <span className="text-muted-foreground">({manager.role})</span>
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