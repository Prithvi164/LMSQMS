import { db } from './db';
import { permissionEnum, rolePermissions } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Define default permissions for each role
export const defaultPermissions = {
  owner: Array.from(permissionEnum.enumValues).filter(p => p !== 'create_admin' as any), // Owner gets all permissions except create_admin
  admin: [
    'manage_users',
    'view_users',
    'edit_users',
    'delete_users',
    'upload_users',
    'add_users',
    'manage_organization',
    'manage_performance',
    'export_reports'
  ],
  manager: [
    'view_users',
    'edit_users',
    'add_users',
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
  quality_analyst: [
    'view_users',
    'manage_performance',
    'export_reports',
    'view_organization',
    'add_users'  // Added the add_users permission here
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
    // Handle specific role mapping to ensure backward compatibility
    const mappedRole = role === 'qualityassurance' ? 'quality_analyst' : role;
    
    // First check if role has custom permissions in database
    const customPerms = await db.select().from(rolePermissions)
      .where(eq(rolePermissions.role, mappedRole as any));

    if (customPerms.length > 0) {
      return customPerms[0].permissions;
    }

    // If no custom permissions, initialize with defaults and return
    const defaultPerms = defaultPermissions[mappedRole as keyof typeof defaultPermissions] || [];
    // Convert to string[] to avoid readonly type issues
    const permissionsArray = Array.isArray(defaultPerms) ? [...defaultPerms] : [];
    await db.insert(rolePermissions).values({
      role: mappedRole,
      permissions: permissionsArray,
      organizationId: 1 // Default organization ID
    }).onConflictDoNothing();

    // Convert to string[] to avoid readonly type issues for return
    return Array.isArray(defaultPerms) ? [...defaultPerms] : [];
  } catch (error) {
    console.error('Error getting permissions:', error);
    const fallbackPerms = defaultPermissions[role as keyof typeof defaultPermissions] || [];
    return Array.isArray(fallbackPerms) ? [...fallbackPerms] : [];
  }
}

// Function to initialize default permissions for all roles
export async function initializeDefaultPermissions() {
  try {
    const roles = Object.keys(defaultPermissions);
    for (const role of roles) {
      const defaultPerms = defaultPermissions[role as keyof typeof defaultPermissions];
      // Convert to string[] to avoid readonly type issues
      const permissionsArray = Array.isArray(defaultPerms) ? [...defaultPerms] : [];
      
      await db.insert(rolePermissions).values({
        role: role,
        permissions: permissionsArray,
        organizationId: 1 // Default organization ID
      }).onConflictDoNothing();
    }
    console.log('Default permissions initialized');
  } catch (error) {
    console.error('Error initializing permissions:', error);
  }
}