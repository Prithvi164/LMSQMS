import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { User, Organization, OrganizationLocation, InsertUser, OrganizationBatch, OrganizationProcess } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Type for form data
type UserFormData = {
  username: string;
  fullName: string;
  email: string;
  employeeId: string;
  role: string;
  phoneNumber: string;
  locationId: string | null;
  processId: string | null;
  batchId: string | null;
  managerId: string | null;
  dateOfJoining: string;
  dateOfBirth: string;
  education: string;
};

export function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  // Fetch organization settings to get locations, batches, etc.
  const { data: orgSettings } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/settings`],
    queryFn: async () => {
      if (!user?.organizationId) return null;
      const res = await fetch(`/api/organizations/${user.organizationId}/settings`);
      if (!res.ok) throw new Error('Failed to fetch organization settings');
      return res.json();
    },
    enabled: !!user?.organizationId,
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User deleted successfully",
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

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertUser> }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update user");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User updated successfully",
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

  // Function to toggle user active status
  const toggleUserStatus = async (userId: number, currentStatus: boolean, userRole: string) => {
    try {
      if (userRole === "admin") {
        toast({
          title: "Error",
          description: "Admin users cannot be deactivated",
          variant: "destructive",
        });
        return;
      }
      await updateUserMutation.mutateAsync({
        id: userId,
        data: { active: !currentStatus }
      });
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  };

  // Find manager name for a user
  const getManagerName = (managerId: number | null) => {
    if (!managerId) return "No Manager";
    const manager = users.find(u => u.id === managerId);
    return manager ? (manager.fullName || manager.username) : "Unknown Manager";
  };

  // Find location name for a user
  const getLocationName = (locationId: number | null) => {
    if (!locationId || !orgSettings?.locations) return "No Location";
    const location = orgSettings.locations.find((l: OrganizationLocation) => l.id === locationId);
    return location ? location.name : "Unknown Location";
  };

  // Find batch name for a user
  const getBatchName = (batchId: number | null) => {
    if (!batchId || !orgSettings?.batches) return "No Batch";
    const batch = orgSettings.batches.find((b: OrganizationBatch) => b.id === batchId);
    return batch ? batch.name : "Unknown Batch";
  };

  // Get unique managers for filter dropdown, removing duplicates
  const uniqueManagers = Array.from(
    new Map(
      users
        .filter(u => u.managerId !== null)
        .map(u => {
          const manager = users.find(m => m.id === u.managerId);
          return manager ? [manager.id, { id: manager.id, name: manager.fullName || manager.username }] : null;
        })
        .filter((item): item is [number, { id: number; name: string }] => item !== null)
    ).values()
  );

  // Get unique batches for filter dropdown
  const uniqueBatches = orgSettings?.batches || [];

  // Filter users based on search term and filters
  const filteredUsers = users.filter(u => {
    const matchesSearch = searchTerm === "" ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.fullName?.toLowerCase() || "").includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "all" || u.role === roleFilter;

    const matchesManager = managerFilter === "all" ||
      (managerFilter === "none" && !u.managerId) ||
      (u.managerId?.toString() === managerFilter);

    const matchesBatch = batchFilter === "all" ||
      (batchFilter === "none" && !u.batchId) ||
      (u.batchId?.toString() === batchFilter);

    return matchesSearch && matchesRole && matchesManager && matchesBatch;
  });

  // Create EditUserDialog component to handle the form properly
  const EditUserDialog = ({ user: editUser }: { user: User }) => {
    const form = useForm<UserFormData>({
      resolver: zodResolver(insertUserSchema),
      defaultValues: {
        username: editUser.username,
        fullName: editUser.fullName || "",
        email: editUser.email,
        employeeId: editUser.employeeId || "",
        role: editUser.role,
        phoneNumber: editUser.phoneNumber || "",
        locationId: editUser.locationId?.toString() || null,
        processId: editUser.processId?.toString() || null,
        batchId: editUser.batchId?.toString() || null,
        managerId: editUser.managerId?.toString() || null,
        dateOfJoining: editUser.dateOfJoining || "",
        dateOfBirth: editUser.dateOfBirth || "",
        education: editUser.education || "",
      }
    });

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon">
            <Edit2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update information for {editUser.username}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(async (data) => {
              await updateUserMutation.mutateAsync({
                id: editUser.id,
                data: {
                  ...data,
                  locationId: data.locationId ? parseInt(data.locationId) : null,
                  processId: data.processId ? parseInt(data.processId) : null,
                  batchId: data.batchId ? parseInt(data.batchId) : null,
                  managerId: data.managerId ? parseInt(data.managerId) : null,
                }
              });
            })} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee ID</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="trainee">Trainee</SelectItem>
                          <SelectItem value="trainer">Trainer</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="advisor">Advisor</SelectItem>
                          <SelectItem value="team_lead">Team Lead</SelectItem>
                          {user?.role === "admin" && (
                            <SelectItem value="admin">Admin</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No Location</SelectItem>
                          {orgSettings?.locations.map((location: OrganizationLocation) => (
                            <SelectItem key={location.id} value={location.id.toString()}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="processId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Process</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select process" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No Process</SelectItem>
                          {orgSettings?.processes.map((process: OrganizationProcess) => (
                            <SelectItem key={process.id} value={process.id.toString()}>
                              {process.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="batchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select batch" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No Batch</SelectItem>
                          {orgSettings?.batches.map((batch: OrganizationBatch) => (
                            <SelectItem key={batch.id} value={batch.id.toString()}>
                              {batch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="managerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manager</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No Manager</SelectItem>
                          {uniqueManagers.map((manager) => (
                            <SelectItem key={manager.id} value={manager.id.toString()}>
                              {manager.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateOfJoining"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Joining</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="education"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Education</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit">Save Changes</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage Users</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                  <SelectItem value="trainee">Trainee</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                  <SelectItem value="team_lead">Team Lead</SelectItem>
                </SelectContent>
              </Select>
              <Select value={managerFilter} onValueChange={setManagerFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Managers</SelectItem>
                  <SelectItem value="none">No Manager</SelectItem>
                  {uniqueManagers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id.toString()}>
                      {manager.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  <SelectItem value="none">No Batch</SelectItem>
                  {uniqueBatches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id.toString()}>
                      {batch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow key={u.id} className={!u.active ? "opacity-60" : ""}>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.fullName}</TableCell>
                  <TableCell>
                    <Badge>{u.role}</Badge>
                  </TableCell>
                  <TableCell>{getManagerName(u.managerId)}</TableCell>
                  <TableCell>{getLocationName(u.locationId)}</TableCell>
                  <TableCell>{getBatchName(u.batchId)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={u.active}
                      onCheckedChange={(checked) => toggleUserStatus(u.id, u.active, u.role)}
                      disabled={u.role === "admin"}
                    />
                  </TableCell>
                  <TableCell className="space-x-2">
                    <EditUserDialog user={u} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete User</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this user? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteUserMutation.mutate(u.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}