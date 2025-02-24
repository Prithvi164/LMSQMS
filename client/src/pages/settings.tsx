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

  if (!user) return null;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="addUser">Add User</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>View your profile settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Username</Label>
                  <Input value={user.username} disabled />
                </div>
                <div>
                  <Label>Full Name</Label>
                  <Input value={user.fullName} disabled />
                </div>
                <div>
                  <Label>Employee ID</Label>
                  <Input value={user.employeeId} disabled />
                </div>
                <div>
                  <Label>Role</Label>
                  <Input value={user.role} className="capitalize" disabled />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={user.location} disabled />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={user.email} disabled />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input value={user.phoneNumber} disabled />
                </div>
                <div>
                  <Label>Process Name</Label>
                  <Input value={user.processName || "N/A"} disabled />
                </div>
                <div>
                  <Label>Education</Label>
                  <Input value={user.education || "N/A"} disabled />
                </div>
                <div>
                  <Label>Batch Name</Label>
                  <Input value={user.batchName || "N/A"} disabled />
                </div>
                <div>
                  <Label>Date of Joining</Label>
                  <Input 
                    value={user.dateOfJoining ? new Date(user.dateOfJoining).toLocaleDateString() : "N/A"} 
                    disabled 
                  />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input 
                    value={user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : "N/A"} 
                    disabled 
                  />
                </div>
                {user.managerId && (
                  <div>
                    <Label>Manager</Label>
                    <Input 
                      value={users.find(u => u.id === user.managerId)?.username || ""} 
                      disabled 
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addUser">
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
                      onChange={(e) => setNewUserData(prev => ({
                        ...prev,
                        fullName: e.target.value
                      }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="employeeId">Employee ID</Label>
                    <Input
                      id="employeeId"
                      value={newUserData.employeeId}
                      onChange={(e) => setNewUserData(prev => ({
                        ...prev,
                        employeeId: e.target.value
                      }))}
                      required
                    />
                  </div>
                  {user.role === "admin" && (
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={newUserData.role}
                        onValueChange={(value) => setNewUserData(prev => ({
                          ...prev,
                          role: value,
                          managerId: value === "trainee" ? prev.managerId : ""
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="trainer">Trainer</SelectItem>
                          <SelectItem value="trainee">Trainee</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Select
                      value={newUserData.location}
                      onValueChange={(value) => setNewUserData(prev => ({
                        ...prev,
                        location: value
                      }))}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {organization?.locations.map(location => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData(prev => ({
                        ...prev,
                        email: e.target.value
                      }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      value={newUserData.phoneNumber}
                      onChange={(e) => setNewUserData(prev => ({
                        ...prev,
                        phoneNumber: e.target.value
                      }))}
                      required
                      pattern="\d{10}"
                      title="Phone number must be 10 digits"
                    />
                  </div>
                  <div>
                    <Label htmlFor="processName">Process Name</Label>
                    <Select
                      value={newUserData.processName}
                      onValueChange={(value) => setNewUserData(prev => ({
                        ...prev,
                        processName: value
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select process" />
                      </SelectTrigger>
                      <SelectContent>
                        {organization?.processNames.map(process => (
                          <SelectItem key={process} value={process}>
                            {process}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="education">Education</Label>
                    <Select
                      value={newUserData.education}
                      onValueChange={(value) => setNewUserData(prev => ({
                        ...prev,
                        education: value
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select education" />
                      </SelectTrigger>
                      <SelectContent>
                        {organization?.educationOptions.map(option => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="batchName">Batch Name</Label>
                    <Select
                      value={newUserData.batchName}
                      onValueChange={(value) => setNewUserData(prev => ({
                        ...prev,
                        batchName: value
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {organization?.batchNames.map(batch => (
                          <SelectItem key={batch} value={batch}>
                            {batch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="dateOfJoining">Date of Joining</Label>
                    <Input
                      id="dateOfJoining"
                      type="date"
                      value={newUserData.dateOfJoining}
                      onChange={(e) => setNewUserData(prev => ({
                        ...prev,
                        dateOfJoining: e.target.value
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={newUserData.dateOfBirth}
                      onChange={(e) => setNewUserData(prev => ({
                        ...prev,
                        dateOfBirth: e.target.value
                      }))}
                    />
                  </div>
                  {(newUserData.role === "trainee" || newUserData.role === "trainer") && (
                    <div>
                      <Label htmlFor="manager">Reporting Person</Label>
                      <Select
                        value={newUserData.managerId}
                        onValueChange={(value) => setNewUserData(prev => ({
                          ...prev,
                          managerId: value
                        }))}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select reporting person" />
                        </SelectTrigger>
                        <SelectContent>
                          {potentialManagers.map(manager => (
                            <SelectItem key={manager.id} value={manager.id.toString()}>
                              {manager.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <Button 
                  type="submit" 
                  className="w-full mt-6"
                  disabled={createUserMutation.isPending}
                >
                  Create User
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}