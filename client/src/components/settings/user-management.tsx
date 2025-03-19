import { useState } from "react";
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

const EditUserDialog = ({ user: editUser }: { user: User }) => {
  const { user } = useAuth();
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

export function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Queries and mutations
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const { data: processes = [], error: processError } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/processes`],
    enabled: !!user?.organizationId,
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

  // Helper functions
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

  // Render component
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage Users</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Search and filters */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center gap-4">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Role filter */}
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Users table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
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
                  <TableCell>
                    <Badge>{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={user.active}
                      onCheckedChange={() => toggleUserStatus(user.id, user.active, user.role)}
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <EditUserDialog user={user} />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setUserToDelete(user);
                        setShowDeleteDialog(true);
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
    </div>
  );
}