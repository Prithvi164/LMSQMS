import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { User, Organization } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { Edit2, Trash2, Download, Upload, Users, Settings as SettingsIcon, type Icon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Import existing components
import { UserManagement } from "@/components/settings/user-management";
import { UserProfile } from "@/components/settings/user-profile";
import { AddUser } from "@/components/settings/add-user";

type SettingsTab = "profile" | "users";
type UsersSubTab = "add" | "manage";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    fullName: "",
    employeeId: "",
    role: "trainee",
    batchName: "",
    managerId: "",
    location: "",
    email: "",
    processName: "",
    education: "",
    dateOfJoining: "",
    phoneNumber: "",
    dateOfBirth: "",
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const { data: organization } = useQuery<Organization>({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  // Filter potential managers based on user's role
  const potentialManagers = users.filter(u => {
    if (user?.role === "admin") {
      return ["manager", "trainer"].includes(u.role);
    } else {
      return u.id === user?.id; // Non-admin can only assign themselves as manager
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof newUserData) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
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
        batchName: "",
        managerId: "",
        location: "",
        email: "",
        processName: "",
        education: "",
        dateOfJoining: "",
        phoneNumber: "",
        dateOfBirth: "",
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
    mutationFn: async ({ id, data }: { id: number; data: Partial<User> }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      return res.json();
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

  const uploadUsersMutation = useMutation({
    mutationFn: async (file: File) => {
      // Validate file before upload
      if (!file) {
        throw new Error('Please select a file');
      }

      const formData = new FormData();
      formData.append('file', file);

      const res = await apiRequest("POST", "/api/users/upload", formData, {
        // Important: Don't set Content-Type, let browser handle it
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Upload failed');
      }

      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Complete",
        description: `Successfully added ${data.success} users. ${data.failures.length > 0 ?
          `Failed to add ${data.failures.length} users.` : ''}`,
        variant: data.failures.length > 0 ? "destructive" : "default"
      });
      if (data.failures.length > 0) {
        console.error('Failed rows:', data.failures);
      }
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

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [activeUserTab, setActiveUserTab] = useState<UsersSubTab>("manage");

  if (!user) return null;

  const NavButton = ({
    active,
    icon: Icon,
    children,
    onClick
  }: {
    active: boolean;
    icon: any;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full p-2 rounded-lg text-left transition-colors",
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{children}</span>
    </button>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left Sidebar */}
      <div className="w-64 border-r p-4 space-y-4">
        <h2 className="font-semibold mb-4 px-2">Settings</h2>
        <div className="space-y-2">
          <NavButton
            active={activeTab === "profile"}
            icon={User}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </NavButton>
          <NavButton
            active={activeTab === "users"}
            icon={Users}
            onClick={() => setActiveTab("users")}
          >
            Users
          </NavButton>

          {/* Show user sub-tabs only when users tab is active */}
          {activeTab === "users" && (
            <div className="pl-6 space-y-2 mt-2">
              <button
                onClick={() => setActiveUserTab("manage")}
                className={cn(
                  "w-full text-left p-2 rounded-lg transition-colors",
                  activeUserTab === "manage" ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Manage Users
              </button>
              <button
                onClick={() => setActiveUserTab("add")}
                className={cn(
                  "w-full text-left p-2 rounded-lg transition-colors",
                  activeUserTab === "add" ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Add User
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === "profile" && <UserProfile user={user} />}
        {activeTab === "users" && (
          <>
            {activeUserTab === "manage" && <UserManagement users={users} user={user} updateUserMutation={updateUserMutation} deleteUserMutation={deleteUserMutation} />}
            {activeUserTab === "add" && <AddUser createUserMutation={createUserMutation} users={users} user={user} organization={organization} potentialManagers={potentialManagers} newUserData={newUserData} setNewUserData={setNewUserData} uploadUsersMutation={uploadUsersMutation}/>}
          </>
        )}
      </div>
    </div>
  );
}