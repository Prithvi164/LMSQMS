import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { User, Organization, OrganizationLocation, InsertUser } from "@shared/schema";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import * as XLSX from "xlsx";

// Extend the insertUserSchema for the edit form
const editUserSchema = insertUserSchema.extend({
  locationId: z.string().optional(),
  managerId: z.string().optional(),
  dateOfJoining: z.string().optional(),
  dateOfBirth: z.string().optional(),
  education: z.string().optional(),
  lastWorkingDay: z.string().optional(),
}).omit({ certified: true }).partial();  // Remove certified from the schema

type UserFormData = z.infer<typeof editUserSchema>;

// Define ImportedUser interface
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

// Import Preview Dialog Component
const ImportPreviewDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importData: ImportedUser[];
  importErrors: string[];
  onImport: () => void;
  isImporting: boolean;
  onCancel: () => void;
}> = ({
  open,
  onOpenChange,
  importData,
  importErrors,
  onImport,
  isImporting,
  onCancel,
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
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
            {importData.slice(0, 5).map((row, index) => (
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
        <AlertDialogCancel onClick={onCancel}>
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={onImport}
          disabled={importErrors.length > 0 || isImporting}
        >
          {isImporting ? (
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

// Edit User Dialog Component
const EditUserDialog: React.FC<{ user: User }> = ({ user: editUser }) => {
  const { user } = useAuth();
  const { toast } = useToast();

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
                locationId: data.locationId === "none" ? null : parseInt(data.locationId),
                managerId: data.managerId === "none" ? null : parseInt(data.managerId),
                lastWorkingDay: data.lastWorkingDay || null,
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
              {/* Form fields go here - keeping them minimal for now */}
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

// Main User Management Component
export function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Import state
  const [importData, setImportData] = useState<ImportedUser[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // Queries
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const { data: processes = [], error: processError, isLoading: processesLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/processes`],
    enabled: !!user?.organizationId,
  });

  const { data: orgSettings, isLoading: orgSettingsLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/settings`],
    enabled: !!user?.organizationId,
  });

  // Import Users Mutation
  const importUsersMutation = useMutation({
    mutationFn: async (users: ImportedUser[]) => {
      console.log('Starting import mutation with users:', users);
      try {
        // Transform the data to match the API expectations
        const transformedUsers = users.map(user => {
          console.log('Processing user:', user.Username);
          // Extract process IDs
          const processIds = user.Processes && Array.isArray(processes) ?
            processes
              .filter((p: any) => {
                const userProcesses = user.Processes.toLowerCase().split(',')
                  .map(proc => proc.trim());
                const matches = userProcesses.includes(p.name?.toLowerCase());
                console.log('Process matching:', {
                  processName: p.name,
                  userProcesses,
                  matches
                });
                return matches;
              })
              .map((p: any) => p.id)
              .filter(Boolean)
            : [];

          console.log('Matched process IDs:', processIds);

          // Separate user data from process data
          const userData = {
            username: user.Username,
            fullName: user["Full Name"],
            email: user.Email,
            employeeId: user["Employee ID"],
            role: user.Role.toLowerCase(),
            phoneNumber: user["Phone Number"],
            dateOfJoining: user["Date of Joining"],
            dateOfBirth: user["Date of Birth"],
            education: user.Education,
            organizationId: user?.organizationId,
            active: true
          };

          console.log('Transformed user data:', userData);

          return {
            ...userData,
            processIds
          };
        });

        console.log('Making API request with data:', {
          users: transformedUsers,
          organizationId: user?.organizationId
        });

        const response = await apiRequest("POST", "/api/users/bulk-import", {
          users: transformedUsers,
          organizationId: user?.organizationId
        });

        console.log('API Response:', response);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('API Error:', errorData);
          throw new Error(errorData.message || "Failed to import users");
        }

        const result = await response.json();
        console.log('Import successful:', result);
        return result;
      } catch (error) {
        console.error('Import error:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Mutation success:', data);
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
      console.error('Mutation error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Helper Functions
  const getManagerName = (managerId: number | null) => {
    if (!managerId) return "No Manager";
    const manager = users.find(u => u.id === managerId);
    return manager ? manager.fullName || manager.username : "Unknown Manager";
  };

  const getLocationName = (locationId: number | null) => {
    if (!locationId) return "No Location";
    const location = orgSettings?.locations?.find((l: OrganizationLocation) => l.id === locationId);
    return location ? location.name : "Unknown Location";
  };

  // Export functionality
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

  // Template download
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
        "Processes": "Customer Service, Technical Support"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "user_import_template.xlsx");
  };

  // Import handling
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

        const errors: string[] = [];
        const processNames = Array.isArray(processes) ?
          processes.map((p: any) => p.name?.toLowerCase()).filter(Boolean) :
          [];

        const chunkSize = 100;
        for (let i = 0; i < jsonData.length; i += chunkSize) {
          const chunk = jsonData.slice(i, i + chunkSize);
          await new Promise(resolve => setTimeout(resolve, 0));

          chunk.forEach((row, index) => {
            const rowIndex = i + index + 1;
            if (!row.Username) errors.push(`Row ${rowIndex}: Username is required`);
            if (!row.Email) errors.push(`Row ${rowIndex}: Email is required`);
            if (!row.Role || !['admin', 'manager', 'advisor', 'trainer', 'trainee'].includes(row.Role.toLowerCase())) {
              errors.push(`Row ${rowIndex}: Invalid role`);
            }

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
                  <SelectItem value="team_lead">Team Lead</SelectItem>
                  <SelectItem value="qualityassurance">Quality Assurance</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Import/Export buttons */}
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.fullName}</TableCell>
                  <TableCell>
                    <Badge>{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={user.active}
                      onCheckedChange={() => toggleUserStatus(user.id, user.active, user.role)}
                      aria-label="User status"
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <EditUserDialog user={user} />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        deleteUserMutation.mutate(user.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ImportPreviewDialog
        open={showImportPreview}
        onOpenChange={setShowImportPreview}
        importData={importData}
        importErrors={importErrors}
        onImport={() => importUsersMutation.mutate(importData)}
        isImporting={importUsersMutation.isPending}
        onCancel={() => {
          setShowImportPreview(false);
          setImportData([]);
          setImportErrors([]);
        }}
      />
    </div>
  );
}