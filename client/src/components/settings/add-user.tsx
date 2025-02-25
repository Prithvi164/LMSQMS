import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { User, Organization, OrganizationProcess, OrganizationBatch, OrganizationLocation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
    locationId: "",
    email: "",
    phoneNumber: "",
    processId: "",
    education: "",
    batchId: "",
    dateOfJoining: "",
    dateOfBirth: "",
    managerId: "",
  });

  // States for new item dialogs
  const [newProcess, setNewProcess] = useState("");
  const [newBatch, setNewBatch] = useState("");
  const [newLocation, setNewLocation] = useState("");

  // Fetch organization settings
  const { data: orgSettings, isLoading } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/settings`],
    queryFn: async () => {
      if (!organization?.id) return null;
      const res = await fetch(`/api/organizations/${organization.id}/settings`);
      if (!res.ok) throw new Error('Failed to fetch organization settings');
      return res.json();
    },
    enabled: !!organization?.id,
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof newUserData) => {
      const payload = {
        ...data,
        processId: data.processId ? Number(data.processId) : null,
        batchId: data.batchId ? Number(data.batchId) : null,
        locationId: data.locationId ? Number(data.locationId) : null,
        managerId: data.managerId === "null" ? null : data.managerId ? Number(data.managerId) : null,
        organizationId: organization?.id || null,
      };
      const response = await apiRequest("POST", "/api/users", payload);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      // Reset form
      setNewUserData({
        username: "",
        password: "",
        fullName: "",
        employeeId: "",
        role: "trainee",
        locationId: "",
        email: "",
        phoneNumber: "",
        processId: "",
        education: "",
        batchId: "",
        dateOfJoining: "",
        dateOfBirth: "",
        managerId: "",
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

  // Mutation for adding new items to organization settings
  const updateOrgSettingsMutation = useMutation({
    mutationFn: async ({ type, value }: { type: string, value: string }) => {
      const res = await apiRequest("PATCH", `/api/organizations/${organization?.id}/settings`, {
        type,
        value,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/settings`] });
      toast({
        title: "Success",
        description: "Settings updated successfully",
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

  // Ensure we have access to current organization's data
  if (!organization || isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p>Loading organization settings...</p>
      </div>
    );
  }

  // Filter potential managers to only show those from the same organization
  const organizationManagers = potentialManagers.filter(
    manager => manager.organizationId === organization.id
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New User</CardTitle>
        <CardDescription>
          {user.role === "admin"
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
              createUserMutation.mutate({
                ...newUserData,
                organizationId: organization.id,
              });
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
                <Label htmlFor="role">Role</Label>
                <Select
                  value={newUserData.role}
                  onValueChange={(value) => setNewUserData(prev => ({
                    ...prev,
                    role: value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trainee">Trainee</SelectItem>
                    {user.role === "admin" && (
                      <>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="trainer">Trainer</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="processId">Process Name</Label>
                <div className="flex gap-2">
                  <Select
                    value={newUserData.processId}
                    onValueChange={(value) => setNewUserData(prev => ({
                      ...prev,
                      processId: value
                    }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select process" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgSettings?.processes.map((process: OrganizationProcess) => (
                        <SelectItem key={process.id} value={process.id.toString()}>
                          {process.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Process for {organization.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Process Name</Label>
                          <Input
                            value={newProcess}
                            onChange={(e) => setNewProcess(e.target.value)}
                          />
                        </div>
                        <Button
                          onClick={() => {
                            if (newProcess) {
                              updateOrgSettingsMutation.mutate({
                                type: "processNames",
                                value: newProcess,
                              });
                              setNewProcess("");
                            }
                          }}
                        >
                          Add Process
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div>
                <Label htmlFor="batchId">Batch Name</Label>
                <div className="flex gap-2">
                  <Select
                    value={newUserData.batchId}
                    onValueChange={(value) => setNewUserData(prev => ({
                      ...prev,
                      batchId: value
                    }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgSettings?.batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id.toString()}>
                          {batch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Batch for {organization.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Batch Name</Label>
                          <Input
                            value={newBatch}
                            onChange={(e) => setNewBatch(e.target.value)}
                          />
                        </div>
                        <Button
                          onClick={() => {
                            if (newBatch) {
                              updateOrgSettingsMutation.mutate({
                                type: "batchNames",
                                value: newBatch,
                              });
                              setNewBatch("");
                            }
                          }}
                        >
                          Add Batch
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div>
                <Label htmlFor="locationId">Location</Label>
                <div className="flex gap-2">
                  <Select
                    value={newUserData.locationId}
                    onValueChange={(value) => setNewUserData(prev => ({
                      ...prev,
                      locationId: value
                    }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgSettings?.locations.map((location) => (
                        <SelectItem key={location.id} value={location.id.toString()}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Location for {organization.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Location Name</Label>
                          <Input
                            value={newLocation}
                            onChange={(e) => setNewLocation(e.target.value)}
                          />
                        </div>
                        <Button
                          onClick={() => {
                            if (newLocation) {
                              updateOrgSettingsMutation.mutate({
                                type: "locations",
                                value: newLocation,
                              });
                              setNewLocation("");
                            }
                          }}
                        >
                          Add Location
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {user.role === "admin" && (
                <div>
                  <Label htmlFor="managerId">Manager</Label>
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
                      <SelectItem value="null">No Manager</SelectItem>
                      {organizationManagers.map((manager) => (
                        <SelectItem key={manager.id} value={String(manager.id)}>
                          {manager.fullName || manager.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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