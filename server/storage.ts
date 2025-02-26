import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  organizations,
  organizationProcesses,
  organizationBatches,
  organizationLocations,
  rolePermissions,
  type User,
  type InsertUser,
  type Organization,
  type InsertOrganization,
  type OrganizationProcess,
  type InsertOrganizationProcess,
  type OrganizationBatch,
  type InsertOrganizationBatch,
  type OrganizationLocation,
  type InsertOrganizationLocation,
  type RolePermission,
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  updateUserPassword(email: string, hashedPassword: string): Promise<void>;
  deleteUser(id: number): Promise<void>;
  listUsers(organizationId: number): Promise<User[]>;

  // Organization operations
  getOrganization(id: number): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganizationByName(name: string): Promise<Organization | undefined>;
  updateOrganization(id: number, org: Partial<Organization>): Promise<Organization>;
  hasOrganizationOwner(organizationId: number): Promise<boolean>;

  // Organization settings operations
  createProcess(process: InsertOrganizationProcess): Promise<OrganizationProcess>;
  createBatch(batch: InsertOrganizationBatch): Promise<OrganizationBatch>;
  createLocation(location: InsertOrganizationLocation): Promise<OrganizationLocation>;
  listProcesses(organizationId: number): Promise<OrganizationProcess[]>;
  listBatches(organizationId: number): Promise<OrganizationBatch[]>;
  listLocations(organizationId: number): Promise<OrganizationLocation[]>;

  // Role Permissions operations
  listRolePermissions(organizationId: number): Promise<RolePermission[]>;
  getRolePermissions(organizationId: number, role: string): Promise<RolePermission | undefined>;
  updateRolePermissions(organizationId: number, role: string, permissions: string[]): Promise<RolePermission>;

  // Batch Management operations
  getBatch(id: number): Promise<OrganizationBatch | undefined>;
  updateBatch(id: number, batch: Partial<InsertOrganizationBatch>): Promise<OrganizationBatch>;
  deleteBatch(id: number): Promise<void>;
  updateLocation(id: number, location: Partial<InsertOrganizationLocation>): Promise<OrganizationLocation>;
  deleteLocation(id: number): Promise<void>;
  getLocation(id: number): Promise<OrganizationLocation | undefined>;

  // Process operations
  getProcess(id: number): Promise<OrganizationProcess | undefined>;
  updateProcess(id: number, process: Partial<InsertOrganizationProcess>): Promise<OrganizationProcess>;
  deleteProcess(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)) as User[];
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)) as User[];
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)) as User[];
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning() as User[];
    return newUser;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning() as User[];
    return updatedUser;
  }

  async updateUserPassword(email: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, email));
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async listUsers(organizationId: number): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.organizationId, organizationId)) as User[];
  }

  // Organization operations
  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)) as Organization[];
    return org;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [newOrg] = await db.insert(organizations).values(org).returning() as Organization[];
    return newOrg;
  }

  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.name, name)) as Organization[];
    return org;
  }

  async updateOrganization(id: number, org: Partial<Organization>): Promise<Organization> {
    const [updatedOrg] = await db
      .update(organizations)
      .set(org)
      .where(eq(organizations.id, id))
      .returning() as Organization[];
    return updatedOrg;
  }

  async hasOrganizationOwner(organizationId: number): Promise<boolean> {
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.organizationId, organizationId))
      .where(eq(users.role, 'owner')) as User[];
    return !!owner;
  }

  // Organization settings operations
  async createProcess(process: InsertOrganizationProcess): Promise<OrganizationProcess> {
    try {
      const [newProcess] = await db.insert(organizationProcesses).values(process).returning() as OrganizationProcess[];
      return newProcess;
    } catch (error: any) {
      // Check if error is related to unique constraint violation
      if (error.code === '23505' && error.constraint_name === 'organization_processes_name_key') {
        throw new Error('A process with this name already exists. Please choose a different name.');
      }
      throw error;
    }
  }

  async createBatch(batch: InsertOrganizationBatch): Promise<OrganizationBatch> {
    const [newBatch] = await db.insert(organizationBatches).values(batch).returning() as OrganizationBatch[];
    return newBatch;
  }

  async createLocation(location: InsertOrganizationLocation): Promise<OrganizationLocation> {
    const [newLocation] = await db
      .insert(organizationLocations)
      .values({
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        country: location.country,
        organizationId: location.organizationId,
      })
      .returning() as OrganizationLocation[];
    return newLocation;
  }

  async listProcesses(organizationId: number): Promise<OrganizationProcess[]> {
    return await db
      .select()
      .from(organizationProcesses)
      .where(eq(organizationProcesses.organizationId, organizationId)) as OrganizationProcess[];
  }

  async listBatches(organizationId: number): Promise<OrganizationBatch[]> {
    return await db
      .select()
      .from(organizationBatches)
      .where(eq(organizationBatches.organizationId, organizationId)) as OrganizationBatch[];
  }

  async listLocations(organizationId: number): Promise<OrganizationLocation[]> {
    return await db
      .select()
      .from(organizationLocations)
      .where(eq(organizationLocations.organizationId, organizationId)) as OrganizationLocation[];
  }

  // Role Permissions operations
  async listRolePermissions(organizationId: number): Promise<RolePermission[]> {
    return await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.organizationId, organizationId)) as RolePermission[];
  }

  async getRolePermissions(organizationId: number, role: string): Promise<RolePermission | undefined> {
    const [permission] = await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.organizationId, organizationId))
      .where(eq(rolePermissions.role, role)) as RolePermission[];
    return permission;
  }

  async updateRolePermissions(organizationId: number, role: string, permissions: string[]): Promise<RolePermission> {
    const existingPermission = await this.getRolePermissions(organizationId, role);

    if (existingPermission) {
      const [updated] = await db
        .update(rolePermissions)
        .set({ permissions, updatedAt: new Date() })
        .where(eq(rolePermissions.id, existingPermission.id))
        .returning() as RolePermission[];
      return updated;
    } else {
      const [created] = await db
        .insert(rolePermissions)
        .values({
          role,
          permissions,
          organizationId,
        })
        .returning() as RolePermission[];
      return created;
    }
  }

  async getBatch(id: number): Promise<OrganizationBatch | undefined> {
    const [batch] = await db
      .select()
      .from(organizationBatches)
      .where(eq(organizationBatches.id, id)) as OrganizationBatch[];
    return batch;
  }

  async updateBatch(id: number, batch: Partial<InsertOrganizationBatch>): Promise<OrganizationBatch> {
    const [updatedBatch] = await db
      .update(organizationBatches)
      .set(batch)
      .where(eq(organizationBatches.id, id))
      .returning() as OrganizationBatch[];
    return updatedBatch;
  }

  async deleteBatch(id: number): Promise<void> {
    await db
      .delete(organizationBatches)
      .where(eq(organizationBatches.id, id));
  }
  async updateLocation(id: number, location: Partial<InsertOrganizationLocation>): Promise<OrganizationLocation> {
    const [updatedLocation] = await db
      .update(organizationLocations)
      .set({
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        country: location.country,
        organizationId: location.organizationId
      })
      .where(eq(organizationLocations.id, id))
      .returning() as OrganizationLocation[];

    if (!updatedLocation) {
      throw new Error('Location not found');
    }

    return updatedLocation;
  }

  async deleteLocation(id: number): Promise<void> {
    try {
      // Direct deletion without any validation checks
      await db
        .delete(organizationLocations)
        .where(eq(organizationLocations.id, id));
    } catch (error) {
      console.error('Error deleting location:', error);
      throw new Error('Failed to delete location');
    }
  }
  async getLocation(id: number): Promise<OrganizationLocation | undefined> {
    const [location] = await db
      .select()
      .from(organizationLocations)
      .where(eq(organizationLocations.id, id)) as OrganizationLocation[];
    return location;
  }

  async getProcess(id: number): Promise<OrganizationProcess | undefined> {
    const [process] = await db
      .select()
      .from(organizationProcesses)
      .where(eq(organizationProcesses.id, id)) as OrganizationProcess[];
    return process;
  }

  async updateProcess(id: number, process: Partial<InsertOrganizationProcess>): Promise<OrganizationProcess> {
    const [updatedProcess] = await db
      .update(organizationProcesses)
      .set(process)
      .where(eq(organizationProcesses.id, id))
      .returning() as OrganizationProcess[];

    if (!updatedProcess) {
      throw new Error('Process not found');
    }

    return updatedProcess;
  }

  async deleteProcess(id: number): Promise<void> {
    try {
      await db
        .delete(organizationProcesses)
        .where(eq(organizationProcesses.id, id));
    } catch (error) {
      console.error('Error deleting process:', error);
      throw new Error('Failed to delete process');
    }
  }
}

export const storage = new DatabaseStorage();