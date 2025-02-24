import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { User, Organization } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
    location: "",
    email: "",
    phoneNumber: "",
    processName: "",
    education: "",
    batchName: "",
    dateOfJoining: "",
    dateOfBirth: "",
    managerId: "",
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
        location: "",
        email: "",
        phoneNumber: "",
        processName: "",
        education: "",
        batchName: "",
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
              createUserMutation.mutate(newUserData);
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
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={newUserData.fullName}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, fullName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  value={newUserData.employeeId}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, employeeId: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={newUserData.role}>
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
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={newUserData.location}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, location: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  value={newUserData.phoneNumber}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  required
                />
              </div>
              {user.role === "admin" && (
                <>
                  <div>
                    <Label htmlFor="managerId">Manager</Label>
                    <Select value={newUserData.managerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {potentialManagers.map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="processName">Process Name</Label>
                <Input
                  id="processName"
                  value={newUserData.processName}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, processName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="education">Education</Label>
                <Input
                  id="education"
                  value={newUserData.education}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, education: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="batchName">Batch Name</Label>
                <Input
                  id="batchName"
                  value={newUserData.batchName}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, batchName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dateOfJoining">Date of Joining</Label>
                <Input
                  id="dateOfJoining"
                  type="date"
                  value={newUserData.dateOfJoining}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, dateOfJoining: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={newUserData.dateOfBirth}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
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