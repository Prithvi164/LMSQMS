import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, X, Loader2, FileDown, Upload } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { User, Organization, OrganizationProcess, OrganizationLineOfBusiness, OrganizationLocation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AddUserProps {
  users: User[];
  user: User;
  organization: Organization | undefined;
  potentialManagers: User[];
}

export function AddUser({ users, user, organization, potentialManagers }: AddUserProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLOBs, setSelectedLOBs] = useState<number[]>([]);
  const [openLOB, setOpenLOB] = useState(false);
  const [openProcess, setOpenProcess] = useState(false);
  const [openManager, setOpenManager] = useState(false);
  const [openLocation, setOpenLocation] = useState(false);

  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    fullName: "",
    employeeId: "",
    role: "trainee",
    category: "",
    email: "",
    phoneNumber: "",
    education: "",
    dateOfJoining: "",
    dateOfBirth: "",
    managerId: "none",
    locationId: "none",
    processes: [] as number[],
  });

  const { data: lineOfBusinesses = [], isLoading: isLoadingLOB } = useQuery<OrganizationLineOfBusiness[]>({
    queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`],
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    onError: (error: any) => {
      console.error('Error fetching Line of Businesses:', error);
      toast({
        title: "Error",
        description: "Failed to load Line of Business data. Please try again.",
        variant: "destructive",
      });
    }
  });

  const { data: locations = [], isLoading: isLoadingLocations } = useQuery<OrganizationLocation[]>({
    queryKey: [`/api/organizations/${organization?.id}/locations`],
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to load Location data. Please try again.",
        variant: "destructive",
      });
    }
  });

  const { data: processes = [], isLoading: isLoadingProcesses } = useQuery<OrganizationProcess[]>({
    queryKey: [`/api/organizations/${organization?.id}/processes`],
    enabled: !!organization?.id && selectedLOBs.length > 0,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to load Process data. Please try again.",
        variant: "destructive",
      });
    }
  });

  const filteredProcesses = processes.filter(process =>
    selectedLOBs.includes(process.lineOfBusinessId)
  );

  const clearLOBSelections = () => {
    setSelectedLOBs([]);
    setNewUserData(prev => ({
      ...prev,
      processes: []
    }));
    setOpenLOB(false);
  };

  const getFilteredManagers = () => {
    if (!users) return [];
    return users.filter(u => u.active);
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof newUserData) => {
      try {
        if (!data.category) {
          throw new Error("Please select a category (Active or Trainee)");
        }

        let locationId = null;
        if (data.locationId !== "none") {
          const locationExists = locations.some(l => l.id.toString() === data.locationId);
          if (!locationExists) {
            throw new Error("Selected location is invalid");
          }
          locationId = Number(data.locationId);
        }

        const payload = {
          ...data,
          managerId: data.managerId === "none" ? null : Number(data.managerId),
          locationId,
          organizationId: organization?.id || null,
          processes: data.processes,
        };

        console.log('Creating user with payload:', payload);

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
        category: "",
        email: "",
        phoneNumber: "",
        education: "",
        dateOfJoining: "",
        dateOfBirth: "",
        managerId: "none",
        locationId: "none",
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

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/users/template', {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      // Get array buffer from response
      const arrayBuffer = await response.arrayBuffer();

      // Create blob with correct MIME type
      const blob = new Blob([arrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Create object URL
      const url = window.URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = 'user_upload_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error downloading template:', error);
      toast({
        title: "Error",
        description: "Failed to download template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const bulkUploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      try {
        const response = await apiRequest("POST", "/api/users/upload", formData);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to upload users");
        }
        return response.json();
      } catch (error: any) {
        console.error('Error uploading users:', error);
        throw new Error(error.message || "An unexpected error occurred");
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Users uploaded successfully. Process mappings have been applied.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await bulkUploadMutation.mutateAsync(formData);
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  if (!organization) {
    return null;
  }

  if (isLoadingLOB || isLoadingLocations) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add New User</CardTitle>
          <CardDescription>Loading organization data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Add New User</CardTitle>
            <CardDescription>Create new user account or bulk upload users</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" />
              Download Template
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={bulkUploadMutation.isPending}
              />
              <Button
                variant="outline"
                className="flex items-center gap-2"
                disabled={bulkUploadMutation.isPending}
              >
                {bulkUploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Bulk Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          <p>The template contains two sheets:</p>
          <ul className="list-disc list-inside ml-4 mt-1">
            <li>Users: Add basic user information</li>
            <li>Process Mappings: Map users to processes using their email</li>
          </ul>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createUserMutation.mutate(newUserData);
          }}
        >
          <div className="grid grid-cols-2 gap-4">
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

            <div>
              <Label htmlFor="managerId">Reporting Manager</Label>
              <Popover open={openManager} onOpenChange={setOpenManager}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openManager}
                    className="w-full justify-between"
                  >
                    {newUserData.managerId === "none"
                      ? "Select manager..."
                      : getFilteredManagers().find(m => m.id.toString() === newUserData.managerId)
                        ? `${getFilteredManagers().find(m => m.id.toString() === newUserData.managerId)?.fullName}`
                        : "Select manager..."}
                    <Check
                      className={cn(
                        "ml-2 h-4 w-4",
                        newUserData.managerId !== "none" ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Search manager..." />
                    <CommandEmpty>No manager found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setNewUserData(prev => ({ ...prev, managerId: "none" }));
                          setOpenManager(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            newUserData.managerId === "none" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        No Manager
                      </CommandItem>
                      {getFilteredManagers().map((manager) => (
                        <CommandItem
                          key={manager.id}
                          onSelect={() => {
                            setNewUserData(prev => ({
                              ...prev,
                              managerId: manager.id.toString()
                            }));
                            setOpenManager(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              newUserData.managerId === manager.id.toString() ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {manager.fullName} ({manager.role})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="locationId">Location</Label>
              <Popover open={openLocation} onOpenChange={setOpenLocation}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openLocation}
                    className="w-full justify-between"
                  >
                    {newUserData.locationId === "none"
                      ? "Select location..."
                      : locations.find(l => l.id.toString() === newUserData.locationId)?.name || "Select location..."}
                    <Check
                      className={cn(
                        "ml-2 h-4 w-4",
                        newUserData.locationId !== "none" ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Search location..." />
                    <CommandEmpty>No location found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setNewUserData(prev => ({ ...prev, locationId: "none" }));
                          setOpenLocation(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            newUserData.locationId === "none" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        No Location
                      </CommandItem>
                      {locations.map((location) => (
                        <CommandItem
                          key={location.id}
                          onSelect={() => {
                            setNewUserData(prev => ({
                              ...prev,
                              locationId: location.id.toString()
                            }));
                            setOpenLocation(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              newUserData.locationId === location.id.toString() ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {location.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
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

            <div className="col-span-2">
              <Label>Line of Business</Label>
              <div className="flex gap-2">
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
              </div>
            </div>

            {selectedLOBs.length > 0 && (
              <div className="col-span-2">
                <Label>Processes</Label>
                <Popover open={openProcess} onOpenChange={setOpenProcess}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openProcess}
                      className="w-full justify-between"
                    >
                      {isLoadingProcesses ? (
                        <div className="flex items-center">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Loading processes...
                        </div>
                      ) : (
                        <>
                          {newUserData.processes.length > 0
                            ? `${newUserData.processes.length} processes selected`
                            : "Select processes"}
                          <Check
                            className={cn(
                              "ml-2 h-4 w-4",
                              newUserData.processes.length > 0 ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </>
                      )}
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
                            <span className="ml-2 text-muted-foreground">
                              ({lineOfBusinesses.find(l => l.id === process.lineOfBusinessId)?.name})
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

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

          <div>
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              value={newUserData.category}
              onChange={(e) => setNewUserData(prev => ({
                ...prev,
                category: e.target.value
              }))}
              required
            >
              <option value="">Select category</option>
              <option value="active">Active</option>
              <option value="trainee">Trainee</option>
            </select>
          </div>

          <Button
            type="submit"
            className="w-full mt-6"
            disabled={createUserMutation.isPending}
          >
            {createUserMutation.isPending ? (
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating User...
              </div>
            ) : (
              "Create User"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}