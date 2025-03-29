import { db } from './db';
import { roles, permissions } from '../shared/schema';
import { permissionEnum } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Define default permissions for each role
export const defaultPermissions = {
  owner: permissionEnum.enumValues, // Owner gets all permissions
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
export async function getDefaultPermissions(role: string): Promise<string[]> {
  try {
    // First check if role has custom permissions in database
    const customPerms = await db.select().from(permissions)
      .where(eq(permissions.role, role));

    if (customPerms.length > 0) {
      return customPerms[0].permissions;
    }

    // If no custom permissions, initialize with defaults and return
    const defaultPerms = defaultPermissions[role as keyof typeof defaultPermissions] || [];
    await db.insert(permissions).values({
      role: role,
      permissions: defaultPerms
    }).onConflictDoNothing();

    return defaultPerms;
  } catch (error) {
    console.error('Error getting permissions:', error);
    return defaultPermissions[role as keyof typeof defaultPermissions] || [];
  }
}

// Function to initialize default permissions for all roles
export async function initializeDefaultPermissions() {
  try {
    const roles = Object.keys(defaultPermissions);
    for (const role of roles) {
      await db.insert(permissions).values({
        role: role,
        permissions: defaultPermissions[role as keyof typeof defaultPermissions]
      }).onConflictDoNothing();
    }
    console.log('Default permissions initialized');
  } catch (error) {
    console.error('Error initializing permissions:', error);
  }
}