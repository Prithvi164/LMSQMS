import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { User, Organization, OrganizationProcess, OrganizationLineOfBusiness, OrganizationLocation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Check, FileSpreadsheet, Upload, Download } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions"; // Add permissions hook
import * as XLSX from "xlsx";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table";

interface AddUserProps {
  users: User[];
  user: User;
  organization: Organization | undefined;
  potentialManagers: User[];
}

// Update the bulk upload type to handle multiple processes
type BulkUserUpload = {
  username: string;
  fullName: string;
  email: string;
  role: string;
  reportingManager: string;
  location: string;
  employeeId: string;
  password: string;
  phoneNumber: string;
  dateOfJoining: string;
  dateOfBirth: string;
  education: string;
  processes: Array<{
    process: string;
    lineOfBusiness: string;
  }>;
};

export function AddUser({ users, user, organization, potentialManagers }: AddUserProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedLOBs, setSelectedLOBs] = useState<number[]>([]);
  const [openLOB, setOpenLOB] = useState(false);
  const [openProcess, setOpenProcess] = useState(false);
  const [openManager, setOpenManager] = useState(false);
  const [openLocation, setOpenLocation] = useState(false);
  const [bulkUploadData, setBulkUploadData] = useState<BulkUserUpload[]>([]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    fullName: "",
    employeeId: "",
    role: "advisor",
    category: "active", // Default to active
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
  });

  const { data: locations = [], isLoading: isLoadingLocations } = useQuery<OrganizationLocation[]>({
    queryKey: [`/api/organizations/${organization?.id}/locations`],
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: processes = [], isLoading: isLoadingProcesses } = useQuery<OrganizationProcess[]>({
    queryKey: [`/api/organizations/${organization?.id}/processes`],
    enabled: !!organization?.id && selectedLOBs.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async (users: BulkUserUpload[]) => {
      const response = await apiRequest("POST", "/api/users/bulk", { users });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to bulk upload users");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Users uploaded successfully",
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

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof newUserData) => {
      try {
        if (!data.category) {
          throw new Error("Please select a category (Active or Trainee)");
        }

        // Get the selected location ID
        const locationId = data.locationId !== "none" ? Number(data.locationId) : null;

        // Get the first selected LOB ID when processes are selected
        const lineOfBusinessId = selectedLOBs.length > 0 ? selectedLOBs[0] : null;

        // Create the payload
        const payload = {
          ...data,
          managerId: data.managerId === "none" ? null : Number(data.managerId),
          locationId,
          organizationId: organization?.id || null,
          processes: data.processes,
          lineOfBusinessId
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
        role: "advisor",
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
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Rest of your component logic...
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
    // Filter out advisors and inactive users
    return users.filter(u => u.active && u.role !== 'advisor');
  };

  // Update the template download function
  const downloadTemplate = () => {
    const template = [
      {
        username: "example_user",
        fullName: "Example User",
        email: "user@example.com",
        role: "advisor",
        reportingManager: "manager_username",
        location: "Location Name",
        employeeId: "EMP001",
        password: "password123",
        phoneNumber: "1234567890",
        dateOfJoining: "2024-03-20",
        dateOfBirth: "1990-01-01",
        education: "Bachelor's Degree",
        processes: [
          { process: "Customer Support", lineOfBusiness: "Sales" },
          { process: "Technical Support", lineOfBusiness: "IT" }
          // Add more process columns as needed
        ]
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "user_upload_template.xlsx");
  };


  // Update the file upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

      // Transform the data to match our expected format
      const transformedData: BulkUserUpload[] = rawData.map(row => {
        // Extract all process and lineOfBusiness pairs
        const processes = [];
        let i = 1;
        while (row[`process_${i}`] && row[`lineOfBusiness_${i}`]) {
          processes.push({
            process: row[`process_${i}`],
            lineOfBusiness: row[`lineOfBusiness_${i}`]
          });
          i++;
        }

        // Basic validation of required fields
        if (!row.username || !row.email || !row.role || !row.password) {
          throw new Error(`Row contains missing required fields (username, email, role, or password)`);
        }

        return {
          username: row.username,
          fullName: row.fullName,
          email: row.email,
          role: row.role,
          reportingManager: row.reportingManager,
          location: row.location,
          employeeId: row.employeeId,
          password: row.password,
          phoneNumber: row.phoneNumber,
          dateOfJoining: row.dateOfJoining,
          dateOfBirth: row.dateOfBirth,
          education: row.education,
          processes
        };
      });

      setBulkUploadData(transformedData);
      toast({
        title: "File Uploaded",
        description: `Successfully parsed ${transformedData.length} users`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to parse file",
        variant: "destructive",
      });
    }
  };

  // Check if user has permission to manage users
  if (!hasPermission("manage_users")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add New User</CardTitle>
          <CardDescription className="text-destructive">
            You don't have permission to add new users.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

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
            <CardDescription>Create new user account</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={downloadTemplate}
            >
              Download Template
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowBulkUpload(!showBulkUpload)}
            >
              Bulk Upload
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showBulkUpload && (
          <div className="space-y-4 mb-6">
            <div>
              <h3 className="text-base font-medium mb-2">Bulk Upload Users</h3>
              <p className="text-sm text-muted-foreground mb-4">Upload multiple users using an Excel file</p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="file-upload">Select Excel File</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => bulkUploadMutation.mutate(bulkUploadData)}
                      disabled={bulkUploadData.length === 0 || bulkUploadMutation.isPending}
                    >
                      {bulkUploadMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Uploading...
                        </>
                      ) : (
                        "Upload Users"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Update the preview table to show multiple processes */}
            {bulkUploadData.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Preview: {bulkUploadData.length} users</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBulkUploadData([])}
                  >
                    Clear
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Processes & LOB</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkUploadData.map((user, index) => (
                      <TableRow key={index}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.fullName}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell>{user.location}</TableCell>
                        <TableCell>
                          {user.processes.map((proc, idx) => (
                            <div key={idx} className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="mr-1">
                                {proc.process}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                ({proc.lineOfBusiness})
                              </span>
                            </div>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

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
                    <option value="quality_analyst">Quality Analyst</option>
                    <option value="trainer">Trainer</option>
                    <option value="advisor">Advisor</option>
                  </>
                ) : user.role === "admin" ? (
                  <>
                    <option value="manager">Manager</option>
                    <option value="team_lead">Team Lead</option>
                    <option value="quality_analyst">Quality Analyst</option>
                    <option value="trainer">Trainer</option>
                    <option value="advisor">Advisor</option>
                  </>
                ) : (
                  <>
                    <option value="team_lead">Team Lead</option>
                    <option value="quality_analyst">Quality Analyst</option>
                    <option value="trainer">Trainer</option>
                    <option value="advisor">Advisor</option>
                  </>
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
            <Input
              id="category"
              value={newUserData.role === "manager" ? "Active" : newUserData.category}
              disabled
              className="bg-muted cursor-not-allowed"
            />
            <input
              type="hidden"
              name="category"
              value={newUserData.role === "manager" ? "active" : newUserData.category}
            />
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