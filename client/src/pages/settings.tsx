import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { User, Organization } from "@shared/schema";
import { Users, UserCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

// Import existing components
import { UserManagement } from "@/components/settings/user-management";
import { UserProfile } from "@/components/settings/user-profile";
import { AddUser } from "@/components/settings/add-user";
import { RolePermissions } from "@/components/settings/role-permissions";

type SettingsTab = "profile" | "users" | "permissions";
type UsersSubTab = "add" | "manage";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [activeUserTab, setActiveUserTab] = useState<UsersSubTab>("manage");

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const { data: organization, isLoading: orgLoading } = useQuery<Organization>({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  // Filter potential managers based on user's role
  const potentialManagers = users.filter(u => {
    if (user?.role === "admin") {
      return ["admin", "manager", "trainer"].includes(u.role);
    } else {
      return u.id === user?.id; // Non-admin can only assign themselves as manager
    }
  });

  if (!user) return null;

  const NavTab = ({
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
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex gap-8">
        {/* Settings Navigation */}
        <div className="w-48 space-y-2">
          <NavTab
            active={activeTab === "profile"}
            icon={UserCircle}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </NavTab>

          <NavTab
            active={activeTab === "users"}
            icon={Users}
            onClick={() => setActiveTab("users")}
          >
            Users
          </NavTab>

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

          <NavTab
            active={activeTab === "permissions"}
            icon={Shield}
            onClick={() => setActiveTab("permissions")}
          >
            Roles & Permissions
          </NavTab>
        </div>

        {/* Content Area */}
        <div className="flex-1 max-w-4xl">
          {usersLoading || orgLoading ? (
            <div>Loading...</div>
          ) : (
            <>
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
              {activeTab === "permissions" && <RolePermissions />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}