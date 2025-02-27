import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Check,
  ChevronsUpDown,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Search,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Schema for process form with user selection
const processFormSchema = z.object({
  name: z.string().min(1, "Process name is required"),
  inductionDays: z.number().min(0, "Induction days cannot be negative"),
  trainingDays: z.number().min(0, "Training days cannot be negative"),
  certificationDays: z.number().min(0, "Certification days cannot be negative"),
  ojtDays: z.number().min(0, "OJT days cannot be negative"),
  ojtCertificationDays: z.number().min(0, "OJT certification days cannot be negative"),
  lineOfBusinessId: z.string().min(1, "Line of business is required"),
  locationId: z.string().min(1, "Location is required"),
  selectedRole: z.string().min(1, "Role selection is required"),
  selectedLocation: z.string().optional(),
  userIds: z.array(z.string()).optional(),
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
  const [userComboOpen, setUserComboOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch all necessary data
  const { data: organization } = useQuery({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  const { data: orgSettings, isLoading } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/settings`],
    enabled: !!organization?.id,
  });

  const { data: lineOfBusinesses } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`],
    enabled: !!organization?.id,
  });

  // Get filtered users based on role and location
  const getFilteredUsers = (role: string, locationId: string) => {
    if (!orgSettings?.users) return [];

    console.log('Filtering users:', {
      allUsers: orgSettings.users,
      selectedRole: role,
      selectedLocation: locationId
    });

    return orgSettings.users.filter(u => {
      const roleMatch = role === "all" ? 
        ["trainer", "trainee", "team_lead"].includes(u.role) : 
        u.role === role;

      const locationMatch = locationId === "all" ? 
        true : 
        u.locationId?.toString() === locationId;

      return roleMatch && locationMatch;
    });
  };

  const availableRoles = ["all", "trainer", "trainee", "team_lead"];

  // Get location name helper
  const getLocationName = (locationId: number | null) => {
    if (!locationId || !orgSettings?.locations) return "No Location";
    const location = orgSettings.locations.find(l => l.id === locationId);
    return location ? location.name : "Unknown Location";
  };

  // User detail formatting helper
  const formatUserForDisplay = (user: any) => ({
    id: user.id,
    name: user.fullName || user.username,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    location: getLocationName(user.locationId),
    initials: (user.fullName || user.username)[0].toUpperCase()
  });

  const form = useForm<z.infer<typeof processFormSchema>>({
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
      selectedRole: "all",
      selectedLocation: "all",
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
      selectedRole: "all",
      selectedLocation: "all",
      userIds: [],
    },
  });

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

  const createProcessMutation = useMutation({
    mutationFn: async (data: z.infer<typeof processFormSchema>) => {
      try {
        const response = await fetch(`/api/organizations/${organization?.id}/processes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            lineOfBusinessId: parseInt(data.lineOfBusinessId),
            locationId: parseInt(data.locationId),
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create process');
        }

        const process = await response.json();

        if (data.userIds?.length) {
          await Promise.all(
            data.userIds.map(userId =>
              fetch(`/api/organizations/${organization?.id}/processes/${process.id}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: parseInt(userId) }),
              })
            )
          );
        }

        return process;
      } catch (error) {
        console.error('Error creating process:', error);
        throw error;
      }
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
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
      selectedRole: "all",
      selectedLocation: "all",
    });
    setIsEditDialogOpen(true);
  };

  const apiRequest = async (method: string, url: string, body?: any) => {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `API request failed: ${response.status}`);
    }
    return response.json();
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
        <h1 className="text-2xl font-semibold">Manage Process</h1>
      </div>

      {/* Process List Card */}
      <Card>
        <CardContent className="p-6">
          {/* Search and Add Process Button */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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

          {/* Process Table */}
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

          {/* Pagination */}
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

      {/* Selected Process Users Card */}
      {selectedProcess && (
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-muted-foreground" />
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

                  {/* User Assignment Content */}
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
                        {availableRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role === "all" ? "All Roles" : role.charAt(0).toUpperCase() + role.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <ScrollArea className="h-[300px]">
                      {getFilteredUsers(selectedRole, selectedLocation).map((user) => {
                        const isAssigned = selectedProcess.users?.includes(user.id);
                        const userDisplay = formatUserForDisplay(user);
                        return (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-2 hover:bg-accent rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>{userDisplay.initials}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{userDisplay.name}</p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{userDisplay.role}</Badge>
                                  {userDisplay.employeeId && (
                                    <span className="text-xs text-muted-foreground">
                                      ID: {userDisplay.employeeId}
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    Location: {userDisplay.location}
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
                                    await apiRequest(
                                      "DELETE",
                                      `/api/organizations/${organization?.id}/processes/${selectedProcess.id}/users/${user.id}`
                                    );
                                  } else {
                                    await apiRequest(
                                      "POST",
                                      `/api/organizations/${organization?.id}/processes/${selectedProcess.id}/users`,
                                      { userId: user.id }
                                    );
                                  }

                                  queryClient.invalidateQueries({
                                    queryKey: [`/api/organizations/${organization?.id}/settings`]
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

            {/* Display Assigned Users */}
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

      {/* Create Process Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Process</DialogTitle>
            <DialogDescription>Fill in the details below to create a new process.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Process Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map((location) => (
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
                  name="selectedLocation"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Filter Users by Location</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedLocation(value);
                          setSelectedUsers([]); // Clear selected users when location changes
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select location to filter users" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Locations</SelectItem>
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
                <FormField
                  control={form.control}
                  name="selectedRole"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Filter Users by Role</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedRole(value);
                          setSelectedUsers([]); // Clear selected users when role changes
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role to filter users" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role === "all" ? "All Roles" : role.charAt(0).toUpperCase() + role.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Updated User Selection */}
                <FormField
                  control={form.control}
                  name="userIds"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Select Users</FormLabel>
                      <FormControl>
                        <Popover open={userComboOpen} onOpenChange={setUserComboOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={userComboOpen}
                              className="w-full justify-between"
                            >
                              {selectedUsers.length > 0
                                ? `${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''} selected`
                                : "Select users..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0">
                            <Command>
                              <CommandInput placeholder="Search users..." />
                              <CommandEmpty>No users found.</CommandEmpty>
                              <CommandGroup>
                                {getFilteredUsers(selectedRole, selectedLocation).map((user) => {
                                  const userDisplay = formatUserForDisplay(user);
                                  const isSelected = selectedUsers.includes(user.id.toString());

                                  return (
                                    <CommandItem
                                      key={user.id}
                                      onSelect={() => {
                                        const value = user.id.toString();
                                        setSelectedUsers(current =>
                                          current.includes(value)
                                            ? current.filter(x => x !== value)
                                            : [...current, value]
                                        );
                                      }}
                                      className="flex items-center justify-between py-2"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                          <AvatarFallback>{userDisplay.initials}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                          <span className="font-medium">{userDisplay.name}</span>
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{userDisplay.email}</span>
                                            {userDisplay.employeeId && (
                                              <span>({userDisplay.employeeId})</span>
                                            )}
                                            <span>{userDisplay.location}</span>
                                          </div>
                                        </div>
                                      </div>
                                      <Check
                                        className={cn(
                                          "ml-auto h-4 w-4",
                                          isSelected ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Display selected users */}
                {selectedUsers.length > 0 && (
                  <div className="col-span-2">
                    <Label className="text-sm font-medium">Selected Users</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedUsers.map(id => {
                        const user = orgSettings?.users?.find(u => u.id.toString() === id);
                        if (!user) return null;
                        const userDisplay = formatUserForDisplay(user);

                        return (
                          <Badge
                            key={id}
                            variant="secondary"
                            className="flex items-center gap-2 px-3 py-1"
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-xs">
                                {userDisplay.initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span>{userDisplay.name}</span>
                              <div className="flex items-center gap-1 text-xs">
                                <Badge variant="outline" className="text-xs">
                                  {userDisplay.role}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {userDisplay.location}
                                </span>
                              </div>
                            </div>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

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
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createProcessMutation.isPending}
              >
                {createProcessMutation.isPending ? "Creating..." : "Create Process"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Process Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md"><DialogHeader>
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

      {/* Edit Process Dialog */}
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
                          {locations.map((location) => (
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
                  name="selectedLocation"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Filter Users by Location</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedLocation(value);
                          setSelectedUsers([]); // Clear selected users when location changes
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select location to filter users" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Locations</SelectItem>
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
                <FormField
                  control={editForm.control}
                  name="selectedRole"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Filter Users by Role</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedRole(value);
                          setSelectedUsers([]);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role to filter users" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role === "all" ? "All Roles" : role.charAt(0).toUpperCase() + role.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Updated User Selection */}
                <FormField
                  control={editForm.control}
                  name="userIds"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Select Users</FormLabel>
                      <FormControl>
                        <Popover open={userComboOpen} onOpenChange={setUserComboOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={userComboOpen}
                              className="w-full justify-between"
                            >
                              {selectedUsers.length > 0
                                ? `${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''} selected`
                                : "Select users..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0">
                            <Command>
                              <CommandInput placeholder="Search users..." />
                              <CommandEmpty>No users found.</CommandEmpty>
                              <CommandGroup>
                                {getFilteredUsers(selectedRole, selectedLocation).map((user) => {
                                  const userDisplay = formatUserForDisplay(user);
                                  const isSelected = selectedUsers.includes(user.id.toString());

                                  return (
                                    <CommandItem
                                      key={user.id}
                                      onSelect={() => {
                                        const value = user.id.toString();
                                        setSelectedUsers(current =>
                                          current.includes(value)
                                            ? current.filter(x => x !== value)
                                            : [...current, value]
                                        );
                                      }}
                                      className="flex items-center justify-between py-2"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                          <AvatarFallback>{userDisplay.initials}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                          <span className="font-medium">{userDisplay.name}</span>
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{userDisplay.email}</span>
                                            {userDisplay.employeeId && (
                                              <span>({userDisplay.employeeId})</span>
                                            )}
                                            <span>{userDisplay.location}</span>
                                          </div>
                                        </div>
                                      </div>
                                      <Check
                                        className={cn(
                                          "ml-auto h-4 w-4",
                                          isSelected ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Display selected users */}
                {selectedUsers.length > 0 && (
                  <div className="col-span-2">
                    <Label className="text-sm font-medium">Selected Users</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedUsers.map(id => {
                        const user = orgSettings?.users?.find(u => u.id.toString() === id);
                        if (!user) return null;
                        const userDisplay = formatUserForDisplay(user);

                        return (
                          <Badge
                            key={id}
                            variant="secondary"
                            className="flex items-center gap-2 px-3 py-1"
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-xs">
                                {userDisplay.initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span>{userDisplay.name}</span>
                              <div className="flex items-center gap-1 text-xs">
                                <Badge variant="outline" className="text-xs">
                                  {userDisplay.role}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {userDisplay.location}
                                </span>
                              </div>
                            </div>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

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