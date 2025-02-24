import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { User, Organization } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, UserCircle, Settings as SettingsIcon } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [activeUserTab, setActiveUserTab] = useState<UsersSubTab>("manage");

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
            icon={UserCircle}
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
        {activeTab === "profile" && <UserProfile />}
        {activeTab === "users" && (
          <>
            {activeUserTab === "manage" && <UserManagement />}
            {activeUserTab === "add" && (
              <AddUser
                users={users}
                user={user}
                organization={organization}
                potentialManagers={potentialManagers}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}