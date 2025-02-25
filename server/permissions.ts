import { permissionEnum } from '@shared/schema';

// Define default permissions for each role
export const defaultPermissions = {
  owner: permissionEnum.enumValues, // Owner gets all permissions
  admin: [
    'manage_users',
    'view_users',
    'edit_users',
    'delete_users',
    'upload_users',
    'manage_courses',
    'manage_learning_paths',
    'manage_organization',
    'manage_performance',
    'export_reports'
  ],
  manager: [
    'view_users',
    'edit_users',
    'manage_courses',
    'view_learning_paths',
    'view_organization',
    'manage_performance'
  ],
  trainer: [
    'view_users',
    'manage_courses',
    'view_learning_paths',
    'view_performance'
  ],
  trainee: [
    'view_courses',
    'view_learning_paths',
    'view_performance'
  ],
  advisor: [
    'view_users',
    'view_courses',
    'view_learning_paths',
    'view_performance',
    'export_reports'
  ],
  team_lead: [
    'view_users',
    'edit_users',
    'view_courses',
    'view_learning_paths',
    'manage_performance'
  ]
} as const;

// Function to get default permissions for a role
export function getDefaultPermissions(role: string): string[] {
  return [...defaultPermissions[role as keyof typeof defaultPermissions] || []];
}