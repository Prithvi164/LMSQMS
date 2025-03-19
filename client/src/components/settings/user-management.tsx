import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { User, Organization, OrganizationLocation } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Search, Download, Upload, FileSpreadsheet, AlertCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Extend the insertUserSchema for the edit form
const editUserSchema = insertUserSchema.extend({
  locationId: z.string().optional(),
  managerId: z.string().optional(),
  dateOfJoining: z.string().optional(),
  dateOfBirth: z.string().optional(),
  education: z.string().optional(),
}).omit({ certified: true }).partial();  // Remove certified from the schema

type UserFormData = z.infer<typeof editUserSchema>;

// Update the ImportedUser interface to include processes
interface ImportedUser {
  Username: string;
  "Full Name": string;
  Email: string;
  "Employee ID": string;
  Role: string;
  "Phone Number": string;
  Location: string;
  Manager: string;
  "Date of Joining": string;
  "Date of Birth": string;
  Education: string;
  "Processes": string; // Comma-separated process names
}

export function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Number of items to show per page

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete user");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowDeleteDialog(false);
      setUserToDelete(null);
      setDeleteConfirmation("");
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

  // Add process data fetching with error handling
  const { data: processes = [], error: processError } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/processes`],
    enabled: !!user?.organizationId,
  });

  //Check for processError and display a toast message if there's an error
  if (processError) {
    toast({
      title: "Error",
      description: `Failed to fetch processes: ${processError.message}`,
      variant: "destructive",
    });
  }

  // Update exportToExcel function to include processes
  const exportToExcel = () => {
    const dataToExport = users.map(user => {
      const userProcesses = Array.isArray(processes) ?
        processes
          .filter((p: any) => user.processIds?.includes(p.id))
          .map((p: any) => p.name)
          .join(", ")
        : "";

      return {
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
        Status: user.active ? 'Active' : 'Inactive',
        Processes: userProcesses
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, `users_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };


  // Add downloadTemplate function
  const downloadTemplate = () => {
    const template = [
      {
        Username: "john.doe",
        "Full Name": "John Doe",
        Email: "john@example.com",
        "Employee ID": "EMP001",
        Role: "advisor",
        "Phone Number": "+1234567890",
        Location: "Main Office",
        Manager: "jane.smith",
        "Date of Joining": "2024-01-01",
        "Date of Birth": "1990-01-01",
        Education: "Bachelor's Degree",
        "Processes": "Customer Service, Technical Support" // Example of comma-separated process names
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "user_import_template.xlsx");
  };

  // Add state for import preview
  const [importData, setImportData] = useState<any[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // Update the import handling logic
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Show loading toast
    toast({
      title: "Processing",
      description: "Reading file content...",
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<ImportedUser>(worksheet);

        // Validate the data
        const errors: string[] = [];
        const processNames = Array.isArray(processes) ?
          processes.map((p: any) => p.name?.toLowerCase()).filter(Boolean) :
          [];

        // Process in chunks to avoid blocking the UI
        const chunkSize = 100;
        for (let i = 0; i < jsonData.length; i += chunkSize) {
          const chunk = jsonData.slice(i, i + chunkSize);
          await new Promise(resolve => setTimeout(resolve, 0)); // Let the UI breathe

          chunk.forEach((row, index) => {
            const rowIndex = i + index + 1;
            if (!row.Username) errors.push(`Row ${rowIndex}: Username is required`);
            if (!row.Email) errors.push(`Row ${rowIndex}: Email is required`);
            if (!row.Role || !['admin', 'manager', 'advisor', 'trainer', 'trainee'].includes(row.Role.toLowerCase())) {
              errors.push(`Row ${rowIndex}: Invalid role`);
            }

            // Validate processes if provided
            if (row.Processes && processNames.length > 0) {
              const rowProcesses = row.Processes.split(',').map(p => p.trim().toLowerCase());
              const invalidProcesses = rowProcesses.filter(p => !processNames.includes(p));
              if (invalidProcesses.length > 0) {
                errors.push(`Row ${rowIndex}: Invalid processes: ${invalidProcesses.join(', ')}`);
              }
            }
          });
        }

        setImportErrors(errors);
        setImportData(jsonData);
        setShowImportPreview(true);

        // Show success toast
        toast({
          title: "Success",
          description: `File processed successfully. ${jsonData.length} records found.`,
        });
      } catch (error) {
        console.error('Error parsing file:', error);
        toast({
          title: "Error",
          description: "Failed to parse Excel file. Please ensure it follows the template format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Update the import mutation
  const importUsersMutation = useMutation({
    mutationFn: async (users: ImportedUser[]) => {
      // Transform the data to match the API expectations
      const transformedUsers = users.map(user => {
        const userProcessIds = user.Processes && Array.isArray(processes) ?
          processes
            .filter((p: any) =>
              user.Processes.toLowerCase().includes(p.name?.toLowerCase())
            )
            .map((p: any) => p.id)
            .filter(Boolean)
          : [];

        return {
          username: user.Username,
          fullName: user["Full Name"],
          email: user.Email,
          employeeId: user["Employee ID"],
          role: user.Role.toLowerCase(),
          phoneNumber: user["Phone Number"],
          dateOfJoining: user["Date of Joining"],
          dateOfBirth: user["Date of Birth"],
          education: user.Education,
          processIds: userProcessIds
        };
      });

      const response = await apiRequest("POST", "/api/users/bulk-import", { users: transformedUsers });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to import users");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Users imported successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowImportPreview(false);
      setImportData([]);
      setImportErrors([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Optimize the import preview dialog
  const ImportPreviewDialog = () => {
    if (!showImportPreview) return null;

    return (
      <AlertDialog open={showImportPreview} onOpenChange={setShowImportPreview}>
        <AlertDialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Import Preview</AlertDialogTitle>
            <AlertDialogDescription>
              Review the data before importing
            </AlertDialogDescription>
          </AlertDialogHeader>

          {importErrors.length > 0 && (
            <div className="mb-4 p-4 border border-destructive rounded-lg">
              <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="font-semibold">Validation Errors</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                {importErrors.map((error, index) => (
                  <li key={index} className="text-sm text-destructive">{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="my-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Processes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(importData as ImportedUser[]).slice(0, 5).map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.Username}</TableCell>
                    <TableCell>{row.Email}</TableCell>
                    <TableCell>{row["Full Name"]}</TableCell>
                    <TableCell>{row.Role}</TableCell>
                    <TableCell>{row.Processes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {importData.length > 5 && (
              <p className="text-sm text-muted-foreground mt-2">
                And {importData.length - 5} more rows...
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowImportPreview(false);
              setImportData([]);
              setImportErrors([]);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => importUsersMutation.mutate(importData as ImportedUser[])}
              disabled={importErrors.length > 0 || importUsersMutation.isPending}
            >
              {importUsersMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import Users"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
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
    const location = orgSettings?.locations?.find((l: OrganizationLocation) => l.id === locationId);
    return location ? location.name : "Unknown Location";
  };

  // Get unique managers for filter dropdown
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

  // Create EditUserDialog component
  const EditUserDialog = ({ user: editUser }: { user: User }) => {
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
        lastWorkingDay: editUser.lastWorkingDay || "",
      }
    });

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
              try {
                // Clean up the data before submission
                const cleanedData = {
                  ...data,
                  locationId: data.locationId === "none" ? null : parseInt(data.locationId!),
                  managerId: data.managerId === "none" ? null : parseInt(data.managerId!),
                  // Only include lastWorkingDay if it has a value
                  lastWorkingDay: data.lastWorkingDay ? data.lastWorkingDay : null,
                };

                await updateUserMutation.mutateAsync({
                  id: editUser.id,
                  data: cleanedData
                });
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
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={editUser.role === "owner"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {user?.role === "owner" ? (
                            <>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="team_lead">Team Lead</SelectItem>
                              <SelectItem value="qualityassurance">Quality Assurance</SelectItem>
                              <SelectItem value="trainer">Trainer</SelectItem>
                              <SelectItem value="advisor">Advisor</SelectItem>
                            </>
                          ) : user?.role === "admin" ? (
                            <>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="team_lead">Team Lead</SelectItem>
                              <SelectItem value="qualityassurance">Quality Assurance</SelectItem>
                              <SelectItem value="trainer">Trainer</SelectItem>
                              <SelectItem value="advisor">Advisor</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="team_lead">Team Lead</SelectItem>
                              <SelectItem value="qualityassurance">Quality Assurance</SelectItem>
                              <SelectItem value="trainer">Trainer</SelectItem>
                              <SelectItem value="advisor">Advisor</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      {editUser.role === "owner" && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Owner role cannot be changed
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Location</SelectItem>
                          {orgSettings?.locations?.map((location: OrganizationLocation) => (
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Manager</SelectItem>
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
                  name="lastWorkingDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Working Day</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
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

  // Helper function to handle delete confirmation
  const handleDeleteConfirm = () => {
    if (!userToDelete) return;

    // Attempt to delete the user
    try {
      deleteUserMutation.mutate(userToDelete.id);
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    }
  };

  const { data: orgSettings } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/settings`],
    enabled: !!user?.organizationId,
  });

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
                    setCurrentPage(1); // Reset to first page when searching
                  }}
                  className="pl-9"
                />
              </div>
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value);
                  setCurrentPage(1); // Reset to first page when filtering
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
                  <SelectItem value="trainee">Trainee</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                  <SelectItem value="team_lead">Team Lead</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={managerFilter}
                onValueChange={(value) => {
                  setManagerFilter(value);
                  setCurrentPage(1); // Reset to first page when filtering
                }}
              >
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
            </div>
            {/* Add Button in CardContent after the filter controls */}
            <div className="flex justify-between items-center mb-4">
              <div className="space-x-2">
                <Button
                  onClick={exportToExcel}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export Users
                </Button>
                <Button
                  onClick={downloadTemplate}
                  variant="outline"
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Download Template
                </Button>
                <div className="relative inline-block">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileImport}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Button
                    variant="outline"
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Import Users
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Username</TableHead>
                  <TableHead className="w-[200px]">Email</TableHead>
                  <TableHead className="w-[150px]">Full Name</TableHead>
                  <TableHead className="w-[100px]">Role</TableHead>
                  <TableHead className="w-[150px]">Manager</TableHead>
                  <TableHead className="w-[150px]">Location</TableHead>
                  <TableHead className="w-[150px]">Last Working Day</TableHead><TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentUsers.map((u) => (
                  <TableRow key={u.id} className={!u.active ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.fullName}</TableCell>
                    <TableCell>
                      <Badge>{u.role}</Badge>
                    </TableCell>
                    <TableCell>{getManagerName(u.managerId)}</TableCell>
                    <TableCell>{getLocationName(u.locationId)}</TableCell>
                    <TableCell>{u.lastWorkingDay || "-"}</TableCell>
                    <TableCell>
                      {u.role === "owner" ? (
                        <div className="flex items-center" title="Owner status cannot be changed">
                          <Switch
                            checked={true}
                            disabled={true}
                            className="opacity-50 cursor-not-allowed"
                          />
                        </div>
                      ) : (
                        <Switch
                          checked={u.active}
                          onCheckedChange={(checked) => toggleUserStatus(u.id, u.active, u.role)}
                          disabled={false}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <EditUserDialog user={u} />
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            setUserToDelete(u);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>

                {getPageNumbers().map((pageNumber, index) => (
                  <Button
                    key={index}
                    variant={pageNumber === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => typeof pageNumber === 'number' && handlePageChange(pageNumber)}
                    disabled={typeof pageNumber !== 'number'}
                  >
                    {pageNumber}
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
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent><DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              This is a permanent action. Are you sure you want to delete {userToDelete?.fullName || userToDelete?.username}?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="confirmation" className="text-sm text-muted-foreground block mb-2">
              Type "{userToDelete?.fullName || userToDelete?.username}" to confirm deletion:
            </Label>
            <Input
              id="confirmation"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="mt-2"
              placeholder="Type the user's name..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setUserToDelete(null);
                setDeleteConfirmation("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteConfirmation !== (userToDelete?.fullName || userToDelete?.username)}
            >
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportPreviewDialog />
    </div>
  );
}