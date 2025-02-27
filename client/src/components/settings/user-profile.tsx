import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function UserProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState({
    fullName: user?.fullName || "",
    location: user?.locationId || "",
    phoneNumber: user?.phoneNumber || "",
  });

  // Fetch organization roles to get role description
  const { data: roles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["/api/organizations", user?.organizationId, "roles"],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${user?.organizationId}/roles`, {
        headers: { Accept: 'application/json' },
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch roles');
      return response.json();
    },
    enabled: !!user?.organizationId && !!user?.roleId,
  });

  if (!user) return null;

  // Get role description from the roles data
  const userRole = roles?.find(role => role.id === user.roleId);

  // Safely handle null values for fullName
  const firstName = user.fullName?.split(' ')[0] || user.username;
  const lastName = user.fullName?.split(' ').slice(1).join(' ') || '';

  // First letter capitalized for display
  const displayName = user.username.charAt(0).toUpperCase() + user.username.slice(1);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof editedUser) => {
      const res = await apiRequest("PATCH", `/api/users/${user.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Profile Settings</h1>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              {user.avatarUrl ? (
                <AvatarImage 
                  src={`${user.avatarUrl}?${Date.now()}`}
                  alt={displayName}
                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = 'none';
                  }}
                />
              ) : (
                <AvatarFallback className="text-2xl bg-[#E9D5FF] text-[#6B21A8]">
                  {displayName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>

            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">{displayName}</h2>
              <p className="text-muted-foreground">{user.email}</p>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? "Cancel" : "Edit Profile"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                updateProfileMutation.mutate(editedUser);
              }}
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={editedUser.fullName}
                    onChange={(e) => setEditedUser(prev => ({
                      ...prev,
                      fullName: e.target.value
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email ID</Label>
                  <Input
                    id="email"
                    value={user.email}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={editedUser.location}
                    onChange={(e) => setEditedUser(prev => ({
                      ...prev,
                      location: e.target.value
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    value={editedUser.phoneNumber}
                    onChange={(e) => setEditedUser(prev => ({
                      ...prev,
                      phoneNumber: e.target.value
                    }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
              <div>
                <Label className="text-sm text-muted-foreground">First Name</Label>
                <p className="text-lg">{firstName}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Last Name</Label>
                <p className="text-lg">{lastName || '-'}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Email ID</Label>
                <p className="text-lg">{user.email}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Role</Label>
                <p className="text-lg capitalize">
                  {isLoadingRoles ? (
                    <span className="flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading...
                    </span>
                  ) : userRole ? (
                    `${userRole.role} - ${userRole.description}`
                  ) : (
                    'Unknown Role'
                  )}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Location</Label>
                <p className="text-lg">{user.location || 'Not specified'}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Phone Number</Label>
                <p className="text-lg">{user.phoneNumber || 'Not specified'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}