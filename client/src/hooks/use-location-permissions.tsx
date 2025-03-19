import { useAuth } from "./use-auth";
import { usePermissions } from "./use-permissions";
import type { User } from "@shared/schema";

export function useLocationPermissions() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  const hasLocationAccess = (locationId: number | null): boolean => {
    if (!user) return false;

    // Owner and admin have access to all locations
    if (user.role === 'owner' || user.role === 'admin') return true;

    // Users can only access their own location
    if (user.locationId === locationId) return true;

    return false;
  };

  const filterUsersByLocation = (users: User[]): User[] => {
    if (!user) return [];

    // Owner and admin can see all users
    if (user.role === 'owner' || user.role === 'admin') return users;

    // Filter users by location for other roles
    return users.filter(u => u.locationId === user.locationId);
  };

  const canManageUserInLocation = (targetUser: User): boolean => {
    if (!user) return false;

    // Owner and admin can manage all users
    if (user.role === 'owner' || user.role === 'admin') return true;

    // Check if user has manage_users permission and is in same location
    return hasPermission('manage_users') && user.locationId === targetUser.locationId;
  };

  return {
    hasLocationAccess,
    filterUsersByLocation,
    canManageUserInLocation
  };
}