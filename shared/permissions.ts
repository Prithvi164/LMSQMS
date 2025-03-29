import { permissionEnum } from './schema';

// Define default permissions for each role
export const defaultPermissions = {
  owner: permissionEnum.enumValues.filter(p => p !== 'create_admin'), // Owner gets all permissions except create_admin
  admin: [
    'manage_users',
    'view_users',
    'edit_users',
    'delete_users',
    'upload_users',
    'manage_organization',
    'manage_performance',
    'export_reports'
  ],
  manager: [
    'view_users',
    'edit_users',
    'view_organization',
    'manage_performance',
    'manage_processes',
    'manage_batches'
  ],
  team_lead: [
    'view_users',
    'edit_users',
    'manage_performance',
    'view_organization'
  ],
  qualityassurance: [
    'view_users',
    'manage_performance',
    'export_reports',
    'view_organization'
  ],
  trainer: [
    'view_users',
    'view_performance'
  ],
  advisor: [
    'view_users',
    'view_performance',
    'export_reports'
  ]
} as const;

// Function to get default permissions for a role
export function getDefaultPermissions(role: string): string[] {
  return [...defaultPermissions[role as keyof typeof defaultPermissions] || []];
}
