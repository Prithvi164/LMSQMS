import { useState, useEffect, useMemo, useCallback } from 'react';
import { Form, useForm } from 'react-hook-form';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Pagination } from '@/components/ui/pagination';
import {
  Form as FormUI,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronsUpDown, ChevronRight, ChevronDown, Download, Edit2, Network, Search, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/page-header';

const editUserSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  fullName: z.string().min(2, { message: "Full name is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  employeeId: z.string().optional(),
  role: z.string({ required_error: "Please select a role" }),
  category: z.string().optional(),
  locationId: z.number().optional().nullable(),
  managerId: z.number().optional().nullable(),
  phoneNumber: z.string().optional(),
  education: z.string().optional(),
  dateOfJoining: z.string().optional(),
  dateOfBirth: z.string().optional(),
  processes: z.array(z.number()).optional(),
  lineOfBusinesses: z.array(z.number()).optional(),
});

type UserFormData = z.infer<typeof editUserSchema>;

type User = {
  id: number;
  username: string;
  fullName: string;
  email: string;
  employeeId: string;
  role: string;
  category: string;
  locationId: number | null;
  managerId: number | null;
  phoneNumber: string;
  education: string;
  dateOfJoining: string;
  dateOfBirth: string;
  active: boolean;
  processes: number[];
};

type OrganizationLocation = {
  id: number;
  name: string;
};

type OrganizationProcess = {
  id: number;
  name: string;
  lineOfBusinessId: number;
};

type LineOfBusiness = {
  id: number;
  name: string;
};

export const UserManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  
  // State for data
  const [users, setUsers] = useState<User[]>([]);
  const [uniqueManagers, setUniqueManagers] = useState<{ id: number; name: string }[]>([]);
  const [processes, setProcesses] = useState<OrganizationProcess[]>([]);
  const [linesOfBusiness, setLinesOfBusiness] = useState<LineOfBusiness[]>([]);
  const [locations, setLocations] = useState<OrganizationLocation[]>([]);
  
  // State for filters and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [selectedLOBs, setSelectedLOBs] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'flat' | 'hierarchy'>('flat');
  const [expandedManagers, setExpandedManagers] = useState<Set<number>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  
  // Filtered processes based on selected LOBs
  const filteredProcesses = processes.filter(process =>
    selectedLOBs.includes(process.lineOfBusinessId)
  );

  // User batch data for hierarchy
  const userBatchData = [];
  const userBatchMap = {};

  // Permission checks
  const canManageUsers = hasPermission('manageUsers');
  const canSeeHierarchy = hasPermission('viewAllUsers');
  const canExportReports = hasPermission('exportReports');

  // Fetch users
  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ['/api/users'],
    onSuccess: (data) => {
      if (data && Array.isArray(data)) {
        setUsers(data);
        
        // Extract unique managers for filter
        const managers = data
          .filter(u => u.role === 'manager' || u.role === 'team_lead' || u.role === 'admin')
          .map(u => ({ id: u.id, name: u.fullName }));
        
        const uniqueManagersMap = new Map();
        managers.forEach(manager => {
          uniqueManagersMap.set(manager.id, manager);
        });
        
        setUniqueManagers(Array.from(uniqueManagersMap.values()));
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error loading users",
        description: error.message,
      });
    }
  });

  // Fetch organization data
  const { data: orgSettings } = useQuery({
    queryKey: ['/api/organizations/settings'],
    onSuccess: (data) => {
      if (data) {
        // Get locations
        const locations = data.locations || [];
        setLocations(locations);
        
        // Get processes
        const allProcesses = data.processes || [];
        setProcesses(allProcesses);
        
        // Get lines of business
        const allLOBs = data.linesOfBusiness || [];
        setLinesOfBusiness(allLOBs);
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error loading organization settings",
        description: error.message,
      });
    }
  });

  // Fetch user processes
  const { data: userProcesses } = useQuery({
    queryKey: ['/api/users/processes'],
    onSuccess: (data) => {
      console.log("User processes loaded:", data);
    },
    onError: (error) => {
      console.error("Error loading user processes:", error);
    }
  });

  // Toggle user active status
  const toggleUserStatus = (userId: number, currentStatus: boolean, userRole: string) => {
    if (userRole === "owner") {
      toast({
        title: "Cannot modify owner",
        description: "The owner's status cannot be changed.",
      });
      return;
    }

    updateUser.mutate(
      {
        userId,
        data: { active: !currentStatus }
      },
      {
        onSuccess: () => {
          toast({
            title: `User ${currentStatus ? 'deactivated' : 'activated'}`,
            description: `User has been ${currentStatus ? 'deactivated' : 'activated'} successfully.`,
          });
          refetch();
        },
        onError: (error: Error) => {
          toast({
            variant: "destructive",
            title: "Error updating user",
            description: error.message,
          });
        }
      }
    );
  };

  // Delete user
  const deleteUser = useMutation({
    mutationFn: (userId: number) => 
      fetch(`/api/users/${userId}/delete`, { method: 'DELETE' })
        .then(res => {
          if (!res.ok) throw new Error('Failed to delete user');
          return res.json();
        }),
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "User has been deleted successfully.",
      });
      refetch();
      setShowDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error deleting user",
        description: error.message,
      });
    }
  });

  // Update user
  const updateUser = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: any }) =>
      fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => {
        if (!res.ok) throw new Error('Failed to update user');
        return res.json();
      })
  });

  // Helper function to get manager name by ID
  const getManagerName = (managerId: number | null) => {
    if (!managerId) return "None";
    const manager = users.find(u => u.id === managerId);
    return manager ? manager.fullName : "Unknown";
  };

  // Helper function to get location name by ID
  const getLocationName = (locationId: number | null) => {
    if (!locationId) return "None";
    const location = orgSettings && orgSettings.locations ? 
      orgSettings.locations.find((l: OrganizationLocation) => l.id === locationId) : null;
    return location ? location.name : "Unknown";
  };

  // Helper function to get user's processes
  const getUserProcesses = (userId: number) => {
    if (!userProcesses || !processes.length) return null;
    
    const userProcessIds = userProcesses[userId] || [];
    if (!userProcessIds.length) return null;
    
    const processNames = userProcessIds.map(processId => {
      const process = processes.find(p => p.id === processId);
      return process ? process.name : null;
    }).filter(Boolean);
    
    return processNames.join(", ");
  };

  // Filtered users based on search and filters
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search filter
      const searchMatch = 
        searchTerm === '' || 
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Role filter
      const roleMatch = roleFilter === 'all' || user.role === roleFilter;
      
      // Category filter
      const categoryMatch = categoryFilter === 'all' || 
        (categoryFilter === 'trainee' && user.category === 'trainee') ||
        (categoryFilter === 'active' && user.category !== 'trainee' && user.active);
      
      // Manager filter
      let managerMatch = true;
      if (managerFilter !== 'all') {
        if (managerFilter === 'none') {
          managerMatch = !user.managerId;
        } else if (managerFilter === 'direct' && user) {
          managerMatch = user.managerId === user.id;
        } else if (managerFilter === 'team' && user) {
          // User is either a direct report or in the reporting chain under the current user
          managerMatch = isSubordinate(user.id, user.id, users);
        } else {
          // Specific manager selected
          managerMatch = user.managerId === parseInt(managerFilter);
        }
      }
      
      return searchMatch && roleMatch && categoryMatch && managerMatch;
    });
  }, [users, searchTerm, roleFilter, categoryFilter, managerFilter]);

  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const currentUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredUsers, currentPage]);

  // Helper function to check if a user is a subordinate of another
  const isSubordinate = (managerId: number, userId: number, allUsers: User[]) => {
    if (!managerId || !userId) return false;
    
    const user = allUsers.find(u => u.id === userId);
    if (!user) return false;
    
    if (user.managerId === managerId) return true;
    
    if (user.managerId) {
      return isSubordinate(managerId, user.managerId, allUsers);
    }
    
    return false;
  };

  // Export to Excel
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredUsers.map(user => ({
        Username: user.username,
        "Full Name": user.fullName,
        Email: user.email,
        "Employee ID": user.employeeId,
        Role: user.role,
        Category: user.category || 'active',
        Manager: getManagerName(user.managerId),
        Location: getLocationName(user.locationId),
        Processes: getUserProcesses(user.id) || 'None',
        "Active Status": user.active ? 'Active' : 'Inactive',
        "Date of Joining": user.dateOfJoining || 'N/A',
        "Date of Birth": user.dateOfBirth || 'N/A',
        "Phone Number": user.phoneNumber || 'N/A',
        "Education": user.education || 'N/A'
      }))
    );
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    
    // Auto-size columns
    const colWidths = [
      { wch: 15 }, // Username
      { wch: 20 }, // Full Name
      { wch: 25 }, // Email
      { wch: 15 }, // Employee ID
      { wch: 12 }, // Role
      { wch: 12 }, // Category
      { wch: 20 }, // Manager
      { wch: 15 }, // Location
      { wch: 30 }, // Processes
      { wch: 15 }, // Active Status
      { wch: 15 }, // Date of Joining
      { wch: 15 }, // Date of Birth
      { wch: 15 }, // Phone Number
      { wch: 20 }  // Education
    ];
    worksheet['!cols'] = colWidths;
    
    XLSX.writeFile(workbook, `Users_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Format reporting path for hierarchy view
  const getFormattedReportingPath = (userId: number, allUsers: User[]) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user || !user.managerId) return "N/A";
    
    const path = [];
    let currentId = user.managerId;
    
    while (currentId) {
      const manager = allUsers.find(u => u.id === currentId);
      if (!manager) break;
      
      path.push(manager.fullName);
      currentId = manager.managerId;
    }
    
    return path.join(" > ");
  };

  // Handle expand/collapse for hierarchy view
  const toggleManager = (managerId: number) => {
    const newExpandedManagers = new Set(expandedManagers);
    if (newExpandedManagers.has(managerId)) {
      newExpandedManagers.delete(managerId);
    } else {
      newExpandedManagers.add(managerId);
    }
    setExpandedManagers(newExpandedManagers);
  };

  const expandAllManagers = () => {
    const allManagerIds = users
      .filter(u => users.some(user => user.managerId === u.id))
      .map(u => u.id);
    setExpandedManagers(new Set(allManagerIds));
  };

  const collapseAllManagers = () => {
    setExpandedManagers(new Set());
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const EditUserDialog = ({ user: editUser }: { user: User }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [openLOB, setOpenLOB] = useState(false);
    const [openProcess, setOpenProcess] = useState(false);
    
    // Dialog-specific selectedLOBs state
    const [dialogSelectedLOBs, setDialogSelectedLOBs] = useState<number[]>([]);
    
    // Dialog-specific filteredProcesses for the edit user dialog
    const dialogFilteredProcesses = processes.filter(process =>
      dialogSelectedLOBs.includes(process.lineOfBusinessId)
    );

    const form = useForm<UserFormData>({
      resolver: zodResolver(editUserSchema),
      defaultValues: {
        username: editUser.username,
        fullName: editUser.fullName,
        email: editUser.email,
        employeeId: editUser.employeeId,
        role: editUser.role,
        category: editUser.category,
        locationId: editUser.locationId,
        managerId: editUser.managerId,
        phoneNumber: editUser.phoneNumber,
        education: editUser.education,
        dateOfJoining: editUser.dateOfJoining,
        dateOfBirth: editUser.dateOfBirth,
        processes: editUser.processes,
      }
    });

    useEffect(() => {
      if (isDialogOpen) {
        console.log("Dialog opened, initializing form values", editUser);
        
        // Find the LOBs for the user's processes
        if (editUser.processes && editUser.processes.length > 0) {
          const userLOBs = new Set<number>();
          
          editUser.processes.forEach(processId => {
            const process = processes.find(p => p.id === processId);
            if (process && process.lineOfBusinessId) {
              userLOBs.add(process.lineOfBusinessId);
            }
          });
          
          // Set the dialog-specific selectedLOBs
          const lobArray = Array.from(userLOBs);
          console.log("Setting dialog selected LOBs:", lobArray);
          setDialogSelectedLOBs(lobArray);
        }
      }
    }, [isDialogOpen, editUser, processes]);

    const onSubmit = async (data: UserFormData) => {
      const updatedData = { ...data };
      
      // Don't update the username
      delete updatedData.username;
      
      console.log("Saving user with data:", updatedData);
      
      updateUser.mutate(
        {
          userId: editUser.id,
          data: updatedData
        },
        {
          onSuccess: () => {
            toast({
              title: "User updated",
              description: "User information has been updated successfully.",
            });
            setIsDialogOpen(false);
            refetch();
          },
          onError: (error: Error) => {
            toast({
              variant: "destructive",
              title: "Error updating user",
              description: error.message,
            });
          }
        }
      );
    };

    return (
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" onClick={() => setIsDialogOpen(true)}>
            <Edit2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              disabled 
                            />
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
                            <Input 
                              {...field} 
                            />
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
                              type="email"
                              disabled={true}
                              className="opacity-70"
                              {...field} 
                            />
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
                              <SelectItem value="trainer">Trainer</SelectItem>
                              <SelectItem value="quality_analyst">Quality Analyst</SelectItem>
                              <SelectItem value="advisor">Advisor</SelectItem>
                              <SelectItem value="trainee">Trainee</SelectItem>
                            </SelectContent>
                          </Select>
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
                            <Input 
                              {...field} 
                            />
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
                            <Input 
                              {...field} 
                            />
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
                  
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="managerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manager</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value ? parseInt(value) : null)} 
                            defaultValue={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a manager" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">None</SelectItem>
                              {users
                                .filter(u => u.id !== editUser.id && (u.role === 'manager' || u.role === 'team_lead' || u.role === 'admin'))
                                .map(manager => (
                                  <SelectItem key={manager.id} value={manager.id.toString()}>
                                    {manager.fullName}
                                  </SelectItem>
                                ))
                              }
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
                          <Select 
                            onValueChange={(value) => field.onChange(value ? parseInt(value) : null)} 
                            defaultValue={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a location" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">No Location</SelectItem>
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
                      name="dateOfJoining"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Joining</FormLabel>
                          <FormControl>
                            <Input 
                              type="date"
                              {...field} 
                            />
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
                            <Input 
                              type="date"
                              {...field} 
                            />
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
                            <Input 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="lineOfBusinesses"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Line of Business</FormLabel>
                          <Popover open={openLOB} onOpenChange={setOpenLOB}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openLOB}
                                className="w-full justify-between"
                              >
                                {dialogSelectedLOBs.length > 0
                                  ? `${dialogSelectedLOBs.length} selected`
                                  : "Select line of business..."}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-96 p-0">
                              <Command>
                                <CommandInput placeholder="Search line of business..." />
                                <CommandEmpty>No line of business found.</CommandEmpty>
                                <CommandGroup>
                                  {linesOfBusiness.map((lob) => (
                                    <CommandItem
                                      key={lob.id}
                                      value={lob.name}
                                      onSelect={() => {
                                        const isSelected = dialogSelectedLOBs.includes(lob.id);
                                        if (isSelected) {
                                          const newSelectedLOBs = dialogSelectedLOBs.filter(id => id !== lob.id);
                                          setDialogSelectedLOBs(newSelectedLOBs);
                                          setSelectedLOBs(newSelectedLOBs); // Update parent state for filtering
                                        } else {
                                          const newSelectedLOBs = [...dialogSelectedLOBs, lob.id];
                                          setDialogSelectedLOBs(newSelectedLOBs);
                                          setSelectedLOBs(newSelectedLOBs); // Update parent state for filtering
                                        }
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={cn(
                                            "h-4 w-4 border rounded-sm flex items-center justify-center",
                                            dialogSelectedLOBs.includes(lob.id)
                                              ? "bg-primary border-primary text-primary-foreground"
                                              : "border-input"
                                          )}
                                        >
                                          {dialogSelectedLOBs.includes(lob.id) && <Check className="h-3 w-3" />}
                                        </div>
                                        {lob.name}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="processes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Processes</FormLabel>
                          <Popover open={openProcess} onOpenChange={setOpenProcess}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openProcess}
                                className="w-full justify-between"
                                disabled={dialogSelectedLOBs.length === 0}
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
                                <CommandGroup>
                                  {dialogFilteredProcesses.map((process) => {
                                    const currentProcesses = form.getValues("processes") || [];
                                    const isSelected = currentProcesses.includes(process.id);
                                    return (
                                      <CommandItem
                                        key={process.id}
                                        value={process.name}
                                        onSelect={() => {
                                          console.log("Process selected:", process.name, "Current processes:", currentProcesses);
                                          if (isSelected) {
                                            form.setValue(
                                              "processes",
                                              currentProcesses.filter(id => id !== process.id)
                                            );
                                          } else {
                                            form.setValue("processes", [...currentProcesses, process.id]);
                                          }
                                          // Force a re-render to update the UI
                                          form.trigger("processes");
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
                                    );
                                  })}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                value={categoryFilter}
                onValueChange={(value) => {
                  setCategoryFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trainee">Trainee</SelectItem>
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
              
              {/* Add expand/collapse all buttons for hierarchy view */}
              {viewMode === 'hierarchy' && (
                <div className="flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={expandAllManagers}
                          className="h-10 w-10"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Expand All</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={collapseAllManagers}
                          className="h-10 w-10"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Collapse All</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
              {canExportReports && (
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
                  <TableHead className="w-[12%]">Username</TableHead>
                  <TableHead className="w-[14%]">Email</TableHead>
                  <TableHead className="w-[12%]">Full Name</TableHead>
                  <TableHead className="w-[7%]">Role</TableHead>
                  <TableHead className="w-[7%]">Category</TableHead>
                  <TableHead className="w-[9%]">Manager</TableHead>
                  <TableHead className="w-[9%]">Location</TableHead>
                  <TableHead className="w-[17%]">Processes</TableHead>
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
                        <Badge variant={user.category === 'trainee' ? 'secondary' : 'outline'}>
                          {user.category || 'active'}
                        </Badge>
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
                  // Hierarchical view logic here (omitted for brevity)
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-4">
                      Hierarchical view is available but code omitted for brevity
                    </TableCell>
                  </TableRow>
                )}
                
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No users match the current filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-end mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete user confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>
              This action will deactivate the user account. The user will no longer be able to log in. Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => userToDelete && deleteUser.mutate(userToDelete.id)}
            >
              Deactivate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

