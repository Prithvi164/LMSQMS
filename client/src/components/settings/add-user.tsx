import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User, Organization, OrganizationProcess, OrganizationBatch, OrganizationLocation } from "@shared/schema";
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
    role: "trainee",
    locationId: "none",
    email: "",
    phoneNumber: "",
    processId: "none",
    education: "",
    batchId: "none",
    dateOfJoining: "",
    dateOfBirth: "",
    managerId: "none",
  });

  // For multiple selections
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [processComboOpen, setProcessComboOpen] = useState(false);
  const [batchComboOpen, setBatchComboOpen] = useState(false);

  // Fetch organization settings
  const { data: orgSettings, isLoading } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/settings`],
    enabled: !!organization?.id,
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof newUserData) => {
      try {
        const isManagerOrTrainer = ["manager", "trainer"].includes(data.role);

        const payload = {
          ...data,
          processId: isManagerOrTrainer ? null : data.processId === "none" ? null : Number(data.processId),
          batchId: isManagerOrTrainer ? null : data.batchId === "none" ? null : Number(data.batchId),
          locationId: data.locationId === "none" ? null : Number(data.locationId),
          managerId: data.managerId === "none" ? null : Number(data.managerId),
          organizationId: organization?.id || null,
          // Add arrays for multiple selections
          processes: isManagerOrTrainer ? selectedProcesses.map(id => Number(id)) : [],
          batches: isManagerOrTrainer ? selectedBatches.map(id => Number(id)) : [],
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
        processId: "none",
        education: "",
        batchId: "none",
        dateOfJoining: "",
        dateOfBirth: "",
        managerId: "none",
      });
      setSelectedProcesses([]);
      setSelectedBatches([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadUsersMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiRequest("POST", "/api/users/upload", formData);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Complete",
        description: `Successfully added ${data.success} users. ${data.failures.length > 0 ?
          `Failed to add ${data.failures.length} users.` : ''}`,
        variant: data.failures.length > 0 ? "destructive" : "default"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

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

  const isManagerOrTrainer = ["manager", "trainer"].includes(newUserData.role);

  if (!organization || isLoading) {
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
                  uploadUsersMutation.mutate(file);
                }
              }}
            />
          </div>
          {uploadUsersMutation.isPending && (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
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
                <p className="text-sm text-muted-foreground mt-1">
                  {newUserData.role && getFilteredManagers(newUserData.role).length === 0 && 
                    "No eligible managers available for the selected role"}
                </p>
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={newUserData.role}
                  onValueChange={(value) => {
                    // Reset manager and selections when role changes
                    setNewUserData(prev => ({
                      ...prev,
                      role: value,
                      managerId: "none",
                      processId: "none",
                      batchId: "none"
                    }));
                    setSelectedProcesses([]);
                    setSelectedBatches([]);
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
              <div>
                <Label htmlFor="processes">
                  {isManagerOrTrainer ? "Managed Processes" : "Process"}
                </Label>
                {isManagerOrTrainer ? (
                  <Popover open={processComboOpen} onOpenChange={setProcessComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={processComboOpen}
                        className="w-full justify-between"
                      >
                        {selectedProcesses.length > 0
                          ? `${selectedProcesses.length} process${selectedProcesses.length > 1 ? 'es' : ''} selected`
                          : "Select processes..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search processes..." />
                        <CommandEmpty>No process found.</CommandEmpty>
                        <CommandGroup>
                          {orgSettings?.processes?.map((process: OrganizationProcess) => (
                            <CommandItem
                              key={process.id}
                              onSelect={() => {
                                const value = process.id.toString();
                                setSelectedProcesses(current =>
                                  current.includes(value)
                                    ? current.filter(x => x !== value)
                                    : [...current, value]
                                );
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedProcesses.includes(process.id.toString()) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {process.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Select
                    value={newUserData.processId}
                    onValueChange={(value) => setNewUserData(prev => ({
                      ...prev,
                      processId: value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select process" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Process</SelectItem>
                      {orgSettings?.processes?.map((process: OrganizationProcess) => (
                        <SelectItem key={process.id} value={process.id.toString()}>
                          {process.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label htmlFor="batches">
                  {isManagerOrTrainer ? "Managed Batches" : "Batch"}
                </Label>
                {isManagerOrTrainer ? (
                  <Popover open={batchComboOpen} onOpenChange={setBatchComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={batchComboOpen}
                        className="w-full justify-between"
                      >
                        {selectedBatches.length > 0
                          ? `${selectedBatches.length} batch${selectedBatches.length > 1 ? 'es' : ''} selected`
                          : "Select batches..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search batches..." />
                        <CommandEmpty>No batch found.</CommandEmpty>
                        <CommandGroup>
                          {orgSettings?.batches?.map((batch: OrganizationBatch) => (
                            <CommandItem
                              key={batch.id}
                              onSelect={() => {
                                const value = batch.id.toString();
                                setSelectedBatches(current =>
                                  current.includes(value)
                                    ? current.filter(x => x !== value)
                                    : [...current, value]
                                );
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedBatches.includes(batch.id.toString()) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {batch.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Select
                    value={newUserData.batchId}
                    onValueChange={(value) => setNewUserData(prev => ({
                      ...prev,
                      batchId: value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Batch</SelectItem>
                      {orgSettings?.batches?.map((batch: OrganizationBatch) => (
                        <SelectItem key={batch.id} value={batch.id.toString()}>
                          {batch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
            {isManagerOrTrainer && (selectedProcesses.length > 0 || selectedBatches.length > 0) && (
              <div className="mt-4 space-y-2">
                {selectedProcesses.length > 0 && (
                  <div>
                    <Label>Selected Processes</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedProcesses.map(id => {
                        const process = orgSettings?.processes?.find((p: OrganizationProcess) => p.id.toString() === id);
                        return process ? (
                          <Badge key={id} variant="secondary" className="text-sm">
                            {process.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
                {selectedBatches.length > 0 && (
                  <div>
                    <Label>Selected Batches</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedBatches.map(id => {
                        const batch = orgSettings?.batches?.find((b: OrganizationBatch) => b.id.toString() === id);
                        return batch ? (
                          <Badge key={id} variant="secondary" className="text-sm">
                            {batch.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
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