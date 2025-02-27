import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";



// Process form schema
const processFormSchema = z.object({
  name: z.string().min(1, "Process name is required"),
  inductionDays: z.number().min(0, "Induction days must be 0 or greater"),
  trainingDays: z.number().min(0, "Training days must be 0 or greater"),
  certificationDays: z.number().min(0, "Certification days must be 0 or greater"),
  ojtDays: z.number().min(0, "OJT days must be 0 or greater"),
  ojtCertificationDays: z.number().min(0, "OJT certification days must be 0 or greater"),
  lineOfBusinessId: z.string().min(1, "Line of Business is required"),
  locationId: z.string().min(1, "Location is required"),
  role: z.string().min(1, "Role is required"),
  userIds: z.array(z.string()).min(1, "At least one user must be selected"),
});

export function ProcessDetail() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch organization data with explicit logging
  const { data: organization } = useQuery({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  // Fetch settings including users, locations, etc.
  const { data: orgSettings, isLoading } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/settings`],
    onSuccess: (data) => {
      console.log('=== Organization Settings Data ===');
      console.log('Raw data:', data);
      if (data?.users) {
        console.log('Users array:', data.users);
        console.log('Sample user:', data.users[0]);
        const roles = Array.from(new Set(data.users.map(u => u.role))).filter(Boolean);
        console.log('Available roles:', roles);
      }
    },
    enabled: !!organization?.id,
  });

  // Fetch line of businesses
  const { data: lineOfBusinesses } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`],
    enabled: !!organization?.id,
  });


  // Form definition
  const form = useForm<z.infer<typeof processFormSchema>>({
    resolver: zodResolver(processFormSchema),
    defaultValues: {
      name: "",
      inductionDays: 0,
      trainingDays: 0,
      certificationDays: 0,
      certificationDays: 0,
      ojtDays: 0,
      ojtCertificationDays: 0,
      lineOfBusinessId: "",
      locationId: "",
      role: "",
      userIds: [],
    },
  });

  const editForm = useForm<z.infer<typeof processFormSchema>>({
    resolver: zodResolver(processFormSchema),
    defaultValues: {
      name: "",
      inductionDays: 0,
      trainingDays: 0,
      certificationDays: 0,
      ojtDays: 0,
      ojtCertificationDays: 0,
      lineOfBusinessId: "",
      locationId: "",
      role: "",
      userIds: [],
    },
  });

  // Create process mutation
  const createProcessMutation = useMutation({
    mutationFn: async (data: z.infer<typeof processFormSchema>) => {
      const response = await fetch(`/api/organizations/${organization?.id}/processes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          inductionDays: data.inductionDays,
          trainingDays: data.trainingDays,
          certificationDays: data.certificationDays,
          ojtDays: data.ojtDays,
          ojtCertificationDays: data.ojtCertificationDays,
          lineOfBusinessId: parseInt(data.lineOfBusinessId),
          locationId: parseInt(data.locationId),
          role: data.role,
          userIds: data.userIds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create process');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/settings`] });
      toast({
        title: "Success",
        description: "Process created successfully",
      });
      setIsCreateDialogOpen(false);
      form.reset();
      setSelectedUsers([]);
      setSelectedLocation("");
      setSelectedRole("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Simplified role selection based on all available roles
  const getAvailableRoles = () => {
    if (!orgSettings?.users) return [];
    const roles = new Set(orgSettings.users.map(u => u.role).filter(Boolean));
    return Array.from(roles);
  };

  // Form rendering component for user selection
  const renderUserSelection = () => (
    <div className="space-y-4">
      {/* Location Selection */}
      <FormField
        control={form.control}
        name="locationId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Location</FormLabel>
            <Select
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                setSelectedLocation(value);
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select Location" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {orgSettings?.locations?.map((location) => (
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

      {/* Role Selection */}
      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <Select
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                setSelectedRole(value);
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {getAvailableRoles().map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* User Selection */}
      <FormField
        control={form.control}
        name="userIds"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Select Users</FormLabel>
            <ScrollArea className="h-[200px] border rounded-md p-4">
              <div className="space-y-2">
                {getFilteredUsers().map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 hover:bg-accent rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {user.username[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.username}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{user.role}</Badge>
                          <span>{getLocationName(user.locationId)}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant={selectedUsers.includes(user.id.toString()) ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => {
                        const userId = user.id.toString();
                        const newSelectedUsers = selectedUsers.includes(userId)
                          ? selectedUsers.filter(id => id !== userId)
                          : [...selectedUsers, userId];
                        setSelectedUsers(newSelectedUsers);
                        field.onChange(newSelectedUsers);
                      }}
                    >
                      {selectedUsers.includes(user.id.toString()) ? "Selected" : "Select"}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  // Get filtered users based on location and role
  const getFilteredUsers = () => {
    if (!orgSettings?.users) return [];

    return orgSettings.users.filter(user => {
      const locationMatch = !selectedLocation || user.locationId?.toString() === selectedLocation;
      return locationMatch;
    });
  };


  // Get location name helper
  const getLocationName = (locationId: number | null) => {
    if (!locationId || !orgSettings?.locations) return "";
    const location = orgSettings.locations.find(l => l.id === locationId);
    return location?.name || "";
  };

  // Handle form submission
  const onSubmit = async (data: z.infer<typeof processFormSchema>) => {
    try {
      await createProcessMutation.mutateAsync({
        ...data,
        userIds: selectedUsers,
      });
    } catch (error) {
      console.error("Error creating process:", error);
    }
  };

  const editProcessMutation = useMutation({
    mutationFn: async (data: z.infer<typeof processFormSchema>) => {
      const response = await fetch(
        `/api/organizations/${organization?.id}/processes/${selectedProcess.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            inductionDays: data.inductionDays,
            trainingDays: data.trainingDays,
            certificationDays: data.certificationDays,
            ojtDays: data.ojtDays,
            ojtCertificationDays: data.ojtCertificationDays,
            lineOfBusinessId: parseInt(data.lineOfBusinessId, 10),
            locationId: parseInt(data.locationId, 10),
            userIds: data.userIds
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update process');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/settings`] });
      toast({
        title: "Success",
        description: "Process updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedProcess(null);
      editForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProcessMutation = useMutation({
    mutationFn: async (processId: number) => {
      const response = await fetch(`/api/organizations/${organization?.id}/processes/${processId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete process');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/settings`] });
      toast({
        title: "Success",
        description: "Process deleted successfully",
      });
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onEdit = async (data: z.infer<typeof processFormSchema>) => {
    try {
      await editProcessMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error updating process:", error);
    }
  };

  const handleDelete = async (process: any) => {
    setSelectedProcess(process);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    const expectedConfirmation = `delete-${selectedProcess.name.toLowerCase()}`;
    if (deleteConfirmation.toLowerCase() === expectedConfirmation) {
      deleteProcessMutation.mutate(selectedProcess.id);
    } else {
      toast({
        title: "Error",
        description: "Please type the correct confirmation text",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (process: any) => {
    setSelectedProcess(process);
    editForm.reset({
      name: process.name,
      lineOfBusinessId: process.lineOfBusinessId ? process.lineOfBusinessId.toString() : "",
      locationId: process.locationId ? process.locationId.toString() : "",
      inductionDays: process.inductionDays,
      trainingDays: process.trainingDays,
      certificationDays: process.certificationDays,
      ojtDays: process.ojtDays,
      ojtCertificationDays: process.ojtCertificationDays,
      userIds: process.userIds || [],
      role: "all",
      selectedLocation: "all",
    });
    setIsEditDialogOpen(true);
  };

  const getUserDetails = (userId: number) => {
    const user = orgSettings?.users?.find(u => u.id === userId);
    if (!user) return null;
    const locationName = orgSettings?.locations?.find(l => l.id === user.locationId)?.name || "Unknown Location";
    return {
      id: user.id,
      name: user.fullName || user.username,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      location: locationName,
      initials: (user.fullName || user.username)[0].toUpperCase(),
    };
  };


  if (isLoading) {
    return <div>Loading...</div>;
  }

  const locations = orgSettings?.locations || [];
  const processes = orgSettings?.processes || [];
  const users = orgSettings?.users || [];

  // Filter processes based on search query
  const filteredProcesses = processes.filter((process: any) => {
    const searchStr = searchQuery.toLowerCase();
    const lobName = lineOfBusinesses?.find(lob => lob.id === process.lineOfBusinessId)?.name || "";
    const locationName = locations?.find(l => l.id === process.locationId)?.name || "";

    return (
      process.name.toLowerCase().includes(searchStr) ||
      lobName.toLowerCase().includes(searchStr) ||
      locationName.toLowerCase().includes(searchStr)
    );
  });

  // Add pagination calculations
  const totalPages = Math.ceil(filteredProcesses.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedProcesses = filteredProcesses.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-6">
        <Settings className="h-8 w-8 text-blue-500" />
        <h1 className="text-2xl font-semibold">Process Management</h1>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center mb-6">
            <div className="relative flex-1">
              <Input
                placeholder="Search processes..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8"
              />
            </div>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Process
            </Button>
          </div>

          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Process Name</TableHead>
                  <TableHead>Line of Business</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Assigned Users</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProcesses.map((process) => (
                  <TableRow key={process.id}>
                    <TableCell>{process.name}</TableCell>
                    <TableCell>
                      {lineOfBusinesses?.find(lob => lob.id === process.lineOfBusinessId)?.name}
                    </TableCell>
                    <TableCell>
                      {locations?.find(l => l.id === process.locationId)?.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {process.users?.map((userId: number) => {
                          const userDetails = getUserDetails(userId);
                          if (!userDetails) return null;
                          return (
                            <Badge key={userId} variant="outline" className="mr-1">
                              {userDetails.name} ({userDetails.role})
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(process)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(process)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between py-4">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredProcesses.length)} of {filteredProcesses.length} entries
            </div>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedProcess && (
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Users in {selectedProcess.name}</h2>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Assign Users
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Assign Users to {selectedProcess.name}</DialogTitle>
                    <DialogDescription>
                      Select users to assign to this process.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4">
                    <Select
                      value={selectedLocation}
                      onValueChange={setSelectedLocation}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location to filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        {orgSettings?.locations?.map((location) => (
                          <SelectItem key={location.id} value={location.id.toString()}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={selectedRole}
                      onValueChange={setSelectedRole}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role to filter" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredRoles().map((role) => (
                          <SelectItem key={role} value={role}>
                            {role === "all" ? "All Roles" : role.charAt(0).toUpperCase() + role.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <ScrollArea className="h-[300px]">
                      {getFilteredUsers().map((user) => {
                        const isAssigned = selectedProcess.users?.includes(user.id);
                        const userDisplay = getUserDetails(user.id);
                        return (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-2 hover:bg-accent rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>{userDisplay?.initials}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{userDisplay?.name}</p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{userDisplay?.role}</Badge>
                                  {userDisplay?.employeeId && (
                                    <span className="text-xs text-muted-foreground">
                                      ID: {userDisplay?.employeeId}
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    Location: {userDisplay?.location}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant={isAssigned ? "destructive" : "outline"}
                              size="sm"
                              onClick={async () => {
                                try {
                                  if (isAssigned) {
                                    await fetch(
                                      `/api/organizations/${organization?.id}/processes/${selectedProcess.id}/users/${user.id}`,
                                      { method: "DELETE" }
                                    );
                                  } else {
                                    await fetch(
                                      `/api/organizations/${organization?.id}/processes/${selectedProcess.id}/users`,
                                      {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ userId: user.id }),
                                      }
                                    );
                                  }

                                  queryClient.invalidateQueries({
                                    queryKey: [`/api/organizations/${organization?.id}/settings`],
                                  });

                                  toast({
                                    title: "Success",
                                    description: `User ${isAssigned ? "removed from" : "assigned to"} process successfully`,
                                  });
                                } catch (error) {
                                  toast({
                                    title: "Error",
                                    description: "Failed to update user assignment",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              {isAssigned ? "Remove" : "Assign"}
                            </Button>
                          </div>
                        );
                      })}
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedProcess.users?.map((userId: number) => {
                const userDetails = getUserDetails(userId);
                if (!userDetails) return null;
                return (
                  <Card key={userId} className="bg-muted/50">
                    <CardContent className="flex items-center gap-4 p-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {userDetails.name[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{userDetails.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{userDetails.role}</Badge>
                          {userDetails.employeeId && (
                            <span className="text-xs text-muted-foreground">
                              ID: {userDetails.employeeId}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Location: {userDetails.location}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {userDetails.email}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Process</DialogTitle>
            <DialogDescription>Fill in the process details below.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Process Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Process Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter process name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Other form fields */}
                <FormField
                  control={form.control}
                  name="inductionDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Induction Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trainingDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Training Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="certificationDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Certification Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ojtDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OJT Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ojtCertificationDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OJT Certification Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* LOB Selection */}
                <FormField
                  control={form.control}
                  name="lineOfBusinessId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Line of Business</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Line of Business" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {lineOfBusinesses?.map((lob: any) => (
                            <SelectItem key={lob.id} value={lob.id.toString()}>
                              {lob.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />


                {/* User Selection Section */}
                <div className="col-span-2">
                  <h3 className="text-lg font-semibold mb-4">User Assignment</h3>
                  {renderUserSelection()}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createProcessMutation.isPending}
                >
                  {createProcessMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2h-4 w-4 animate-spin" />
                      Creating Process...
                    </>
                  ) : (
                    "Create Process"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Process</DialogTitle>
            <DialogDescription className="pt-4">
              This action cannot be undone. Please type{" "}
              <span className="font-medium">delete-{selectedProcess?.name.toLowerCase()}</span>{" "}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Type delete confirmation"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="mt-4"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmation("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteProcessMutation.isPending}
            >
              {deleteProcessMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Process"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Process</DialogTitle>
            <DialogDescription>Update the process details below.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium uppercase">ProcessName</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter process name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="lineOfBusinessId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium uppercase">Line of Business</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Line of Business" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {lineOfBusinesses?.map((lob: any) => (
                            <SelectItem key={lob.id} value={lob.id.toString()}>
                              {lob.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium uppercase">Location</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map((location: any) => (
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
                  control={editForm.control}
                  name="inductionDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Induction Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="trainingDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Training Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="certificationDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Certification Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="ojtDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OJT Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="ojtCertificationDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OJT Certification Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="col-span-2 space-y-4">
                  <h3 className="font-medium">User Assignment</h3>

                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by Location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {orgSettings?.locations?.map((location: any) => (
                        <SelectItem key={location.id} value={location.id.toString()}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {getFilteredRoles().map((role) => (
                        <SelectItem key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <ScrollArea className="h-[200px] border rounded-md p-2">
                    <div className="space-y-2">
                      {getFilteredUsers().map((user: any) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 hover:bg-accent rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{user.fullName || user.username}</p>
                            <div className="flex gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline">{user.role}</Badge>
                              <span>{orgSettings?.locations?.find((l: any) => l.id === user.locationId)?.name}</span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant={selectedUsers.includes(user.id.toString()) ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => {
                              const userId = user.id.toString();
                              const newSelectedUsers = selectedUsers.includes(userId)
                                ? selectedUsers.filter(id => id !== userId)
                                : [...selectedUsers, userId];
                              setSelectedUsers(newSelectedUsers);
                              editForm.setValue("userIds", newSelectedUsers);
                            }}
                          >
                            {selectedUsers.includes(user.id.toString()) ? "Selected" : "Select"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={editProcessMutation.isPending}
              >
                {editProcessMutation.isPending ? "Updating..." : "Update Process"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}