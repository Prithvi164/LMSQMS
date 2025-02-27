import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Settings, LogOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function UserProfile() {
  const { user, logout } = useAuth();

  // Fetch organization roles to get role description
  const { data: roles } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/roles`],
    enabled: !!user?.organizationId,
  });

  if (!user) return null;

  // Get role description from the roles data
  const userRole = roles?.find(role => role.id === user.roleId);
  const roleDisplay = userRole?.role || "Unknown Role";

  // Get the first letter of the full name, fallback to username
  const avatarLetter = user.fullName 
    ? user.fullName.charAt(0).toUpperCase()
    : user.username.charAt(0).toUpperCase();

  // Capitalize the first letter of the username
  const displayName = user.username.charAt(0).toUpperCase() + user.username.slice(1);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-3 outline-none">
        <div className="text-sm flex flex-col items-end">
          <span className="text-muted-foreground text-[13px] capitalize">{roleDisplay}</span>
          <span className="font-semibold text-[15px] leading-tight">{displayName}</span>
        </div>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="font-medium bg-[#E9D5FF] text-[#6B21A8]">
            {avatarLetter}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <Link href="/settings">
          <DropdownMenuItem className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
        </Link>
        <DropdownMenuItem onClick={() => logout()} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}