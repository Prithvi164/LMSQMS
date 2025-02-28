import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  organizations,
  organizationProcesses,
  organizationBatches,
  organizationLineOfBusinesses,
  rolePermissions,
  userProcesses,
  type User,
  type InsertUser,
  type Organization,
  type InsertOrganization,
  type OrganizationProcess,
  type InsertOrganizationProcess,
  type OrganizationBatch,
  type InsertOrganizationBatch,
  type RolePermission,
  type OrganizationLineOfBusiness,
  type InsertOrganizationLineOfBusiness,
  type UserProcess,
  type InsertUserProcess,
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

  // User Process operations
  assignProcessesToUser(processes: InsertUserProcess[]): Promise<UserProcess[]>;
  getUserProcesses(userId: number): Promise<UserProcess[]>;
  removeUserProcess(userId: number, processId: number): Promise<void>;

  // Organization operations
  getOrganization(id: number): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganizationByName(name: string): Promise<Organization | undefined>;
  updateOrganization(id: number, org: Partial<Organization>): Promise<Organization>;
  hasOrganizationOwner(organizationId: number): Promise<boolean>;

  // Organization settings operations
  createProcess(process: InsertOrganizationProcess): Promise<OrganizationProcess>;
  createBatch(batch: InsertOrganizationBatch): Promise<OrganizationBatch>;
  listProcesses(organizationId: number): Promise<OrganizationProcess[]>;
  listBatches(organizationId: number): Promise<OrganizationBatch[]>;

  // Role Permissions operations
  listRolePermissions(organizationId: number): Promise<RolePermission[]>;
  getRolePermissions(organizationId: number, role: string): Promise<RolePermission | undefined>;
  updateRolePermissions(organizationId: number, role: string, permissions: string[]): Promise<RolePermission>;

  // Batch Management operations
  getBatch(id: number): Promise<OrganizationBatch | undefined>;
  updateBatch(id: number, batch: Partial<InsertOrganizationBatch>): Promise<OrganizationBatch>;
  deleteBatch(id: number): Promise<void>;

  // Process operations
  getProcess(id: number): Promise<OrganizationProcess | undefined>;
  updateProcess(id: number, process: Partial<InsertOrganizationProcess>): Promise<OrganizationProcess>;
  deleteProcess(id: number): Promise<void>;

  // Line of Business operations
  createLineOfBusiness(lob: InsertOrganizationLineOfBusiness): Promise<OrganizationLineOfBusiness>;
  getLineOfBusiness(id: number): Promise<OrganizationLineOfBusiness | undefined>;
  listLineOfBusinesses(organizationId: number): Promise<OrganizationLineOfBusiness[]>;
  updateLineOfBusiness(id: number, lob: Partial<InsertOrganizationLineOfBusiness>): Promise<OrganizationLineOfBusiness>;
  deleteLineOfBusiness(id: number): Promise<void>;

  // Add new method for creating user with processes
  createUserWithProcesses(
    user: InsertUser,
    processIds: number[],
    organizationId: number
  ): Promise<{ user: User; processes: UserProcess[] }>;

  // Add new method for getting processes by line of business
  getProcessesByLineOfBusiness(organizationId: number, lobId: number): Promise<OrganizationProcess[]>;
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
    try {
      console.log(`Attempting to delete user with ID: ${id}`);

      // First, verify the user exists
      const user = await this.getUser(id);
      if (!user) {
        console.log(`User with ID ${id} not found`);
        throw new Error('User not found');
      }

      console.log(`Found user to delete:`, {
        id: user.id,
        username: user.username,
        role: user.role
      });

      // Perform the deletion
      const result = await db
        .delete(users)
        .where(eq(users.id, id))
        .returning();

      console.log(`Deletion result:`, result);

      if (!result.length) {
        throw new Error('User deletion failed');
      }

      console.log(`Successfully deleted user with ID: ${id}`);
    } catch (error) {
      console.error('Error in deleteUser:', error);
      throw error;
    }
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
      // First check if process with same name exists in the organization
      const existingProcess = await db
        .select()
        .from(organizationProcesses)
        .where(eq(organizationProcesses.name, process.name))
        .where(eq(organizationProcesses.organizationId, process.organizationId))
        .limit(1);

      if (existingProcess.length > 0) {
        throw new Error('A process with this name already exists in this organization');
      }

      const [newProcess] = await db
        .insert(organizationProcesses)
        .values(process)
        .returning() as OrganizationProcess[];

      return newProcess;
    } catch (error: any) {
      console.error('Error creating process:', error);
      throw error;
    }
  }

  async createBatch(batch: InsertOrganizationBatch): Promise<OrganizationBatch> {
    const [newBatch] = await db.insert(organizationBatches).values(batch).returning() as OrganizationBatch[];
    return newBatch;
  }

  async listProcesses(organizationId: number): Promise<OrganizationProcess[]> {
    try {
      console.log(`Fetching processes for organization ${organizationId}`);
      const processes = await db
        .select()
        .from(organizationProcesses)
        .where(eq(organizationProcesses.organizationId, organizationId)) as OrganizationProcess[];

      console.log(`Found ${processes.length} processes`);
      return processes;
    } catch (error) {
      console.error('Error fetching processes:', error);
      throw new Error('Failed to fetch processes');
    }
  }

  async listBatches(organizationId: number): Promise<OrganizationBatch[]> {
    try {
      console.log(`Fetching batches for organization ${organizationId}`);
      const batches = await db
        .select()
        .from(organizationBatches)
        .where(eq(organizationBatches.organizationId, organizationId)) as OrganizationBatch[];
      console.log(`Found ${batches.length} batches`);
      return batches;
    } catch (error) {
      console.error('Error fetching batches:', error);
      throw new Error('Failed to fetch batches');
    }
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

  // Process operations
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

  // Line of Business operations
  async createLineOfBusiness(lob: InsertOrganizationLineOfBusiness): Promise<OrganizationLineOfBusiness> {
    try {
      const [newLob] = await db
        .insert(organizationLineOfBusinesses)
        .values(lob)
        .returning() as OrganizationLineOfBusiness[];
      return newLob;
    } catch (error: any) {
      if (error.code === '23505') {
        throw new Error('A Line of Business with this name already exists.');
      }
      throw error;
    }
  }

  async getLineOfBusiness(id: number): Promise<OrganizationLineOfBusiness | undefined> {
    const [lob] = await db
      .select()
      .from(organizationLineOfBusinesses)
      .where(eq(organizationLineOfBusinesses.id, id)) as OrganizationLineOfBusiness[];
    return lob;
  }

  async listLineOfBusinesses(organizationId: number): Promise<OrganizationLineOfBusiness[]> {
    return await db
      .select()
      .from(organizationLineOfBusinesses)
      .where(eq(organizationLineOfBusinesses.organizationId, organizationId)) as OrganizationLineOfBusiness[];
  }

  async updateLineOfBusiness(id: number, lob: Partial<InsertOrganizationLineOfBusiness>): Promise<OrganizationLineOfBusiness> {
    const [updatedLob] = await db
      .update(organizationLineOfBusinesses)
      .set(lob)
      .where(eq(organizationLineOfBusinesses.id, id))
      .returning() as OrganizationLineOfBusiness[];

    if (!updatedLob) {
      throw new Error('Line of Business not found');
    }

    return updatedLob;
  }

  async deleteLineOfBusiness(id: number): Promise<void> {
    try {
      await db
        .delete(organizationLineOfBusinesses)
        .where(eq(organizationLineOfBusinesses.id, id));
    } catch (error) {
      console.error('Error deleting Line of Business:', error);
      throw new Error('Failed to delete Line of Business');
    }
  }

  // Add new methods for user process management
  async assignProcessesToUser(processes: InsertUserProcess[]): Promise<UserProcess[]> {
    try {
      const assignedProcesses = await db
        .insert(userProcesses)
        .values(processes)
        .returning() as UserProcess[];
      return assignedProcesses;
    } catch (error) {
      console.error('Error assigning processes to user:', error);
      throw new Error('Failed to assign processes to user');
    }
  }

  async getUserProcesses(userId: number): Promise<UserProcess[]> {
    try {
      const processes = await db
        .select({
          id: userProcesses.id,
          userId: userProcesses.userId,
          processId: userProcesses.processId,
          organizationId: userProcesses.organizationId,
          status: userProcesses.status,
          assignedAt: userProcesses.assignedAt,
          completedAt: userProcesses.completedAt,
          processName: organizationProcesses.name,
        })
        .from(userProcesses)
        .leftJoin(
          organizationProcesses,
          eq(userProcesses.processId, organizationProcesses.id)
        )
        .where(eq(userProcesses.userId, userId)) as UserProcess[];

      return processes;
    } catch (error) {
      console.error('Error fetching user processes:', error);
      throw new Error('Failed to fetch user processes');
    }
  }

  async removeUserProcess(userId: number, processId: number): Promise<void> {
    try {
      await db
        .delete(userProcesses)
        .where(eq(userProcesses.userId, userId))
        .where(eq(userProcesses.processId, processId));
    } catch (error) {
      console.error('Error removing user process:', error);
      throw new Error('Failed to remove user process');
    }
  }
  async createUserWithProcesses(
    user: InsertUser,
    processIds: number[],
    organizationId: number
  ): Promise<{ user: User; processes: UserProcess[] }> {
    try {
      // Start a transaction to ensure both user and process assignments succeed or fail together
      return await db.transaction(async (tx) => {
        // Create the user first
        const [newUser] = await tx
          .insert(users)
          .values(user)
          .returning() as User[];

        // If no processes needed (for admin/owner roles) or no processes specified
        if (!processIds?.length || user.role === 'admin' || user.role === 'owner') {
          return { user: newUser, processes: [] };
        }

        // Create process assignments
        const processAssignments = processIds.map(processId => ({
          userId: newUser.id,
          processId,
          organizationId,
          status: 'assigned'
        }));

        const assignedProcesses = await tx
          .insert(userProcesses)
          .values(processAssignments)
          .returning() as UserProcess[];

        return {
          user: newUser,
          processes: assignedProcesses
        };
      });
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        if (error.constraint.includes('username')) {
          throw new Error('Username already exists. Please choose a different username.');
        }
        if (error.constraint.includes('email')) {
          throw new Error('Email already exists. Please use a different email address.');
        }
      }
      console.error('Error in createUserWithProcesses:', error);
      throw error;
    }
  }

  async getProcessesByLineOfBusiness(organizationId: number, lobId: number): Promise<OrganizationProcess[]> {
    try {
      const processes = await db
        .select()
        .from(organizationProcesses)
        .where(eq(organizationProcesses.organizationId, organizationId))
        .where(eq(organizationProcesses.lineOfBusinessId, lobId)) as OrganizationProcess[];

      return processes;
    } catch (error) {
      console.error('Error fetching processes by LOB:', error);
      throw new Error('Failed to fetch processes for Line of Business');
    }
  }
}

export const storage = new DatabaseStorage();