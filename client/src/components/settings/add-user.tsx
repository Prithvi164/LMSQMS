import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { User, Organization, OrganizationProcess, OrganizationLineOfBusiness } from "@shared/schema";
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
  const [selectedLOBs, setSelectedLOBs] = useState<number[]>([]);
  const [openLOB, setOpenLOB] = useState(false);
  const [openProcess, setOpenProcess] = useState(false);
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

  // Fetch Line of Businesses with caching configuration
  const { data: lineOfBusinesses = [], isLoading: isLoadingLOB } = useQuery<OrganizationLineOfBusiness[]>({
    queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`],
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    cacheTime: 30 * 60 * 1000, // Keep data in cache for 30 minutes
    onError: (error: any) => {
      console.error('Error fetching Line of Businesses:', error);
      toast({
        title: "Error",
        description: "Failed to load Line of Business data. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Fetch processes for selected LOBs
  const { data: processes = [], isLoading: isLoadingProcesses } = useQuery<OrganizationProcess[]>({
    queryKey: [`/api/organizations/${organization?.id}/processes`, selectedLOBs],
    enabled: !!organization?.id && !['owner', 'admin'].includes(newUserData.role) && selectedLOBs.length > 0,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    onError: (error: any) => {
      console.error('Error fetching Processes:', error);
      toast({
        title: "Error",
        description: "Failed to load Process data. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Get filtered processes based on selected LOBs
  const filteredProcesses = processes.filter(process => 
    selectedLOBs.includes(process.lineOfBusinessId)
  );

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
      setSelectedLOBs([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!organization) {
    return null;
  }

  // Show loading state for initial data fetch
  if (isLoadingLOB) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add New User</CardTitle>
          <CardDescription>Loading organization data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
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
              <select
                id="role"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                value={newUserData.role}
                onChange={(e) => {
                  setNewUserData(prev => ({
                    ...prev,
                    role: e.target.value,
                    managerId: "none",
                    processes: []
                  }));
                  setSelectedLOBs([]);
                }}
              >
                {user.role === "owner" ? (
                  <>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="team_lead">Team Lead</option>
                    <option value="trainer">Trainer</option>
                    <option value="trainee">Trainee</option>
                    <option value="advisor">Advisor</option>
                  </>
                ) : user.role === "admin" ? (
                  <>
                    <option value="manager">Manager</option>
                    <option value="team_lead">Team Lead</option>
                    <option value="trainer">Trainer</option>
                    <option value="trainee">Trainee</option>
                    <option value="advisor">Advisor</option>
                  </>
                ) : (
                  <option value="trainee">Trainee</option>
                )}
              </select>
            </div>

            {/* Line of Business Multi-Select */}
            {!['owner', 'admin'].includes(newUserData.role) && (
              <>
                <div className="col-span-2">
                  <Label>Line of Business</Label>
                  <Popover open={openLOB} onOpenChange={setOpenLOB}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openLOB}
                        className="w-full justify-between"
                      >
                        {selectedLOBs.length > 0
                          ? `${selectedLOBs.length} LOBs selected`
                          : "Select Line of Business"}
                        <Check
                          className={cn(
                            "ml-2 h-4 w-4",
                            selectedLOBs.length > 0 ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search Line of Business..." />
                        <CommandEmpty>No Line of Business found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          {lineOfBusinesses.map((lob) => (
                            <CommandItem
                              key={lob.id}
                              onSelect={() => {
                                setSelectedLOBs(prev => {
                                  const newSelection = prev.includes(lob.id)
                                    ? prev.filter(id => id !== lob.id)
                                    : [...prev, lob.id];
                                  return newSelection;
                                });
                                setNewUserData(prev => ({
                                  ...prev,
                                  processes: []
                                }));
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedLOBs.includes(lob.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {lob.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedLOBs.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedLOBs.map(lobId => {
                        const lob = lineOfBusinesses.find(l => l.id === lobId);
                        return lob ? (
                          <Badge
                            key={lob.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            {lob.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                {/* Process Multi-Select */}
                <div className="col-span-2">
                  <Label>Processes</Label>
                  <Popover open={openProcess} onOpenChange={setOpenProcess}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openProcess}
                        className="w-full justify-between"
                        disabled={selectedLOBs.length === 0}
                      >
                        {newUserData.processes.length > 0
                          ? `${newUserData.processes.length} processes selected`
                          : "Select processes"}
                        <Check
                          className={cn(
                            "ml-2 h-4 w-4",
                            newUserData.processes.length > 0 ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search processes..." />
                        <CommandEmpty>No process found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          {filteredProcesses.map((process) => (
                            <CommandItem
                              key={process.id}
                              onSelect={() => {
                                setNewUserData(prev => {
                                  const newProcesses = prev.processes.includes(process.id)
                                    ? prev.processes.filter(id => id !== process.id)
                                    : [...prev.processes, process.id];
                                  return { ...prev, processes: newProcesses };
                                });
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  newUserData.processes.includes(process.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {process.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedLOBs.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Please select at least one Line of Business first
                    </p>
                  )}
                  {selectedLOBs.length > 0 && filteredProcesses.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      No processes available for selected Line of Business
                    </p>
                  )}
                  {newUserData.processes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {newUserData.processes.map(processId => {
                        const process = processes.find(p => p.id === processId);
                        return process ? (
                          <Badge
                            key={process.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            {process.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Other fields */}
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
              <Label htmlFor="managerId">Reporting Manager</Label>
              <select
                id="managerId"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                value={newUserData.managerId}
                onChange={(e) => setNewUserData(prev => ({
                  ...prev,
                  managerId: e.target.value
                }))}
              >
                <option value="none">No Manager</option>
                {getFilteredManagers(newUserData.role).map((manager) => (
                  <option key={manager.id} value={manager.id.toString()}>
                    {manager.fullName || manager.username} ({manager.role})
                  </option>
                ))}
              </select>
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
      </CardContent>
    </Card>
  );
}