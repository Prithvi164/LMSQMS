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
import type { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    role: "trainee",
    managerId: "",
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
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
        role: "trainee",
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

  if (!user) return null;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="users">Manage Users</TabsTrigger>
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
                  <Label>Role</Label>
                  <Input value={user.role} className="capitalize" disabled />
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

        <TabsContent value="users">
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
                {(newUserData.role === "trainee" || newUserData.role === "trainer") && (
                  <div>
                    <Label htmlFor="manager">Assign Manager</Label>
                    <Select
                      value={newUserData.managerId}
                      onValueChange={(value) => setNewUserData(prev => ({
                        ...prev,
                        managerId: value
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select manager" />
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
                <Button 
                  type="submit" 
                  className="w-full"
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