import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { User, Organization, OrganizationLocation, UserProcess, OrganizationLineOfBusiness, OrganizationProcess } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Search, Download, Upload, FileSpreadsheet, Check, Loader2, Users, Network, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import * as XLSX from "xlsx";
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
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  getReportingChainUsers, 
  canEditUser, 
  isSubordinate, 
  getFormattedReportingPath
} from "@/lib/hierarchy-utils";
import { HierarchicalUserRow } from "./hierarchical-user-row";

// Extend the insertUserSchema for the edit form
const editUserSchema = insertUserSchema.extend({
  locationId: z.string().optional(),
  managerId: z.string().optional(),
  dateOfJoining: z.string().optional(),
  dateOfBirth: z.string().optional(),
  education: z.string().optional(),
  category: z.string(),
  processes: z.array(z.number()).optional(),
}).omit({ certified: true }).partial();

type UserFormData = z.infer<typeof editUserSchema>;

export function UserManagement() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'flat' | 'hierarchy'>('hierarchy');
  const [expandedManagers, setExpandedManagers] = useState<number[]>([]);
  const [showHierarchicalFilter, setShowHierarchicalFilter] = useState<boolean>(false);
  
  // Auto-expand current user's node when switching to hierarchical view
  useEffect(() => {
    if (viewMode === 'hierarchy' && user?.id && !expandedManagers.includes(user.id)) {
      setExpandedManagers(prev => [...prev, user.id]);
    }
  }, [viewMode, user?.id]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Number of items to show per page

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      try {
        console.log('Attempting to deactivate user:', userId);
        const response = await apiRequest("DELETE", `/api/users/${userId}`);
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.message || "Failed to deactivate user");
        }

        if (!data?.success) {
          throw new Error(data?.message || "User deactivation failed");
        }

        return data;
      } catch (error) {
        console.error('Error in deactivate mutation:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "User deactivated successfully",
      });

      // Force refetch the users list
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.refetchQueries({ queryKey: ["/api/users"] });

      // Reset UI state
      setShowDeleteDialog(false);
      setUserToDelete(null);
      setDeleteConfirmation("");

      // Reset to first page if current page becomes empty
      if (currentUsers.length === 1 && currentPage > 1) {
        setCurrentPage(1);
      }
    },
    onError: (error: Error) => {
      console.error('Deactivate mutation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate user. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<User> }) => {
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

  // Function to toggle user status
  const toggleUserStatus = async (userId: number, currentStatus: boolean, userRole: string) => {
    try {
      if (userRole === "owner") {
        toast({
          title: "Error",
          description: "Owner status cannot be changed",
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

  // Add exportToExcel function after toggleUserStatus
  const exportToExcel = () => {
    try {
      // First sheet with user details
      const usersDataToExport = users.map(user => ({
        'User ID': user.id,
        Username: user.username,
        'Full Name': user.fullName || '',
        Email: user.email,
        'Employee ID': user.employeeId || '',
        Role: user.role,
        'Phone Number': user.phoneNumber || '',
        Location: getLocationName(user.locationId),
        Manager: getManagerName(user.managerId),
        'Date of Joining': user.dateOfJoining || '',
        'Date of Birth': user.dateOfBirth || '',
        Education: user.education || '',
        Status: user.active ? 'Active' : 'Inactive'
      }));

      // Second sheet with process details
      const processDataToExport = users.map(user => {
        const userProcessList = Array.isArray(userProcesses[user.id]) ? userProcesses[user.id] : [];
        return {
          'User ID': user.id,
          Username: user.username,
          'Full Name': user.fullName || '',
          Email: user.email,
          'Employee ID': user.employeeId || '',
          'Processes': userProcessList.map((p: any) => p.processName || '').join(", ") || "No processes",
          'Process Count': userProcessList.length,
          'Process IDs': userProcessList.map((p: any) => p.processId || '').join(", ") || "",
          'Line of Business': userProcessList.map((p: any) => p.lineOfBusinessName || "").join(", ") || "",
          Status: user.active ? 'Active' : 'Inactive'
        };
      });

      // Create workbook and add the user details sheet
      const wb = XLSX.utils.book_new();
      const wsUsers = XLSX.utils.json_to_sheet(usersDataToExport);
      XLSX.utils.book_append_sheet(wb, wsUsers, "Users");
      
      // Add the process details sheet
      const wsProcesses = XLSX.utils.json_to_sheet(processDataToExport);
      XLSX.utils.book_append_sheet(wb, wsProcesses, "User Processes");
      
      // Save the file
      XLSX.writeFile(wb, `users_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      // Show success toast
      toast({
        title: "Export Successful",
        description: "User details and process information have been exported to Excel.",
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting the data. Please try again.",
        variant: "destructive"
      });
    }
  };


  // Find manager name for a user
  const getManagerName = (managerId: number | null) => {
    if (!managerId) return "No Manager";
    const manager = users.find(u => u.id === managerId);
    return manager ? manager.fullName || manager.username : "Unknown Manager";
  };

  // Find location name for a user
  const getLocationName = (locationId: number | null) => {
    if (!locationId) return "No Location";
    
    // First try from the dedicated locations array (from separate query)
    if (locations && locations.length > 0) {
      const location = locations.find(l => l.id === locationId);
      if (location) return location.name;
    }
    
    // Fallback to orgSettings locations
    if (orgSettings?.locations && Array.isArray(orgSettings.locations)) {
      const location = orgSettings.locations.find((l: OrganizationLocation) => l.id === locationId);
      if (location) return location.name;
    }
    
    // If neither source has the location, show a placeholder
    return isLoadingOrgSettings ? "Loading..." : "Unknown Location";
  };

  // Get hierarchy level
  const getHierarchyLevel = (userId: number): number => {
    let level = 0;
    let currentUser = users.find(u => u.id === userId);
    
    while (currentUser?.managerId) {
      level++;
      currentUser = users.find(u => u.id === currentUser?.managerId);
    }
    
    return level;
  };

  // Toggle expanded state for a manager
  const toggleManagerExpanded = (managerId: number) => {
    if (expandedManagers.includes(managerId)) {
      setExpandedManagers(expandedManagers.filter(id => id !== managerId));
    } else {
      setExpandedManagers([...expandedManagers, managerId]);
    }
  };
  
  // Handle delete confirmation
  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  // Check if a user is in the current user's reporting chain
  const isInCurrentUserHierarchy = (targetUserId: number): boolean => {
    if (!user) return false;
    if (user.id === targetUserId) return true;
    return isSubordinate(user.id, targetUserId, users);
  };

  // Get all users visible to the current user based on hierarchy
  const getVisibleUsers = (): User[] => {
    if (!user) return [];
    
    // Owners and admins can see all users
    if (user.role === 'owner' || user.role === 'admin') {
      return users;
    }
    
    // Other roles can only see themselves and their subordinates
    return getReportingChainUsers(user.id, users);
  };

  // Get unique managers for filter dropdown
  const uniqueManagers = Array.from(
    new Map(
      getVisibleUsers()
        .filter(u => u.managerId !== null)
        .map(u => {
          const manager = users.find(m => m.id === u.managerId);
          return manager ? [manager.id, { id: manager.id, name: manager.fullName || manager.username }] : null;
        })
        .filter((item): item is [number, { id: number; name: string }] => item !== null)
    ).values()
  );

  // Filter users based on search term, filters, and hierarchy visibility
  const filteredUsers = getVisibleUsers().filter(u => {
    const matchesSearch = searchTerm === "" ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.fullName?.toLowerCase() || "").includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "all" || u.role === roleFilter;

    // Enhanced manager filter to include hierarchical filtering
    const matchesManager = managerFilter === "all" ||
      (managerFilter === "none" && !u.managerId) ||
      (managerFilter === "direct" && u.managerId === user?.id) ||
      (managerFilter === "team" && isSubordinate(user?.id || 0, u.id, users)) ||
      (u.managerId?.toString() === managerFilter);

    return matchesSearch && matchesRole && matchesManager;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // Page change handler
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Generate page numbers array
  const getPageNumbers = () => {
    const delta = 2; // Number of pages to show before and after current page
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  // Add new state for LOB selection
  const [selectedLOBs, setSelectedLOBs] = useState<number[]>([]);

  // Add LOB and Process queries
  const { data: lineOfBusinesses = [], isLoading: isLoadingLOB } = useQuery<OrganizationLineOfBusiness[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/line-of-businesses`],
    enabled: !!user?.organizationId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: processes = [], isLoading: isLoadingProcesses } = useQuery<OrganizationProcess[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/processes`],
    enabled: !!user?.organizationId,
    staleTime: 5 * 60 * 1000,
  });

  const filteredProcesses = processes.filter(process =>
    selectedLOBs.includes(process.lineOfBusinessId)
  );

  // Helper function to handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!userToDelete) {
      console.error('No user selected for deletion');
      return;
    }

    try {
      console.log('Confirming deletion for user:', userToDelete.id);
      await deleteUserMutation.mutateAsync(userToDelete.id);
    } catch (error) {
      console.error("Error in handleDeleteConfirm:", error);
    }
  };

  // Query for organization settings - includes locations
  const { data: orgSettings, isLoading: isLoadingOrgSettings } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/settings`],
    enabled: !!user?.organizationId,
  });
  
  // Add a separate dedicated query for locations to ensure they load properly
  const { data: locations = [] } = useQuery<OrganizationLocation[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/locations`],
    enabled: !!user?.organizationId,
  });

  // Add new query for user processes
  const { data: userProcesses = {} } = useQuery({
    queryKey: ["/api/users/processes"],
    enabled: !!user,
  });

  // Add helper function to get user processes
  const getUserProcesses = (userId: number) => {
    const processes = userProcesses[userId] || [];
    return processes.map((p: any) => p.processName).join(", ") || "No processes";
  };

  // Check for user management permissions
  const canManageUsers = hasPermission("manage_users");
  const canViewUsers = hasPermission("view_users");

  // If user can't even view users, show restricted access message
  if (!canViewUsers) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              You don't have permission to view user information.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const deleteConfirmationText = userToDelete?.username || "";
  const deleteForm = useForm({
    defaultValues: { confirmText: "" },
  });

  // Create EditUserDialog component
  const EditUserDialog = ({ user: editUser }: { user: User }) => {
    const [openLOB, setOpenLOB] = useState(false);
    const [openProcess, setOpenProcess] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const form = useForm<UserFormData>({
      resolver: zodResolver(editUserSchema),
      defaultValues: {
        username: editUser.username,
        fullName: editUser.fullName || "",
        email: editUser.email,
        employeeId: editUser.employeeId || "",
        role: editUser.role,
        phoneNumber: editUser.phoneNumber || "",
        locationId: editUser.locationId?.toString() || "none",
        managerId: editUser.managerId?.toString() || "none",
        dateOfJoining: editUser.dateOfJoining || "",
        dateOfBirth: editUser.dateOfBirth || "",
        education: editUser.education || "",
        category: editUser.category || "active",
        processes: editUser.processes || [],
      }
    });

    useEffect(() => {
      // Initialize selectedLOBs based on user's processes
      if (editUser.processes) {
        const lobIds = editUser.processes
          .map(processId => {
            const process = processes.find(p => p.id === processId);
            return process?.lineOfBusinessId;
          })
          .filter((id): id is number => id !== undefined);

        setSelectedLOBs([...new Set(lobIds)]);
      }
    }, [editUser.processes, processes]);

    // Determine if the current user can edit this user
    const canEdit = user?.role === "owner" || (user?.role === "admin" && editUser.role !== "admin");

    if (!canEdit) {
      return (
        <Button variant="outline" size="icon" disabled title="You don't have permission to edit this user">
          <Edit2 className="h-4 w-4" />
        </Button>
      );
    }

    return (
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" onClick={() => setIsDialogOpen(true)}>
            <Edit2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update information for {editUser.username}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(async (data) => {
                try {
                  // Clean up the data before submission
                  const cleanedData = {
                    ...data,
                    locationId: data.locationId === "none" ? null : parseInt(data.locationId),
                    managerId: data.managerId === "none" ? null : parseInt(data.managerId),
                    processes: data.processes || [],
                  };

                  await updateUserMutation.mutateAsync({
                    id: editUser.id,
                    data: cleanedData
                  });
                  setIsDialogOpen(false);
                } catch (error) {
                  console.error('Error updating user:', error);
                }
              })} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                          <Input
                            {...field}
                            type="email"
                            disabled={editUser.role === "owner"}
                            className={editUser.role === "owner" ? "bg-muted cursor-not-allowed" : ""}
                          />
                        </FormControl>
                        {editUser.role === "owner" && (
                          <p className="text-sm text-muted-foreground">
                            Email cannot be changed for owner accounts
                          </p>
                        )}
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
                          <Input {...field} />
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
                          <Input {...field} />
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
                        <Select
                          disabled={editUser.role === "owner"}
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="team_lead">Team Lead</SelectItem>
                            <SelectItem value="quality_analyst">Quality Analyst</SelectItem>
                            <SelectItem value="trainer">Trainer</SelectItem>
                            <SelectItem value="advisor">Advisor</SelectItem>
                            <SelectItem value="trainee">Trainee</SelectItem>
                          </SelectContent>
                        </Select>
                        {editUser.role === "owner" && (
                          <p className="text-sm text-muted-foreground">
                            Role cannot be changed for owner accounts
                          </p>
                        )}
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
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a location" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Location</SelectItem>
                            {locations?.map((location) => (
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
                    name="managerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manager</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a manager" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Manager</SelectItem>
                            {users
                              .filter(u => u.id !== editUser.id && u.active) // Can't assign self as manager
                              .map(manager => (
                                <SelectItem key={manager.id} value={manager.id.toString()}>
                                  {manager.fullName || manager.username}
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
                          <Input {...field} type="date" />
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
                          <Input {...field} type="date" />
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
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="trainee">Trainee</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Processes</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-normal">Line of Business</Label>
                      <Popover open={openLOB} onOpenChange={setOpenLOB}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openLOB}
                            className="w-full justify-between mt-1"
                          >
                            {selectedLOBs.length > 0
                              ? `${selectedLOBs.length} selected`
                              : "Select line of business..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-96 p-0">
                          <Command>
                            <CommandInput placeholder="Search line of business..." />
                            <CommandEmpty>No line of business found.</CommandEmpty>
                            <CommandGroup className="max-h-60 overflow-y-auto">
                              {lineOfBusinesses.map((lob) => (
                                <CommandItem
                                  key={lob.id}
                                  value={lob.name}
                                  onSelect={() => {
                                    const isSelected = selectedLOBs.includes(lob.id);
                                    if (isSelected) {
                                      setSelectedLOBs(selectedLOBs.filter(id => id !== lob.id));
                                    } else {
                                      setSelectedLOBs([...selectedLOBs, lob.id]);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={cn(
                                        "h-4 w-4 border rounded-sm flex items-center justify-center",
                                        selectedLOBs.includes(lob.id)
                                          ? "bg-primary border-primary text-primary-foreground"
                                          : "border-input"
                                      )}
                                    >
                                      {selectedLOBs.includes(lob.id) && <Check className="h-3 w-3" />}
                                    </div>
                                    {lob.name}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label className="text-sm font-normal">Processes</Label>
                      <Popover open={openProcess} onOpenChange={setOpenProcess}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openProcess}
                            className="w-full justify-between mt-1"
                            disabled={selectedLOBs.length === 0}
                          >
                            {form.watch("processes")?.length
                              ? `${form.watch("processes")?.length} selected`
                              : "Select processes..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-96 p-0">
                          <Command>
                            <CommandInput placeholder="Search processes..." />
                            <CommandEmpty>No processes found.</CommandEmpty>
                            <CommandGroup className="max-h-60 overflow-y-auto">
                              {filteredProcesses.map((process) => (
                                <CommandItem
                                  key={process.id}
                                  value={process.name}
                                  onSelect={() => {
                                    const currentProcesses = form.getValues("processes") || [];
                                    const isSelected = currentProcesses.includes(process.id);
                                    if (isSelected) {
                                      form.setValue(
                                        "processes",
                                        currentProcesses.filter(id => id !== process.id)
                                      );
                                    } else {
                                      form.setValue("processes", [...currentProcesses, process.id]);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={cn(
                                        "h-4 w-4 border rounded-sm flex items-center justify-center",
                                        form.watch("processes")?.includes(process.id)
                                          ? "bg-primary border-primary text-primary-foreground"
                                          : "border-input"
                                      )}
                                    >
                                      {form.watch("processes")?.includes(process.id) && (
                                        <Check className="h-3 w-3" />
                                      )}
                                    </div>
                                    {process.name}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Save Changes</Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
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
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                  <SelectItem value="team_lead">Team Lead</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={managerFilter}
                onValueChange={(value) => {
                  setManagerFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Managers</SelectItem>
                  <SelectItem value="none">No Manager</SelectItem>
                  {user && (
                    <>
                      <SelectItem value="direct">My Direct Reports</SelectItem>
                      <SelectItem value="team">My Team (All)</SelectItem>
                    </>
                  )}
                  {uniqueManagers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id.toString()}>
                      {manager.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => setViewMode(viewMode === 'hierarchy' ? 'flat' : 'hierarchy')}
                className="gap-2"
              >
                {viewMode === 'hierarchy' ? (
                  <>
                    <Users className="h-4 w-4" />
                    Flat View
                  </>
                ) : (
                  <>
                    <Network className="h-4 w-4" />
                    Hierarchy View
                  </>
                )}
              </Button>
              {canManageUsers && (
                <Button onClick={exportToExcel} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[13%]">Username</TableHead>
                  <TableHead className="w-[15%]">Email</TableHead>
                  <TableHead className="w-[13%]">Full Name</TableHead>
                  <TableHead className="w-[8%]">Role</TableHead>
                  <TableHead className="w-[10%]">Manager</TableHead>
                  <TableHead className="w-[10%]">Location</TableHead>
                  <TableHead className="w-[18%]">Processes</TableHead>
                  <TableHead className="w-[5%]">Active</TableHead>
                  {canManageUsers && (
                    <TableHead className="w-[8%] text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewMode === 'flat' ? (
                  // Flat view - simple list of users
                  currentUsers.map((user) => (
                    <TableRow key={user.id} className={cn(!user.active && "opacity-50")}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.fullName}</TableCell>
                      <TableCell>
                        <Badge>{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted">
                                {getManagerName(user.managerId)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Reporting Path: {getFormattedReportingPath(user.id, users)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>{getLocationName(user.locationId)}</TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          {getUserProcesses(user.id) ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex flex-col space-y-1 cursor-help">
                                    {getUserProcesses(user.id).split(", ").map((process, idx) => (
                                      process ? (
                                        <Badge key={idx} variant="outline" className="justify-start text-left w-full truncate">
                                          {process}
                                        </Badge>
                                      ) : null
                                    ))}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                  <p className="font-medium text-sm">Assigned Processes:</p>
                                  <ul className="list-disc list-inside text-xs mt-1">
                                    {getUserProcesses(user.id).split(", ").map((process, idx) => (
                                      <li key={idx}>{process}</li>
                                    ))}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground text-sm italic">No processes</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.role === "owner" ? (
                          <div className="flex items-center" title="Owner status cannot be changed">
                            <Switch
                              checked={true}
                              disabled={true}
                              className="opacity-50 cursor-not-allowed"
                            />
                          </div>
                        ) : canManageUsers ? (
                          <Switch
                            checked={user.active}
                            onCheckedChange={(checked) => toggleUserStatus(user.id, user.active, user.role)}
                          />
                        ) : (
                          <Switch checked={user.active} disabled={true} />
                        )}
                      </TableCell>
                      {canManageUsers && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <EditUserDialog user={user} />
                            {user.role !== "owner" && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteClick(user)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  // Hierarchical view - tree structure based on current user and visible permissions
                  (() => {
                    // If owner or admin, show the entire org hierarchy from root users
                    if (user?.role === 'owner' || user?.role === 'admin') {
                      return filteredUsers
                        .filter(u => !u.managerId) // Only root users (no manager)
                        .map(rootUser => (
                          <HierarchicalUserRow
                            key={rootUser.id}
                            user={rootUser}
                            users={filteredUsers}
                            level={0}
                            expandedManagers={expandedManagers}
                            toggleExpanded={toggleManagerExpanded}
                            getManagerName={getManagerName}
                            getLocationName={getLocationName}
                            getProcessNames={getUserProcesses}
                            canManageUsers={canManageUsers}
                            editUserComponent={(user) => <EditUserDialog user={user} />}
                            toggleUserStatus={toggleUserStatus}
                            handleDeleteClick={handleDeleteClick}
                            getFormattedReportingPath={getFormattedReportingPath}
                          />
                        ));
                    } 
                    // For managers and other roles, show only their own hierarchy
                    else {
                      return (
                        <HierarchicalUserRow
                          key={user?.id}
                          user={user as User}
                          users={filteredUsers}
                          level={0}
                          expandedManagers={expandedManagers}
                          toggleExpanded={toggleManagerExpanded}
                          getManagerName={getManagerName}
                          getLocationName={getLocationName}
                          getProcessNames={getUserProcesses}
                          canManageUsers={canManageUsers}
                          editUserComponent={(user) => <EditUserDialog user={user} />}
                          toggleUserStatus={toggleUserStatus}
                          handleDeleteClick={handleDeleteClick}
                          getFormattedReportingPath={getFormattedReportingPath}
                        />
                      );
                    }
                  })()
                )}
              </TableBody>
            </Table>
            
            {/* No results message */}
            {filteredUsers.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                No users match your current filters
              </div>
            )}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                {getPageNumbers().map((pageNum, idx) => (
                  <Button
                    key={idx}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => typeof pageNum === 'number' && handlePageChange(pageNum)}
                    disabled={pageNum === '...'}
                  >
                    {pageNum}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>
              This action will deactivate the user, preventing them from logging in.
              Their data will be maintained in the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p>To confirm, type the username: <strong>{deleteConfirmationText}</strong></p>
              <Input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type username to confirm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteConfirmation !== deleteConfirmationText}
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deactivating...
                </>
              ) : (
                "Deactivate User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}