import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { User, Organization } from "@shared/schema";
import { UseMutationResult } from "@tanstack/react-query";

interface AddUserProps {
  createUserMutation: UseMutationResult<any, Error, any>;
  users: User[];
  user: User;
  organization: Organization | undefined;
  potentialManagers: User[];
  newUserData: any;
  setNewUserData: (data: any) => void;
  uploadUsersMutation: UseMutationResult<any, Error, File>;
}

export function AddUser({
  createUserMutation,
  users,
  user,
  organization,
  potentialManagers,
  newUserData,
  setNewUserData,
  uploadUsersMutation
}: AddUserProps) {
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
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Bulk Upload Users</h3>
              <p className="text-sm text-muted-foreground">
                Upload multiple users using CSV file
              </p>
            </div>
            <div className="space-x-2">
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
              {/* Add more form fields similar to the original form */}
              {/* This includes fields for fullName, employeeId, role (for admin), location, etc. */}
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
