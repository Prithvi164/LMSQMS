import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function UserProfile() {
  const { user } = useAuth();

  if (!user) return null;

  // Safely handle null values for fullName
  const firstName = user.fullName?.split(' ')[0] || user.username;
  const lastName = user.fullName?.split(' ').slice(1).join(' ') || '';

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Profile Settings</h1>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-2xl">
                {user.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">{user.username}</h2>
              <p className="text-muted-foreground">{user.email}</p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline">Change Avatar</Button>
                <Button variant="outline">Edit Profile</Button>
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
          <div className="grid grid-cols-2 gap-x-12 gap-y-6">
            <div>
              <label className="text-sm text-muted-foreground">First Name</label>
              <p className="text-lg">{firstName}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Last Name</label>
              <p className="text-lg">{lastName || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Email ID</label>
              <p className="text-lg">{user.email}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Language</label>
              <p className="text-lg">English</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Country/Region</label>
              <p className="text-lg">{user.location || 'Not specified'}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Time zone</label>
              <p className="text-lg">(GMT +05:30) India Standard Time (Asia/Kolkata)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}