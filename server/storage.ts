import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  organizations,
  organizationProcesses,
  organizationBatches,
  organizationLineOfBusinesses,
  organizationLocations,
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
  type OrganizationLocation,
  type InsertOrganizationLocation,
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
  listProcesses(organizationId: number): Promise<OrganizationProcess[]>;

  // Role Permissions operations
  listRolePermissions(organizationId: number): Promise<RolePermission[]>;
  getRolePermissions(organizationId: number, role: string): Promise<RolePermission | undefined>;
  updateRolePermissions(organizationId: number, role: string, permissions: string[]): Promise<RolePermission>;

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

  // Location operations
  listLocations(organizationId: number): Promise<OrganizationLocation[]>;
  updateLocation(id: number, location: Partial<InsertOrganizationLocation>): Promise<OrganizationLocation>;
  deleteLocation(id: number): Promise<void>;
  createLocation(location: InsertOrganizationLocation): Promise<OrganizationLocation>;

  // Batch operations
  createBatch(batch: InsertOrganizationBatch): Promise<OrganizationBatch>;
  getBatch(id: number): Promise<OrganizationBatch | undefined>;
  listBatches(organizationId: number): Promise<OrganizationBatch[]>;
  updateBatch(id: number, batch: Partial<InsertOrganizationBatch>): Promise<OrganizationBatch>;
  deleteBatch(id: number): Promise<void>;

  // Add new methods for user filtering
  getActiveManagersByLocation(locationId: number): Promise<User[]>;
  getActiveTrainersByManager(managerId: number): Promise<User[]>;
  getActiveTrainersByLocationAndProcess(locationId: number, processId: number): Promise<User[]>;

  // Add new method for LOB filtering
  getLineOfBusinessesByLocation(locationId: number, organizationId: number): Promise<OrganizationLineOfBusiness[]>;
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
    try {
      console.log(`Attempting to update user with ID: ${id}`, user);

      // Check if username is being updated and if it would conflict
      if (user.username) {
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.username, user.username))
          .then(results => results.find(u => u.id !== id));

        if (existingUser) {
          throw new Error('Username already exists. Please choose a different username.');
        }
      }

      return await db.transaction(async (tx) => {
        // Update user
        const [updatedUser] = await tx
          .update(users)
          .set({
            ...user,
            // Ensure we're not overwriting these fields unintentionally
            id: undefined,
            createdAt: undefined,
          })
          .where(eq(users.id, id))
          .returning() as User[];

        if (!updatedUser) {
          throw new Error('User not found');
        }

        // If location is being updated, also update user_processes
        if (user.locationId) {
          await tx
            .update(userProcesses)
            .set({ locationId: user.locationId })
            .where(eq(userProcesses.userId, id));
        }

        console.log('Successfully updated user:', updatedUser);
        return updatedUser;
      });
    } catch (error: any) {
      console.error('Error updating user:', error);
      throw error;
    }
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

      // Use a transaction to ensure data consistency
      await db.transaction(async (tx) => {
        // First, delete all user processes for this user
        await tx
          .delete(userProcesses)
          .where(eq(userProcesses.userId, id));

        console.log(`Deleted user processes for user ${id}`);

        // Update any users that have this user as their manager
        await tx
          .update(users)
          .set({ managerId: null })
          .where(eq(users.managerId, id));

        console.log(`Updated manager references for user ${id}`);

        // Finally delete the user
        const result = await tx
          .delete(users)
          .where(eq(users.id, id))
          .returning();

        if (!result.length) {
          throw new Error('User deletion failed');
        }

        console.log(`Successfully deleted user with ID: ${id}`);
      });
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
      console.log('Creating process with data:', process);

      // First check if process with same name exists in the organization
      const existingProcesses = await db
        .select()
        .from(organizationProcesses)
        .where(eq(organizationProcesses.organizationId, process.organizationId));

      console.log('Found existing processes:', existingProcesses);

      const nameExists = existingProcesses.some(
        existing => existing.name.toLowerCase() === process.name.toLowerCase()
      );

      if (nameExists) {
        throw new Error('A process with this name already exists in this organization');
      }

      const [newProcess] = await db
        .insert(organizationProcesses)
        .values(process)
        .returning() as OrganizationProcess[];

      console.log('Successfully created new process:', newProcess);
      return newProcess;
    } catch (error: any) {
      console.error('Error creating process:', error);
      throw error;
    }
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


  // Process operations
  async getProcess(id: number): Promise<OrganizationProcess | undefined> {
    const [process] = await db
      .select()
      .from(organizationProcesses)
      .where(eq(organizationProcesses.id, id)) as OrganizationProcess[];
    return process;
  }

  async updateProcess(id: number, process: Partial<InsertOrganizationProcess>): Promise<OrganizationProcess> {
    try {
      console.log(`Attempting to update process with ID: ${id}`);
      console.log('Update data:', process);

      // Check if process exists
      const existingProcess = await this.getProcess(id);
      if (!existingProcess) {
        throw new Error('Process not found');
      }

      // Check if name is being updated and if it would conflict
      if (process.name && process.name !== existingProcess.name) {
        const nameExists = await db
          .select()
          .from(organizationProcesses)
          .where(eq(organizationProcesses.organizationId, existingProcess.organizationId))
          .where(eq(organizationProcesses.name, process.name))
          .then(results => results.length > 0);

        if (nameExists) {
          throw new Error('A process with this name already exists in this organization');
        }
      }

      const [updatedProcess] = await db
        .update(organizationProcesses)
        .set({
          ...process,
          updatedAt: new Date()
        })
        .where(eq(organizationProcesses.id, id))
        .returning() as OrganizationProcess[];

      console.log('Process updated successfully:', updatedProcess);
      return updatedProcess;
    } catch (error: any) {
      console.error('Error updating process:', error);
      throw error;
    }
  }

  async deleteProcess(id: number): Promise<void> {
    try {
      console.log(`Attempting to delete process with ID: ${id}`);

      // First verify the process exists
      const process = await this.getProcess(id);
      if (!process) {
        console.log(`Process with ID ${id} not found`);
        throw new Error('Process not found');
      }

      // Delete any associated user processes first
      await db
        .delete(userProcesses)
        .where(eq(userProcesses.processId, id));

      // Then delete the process
      const result = await db
        .delete(organizationProcesses)
        .where(eq(organizationProcesses.id, id))
        .returning();

      if (!result.length) {
        throw new Error('Process deletion failed');
      }

      console.log(`Successfully deleted process with ID: ${id}`);
    } catch (error) {
      console.error('Error deleting process:', error);
      throw error;
    }
  }

  // Line of Business operations
  async createLineOfBusiness(lob: InsertOrganizationLineOfBusiness): Promise<OrganizationLineOfBusiness> {
    try {
      console.log('Creating new line of business:', lob);

      // Check if LOB with same name exists in the organization
      const existing = await db
        .select()
        .from(organizationLineOfBusinesses)
        .where(eq(organizationLineOfBusinesses.organizationId, lob.organizationId))
        .where(eq(organizationLineOfBusinesses.name, lob.name));

      if (existing.length > 0) {
        throw new Error('A Line of Business with this name already exists in this organization');
      }

      const [newLob] = await db
        .insert(organizationLineOfBusinesses)
        .values(lob)
        .returning() as OrganizationLineOfBusiness[];

      console.log('Successfully created new line of business:', newLob);
      return newLob;
    } catch (error: any) {
      console.error('Error creating line of business:', error);
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
    try {
      console.log(`Fetching line of businesses for organization ${organizationId}`);

      const lineOfBusinesses = await db
        .select()
        .from(organizationLineOfBusinesses)
        .where(eq(organizationLineOfBusinesses.organizationId, organizationId)) as OrganizationLineOfBusiness[];

      console.log(`Successfully found ${lineOfBusinesses.length} line of businesses`);
      return lineOfBusinesses;
    } catch (error: any) {
      console.error('Error fetching line of businesses:', error);
      throw new Error(`Failed to fetch line of businesses: ${error.message}`);
    }
  }

  async updateLineOfBusiness(id: number, lob: Partial<InsertOrganizationLineOfBusiness>): Promise<OrganizationLineOfBusiness> {
    try {
      console.log(`Updating Line of Business with ID: ${id}`, lob);

      // Check if name is being updated and if it would conflict
      if (lob.name) {
        const nameExists = await db
          .select()
          .from(organizationLineOfBusinesses)
          .where(eq(organizationLineOfBusinesses.organizationId, lob.organizationId))
          .where(eq(organizationLineOfBusinesses.name, lob.name))
          .then(results => results.some(l => l.id !== id));

        if (nameExists) {
          throw new Error('A Line of Business with this name already exists in this organization');
        }
      }

      const [updatedLob] = await db
        .update(organizationLineOfBusinesses)
        .set({
          ...lob,
          // Ensure we're not overwriting these fields unintentionally
          id: undefined,
          createdAt: undefined,
        })
        .where(eq(organizationLineOfBusinesses.id, id))
        .returning() as OrganizationLineOfBusiness[];

      if (!updatedLob) {
        throw new Error('Line of Business not found');
      }

      console.log('Successfully updated Line of Business:', updatedLob);
      return updatedLob;
    } catch (error) {
      console.error('Error updating Line of Business:', error);
      throw error;
    }
  }

  async deleteLineOfBusiness(id: number): Promise<void> {
    try {
      console.log(`Attempting to delete Line of Business with ID: ${id}`);

      // Use a transaction to ensure data consistency
      await db.transaction(async (tx) => {
        // First update all processes that reference this LOB
        await tx
          .update(organizationProcesses)
          .set({ lineOfBusinessId: null })
          .where(eq(organizationProcesses.lineOfBusinessId, id));

        console.log(`Updated processes' LOB references to null`);

        // Then delete the LOB
        const result = await tx
          .delete(organizationLineOfBusinesses)
          .where(eq(organizationLineOfBusinesses.id, id))
          .returning();

        if (!result.length) {
          throw new Error('Line of Business not found or deletion failed');
        }

        console.log(`Successfully deleted Line of Business with ID: ${id}`);
      });
    } catch (error) {
      console.error('Error deleting Line of Business:', error);
      throw error;
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

        // Get the processes to get their line of business IDs
        const processes = await tx
          .select()
          .from(organizationProcesses)
          .where(sql`${organizationProcesses.id} IN (${sql.join(processIds, sql`, `)})`);

        // Create process assignments with line of business IDs and location ID
        const processAssignments = processes.map(process => ({
          userId: newUser.id,
          processId: process.id,
          organizationId,
          lineOfBusinessId: process.lineOfBusinessId,
          locationId: newUser.locationId,
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

  async listLocations(organizationId: number): Promise<OrganizationLocation[]> {
    try {
      console.log(`Fetching locations for organization ${organizationId}`);

      // Get locations through user_processes table
      const locations = await db
        .selectDistinct({
          id: organizationLocations.id,
          name: organizationLocations.name,
          address: organizationLocations.address,
          city: organizationLocations.city,
          state: organizationLocations.state,
          country: organizationLocations.country,
          organizationId: organizationLocations.organizationId,
          createdAt: organizationLocations.createdAt
        })
        .from(organizationLocations)
        .innerJoin(
          userProcesses,
          eq(userProcesses.locationId, organizationLocations.id)
        )
        .where(eq(organizationLocations.organizationId, organizationId));

      console.log(`Found ${locations.length} locations through user_processes:`, locations);
      return locations as OrganizationLocation[];
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }
  }

  async updateLocation(id: number, location: Partial<InsertOrganizationLocation>): Promise<OrganizationLocation> {
    try {
      console.log(`Updating location with ID: ${id}`, location);

      const [updatedLocation] = await db
        .update(organizationLocations)
        .set({
          ...location,
          // Ensure we're not overwriting these fields unintentionally
          id: undefined,
          createdAt: undefined,
        })
        .where(eq(organizationLocations.id, id))
        .returning() as OrganizationLocation[];

      if (!updatedLocation) {
        throw new Error('Location not found');
      }

      console.log('Successfully updated location:', updatedLocation);
      return updatedLocation;
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  }

  async deleteLocation(id: number): Promise<void> {
    try {
      console.log(`Attempting to delete location with ID: ${id}`);

      // Use a transaction to ensure data consistency
      await db.transaction(async (tx) => {
        // First update all users that reference this location
        await tx
          .update(users)
          .set({ locationId: null })
          .where(eq(users.locationId, id));

        console.log(`Updated users' location references to null`);

        // Then delete the location
        const result = await tx
          .delete(organizationLocations)
          .where(eq(organizationLocations.id, id))
          .returning();

        if (!result.length) {
          throw new Error('Location not found or deletion failed');
        }

        console.log(`Successfully deleted location with ID: ${id}`);
      });
    } catch (error) {
      console.error('Error deleting location:', error);
      throw error;
    }
  }

  async createLocation(location: InsertOrganizationLocation): Promise<OrganizationLocation> {
    try {
      console.log('Creating location with data:', location);

      // Check if location with same name exists in the organization
      const existingLocations = await db
        .select()
        .from(organizationLocations)
        .where(eq(organizationLocations.organizationId, location.organizationId))
        .where(eq(organizationLocations.name, location.name));

      if (existingLocations.length > 0) {
        throw new Error('A location with this name already exists in this organization');
      }

      const [newLocation] = await db
        .insert(organizationLocations)
        .values(location)
        .returning() as OrganizationLocation[];

      console.log('Successfully created new location:', newLocation);
      return newLocation;
    } catch (error: any) {
      console.error('Error creating location:', error);
      throw error;
    }
  }

  // Batch operations
  async createBatch(batch: InsertOrganizationBatch): Promise<OrganizationBatch> {
    try {
      console.log('Creating batch with data:', batch);

      const [newBatch] = await db
        .insert(organizationBatches)
        .values(batch)
        .returning() as OrganizationBatch[];

      console.log('Successfully created new batch:', newBatch);
      return newBatch;
    } catch (error: any) {
      console.error('Error creating batch:', error);
      throw error;
    }
  }

  async getBatch(id: number): Promise<OrganizationBatch | undefined> {
    try {
      const [batch] = await db
        .select()
        .from(organizationBatches)
        .where(eq(organizationBatches.id, id)) as OrganizationBatch[];

      return batch;
    } catch (error) {
      console.error('Error fetching batch:', error);
      throw error;
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
      throw error;
    }
  }

  async updateBatch(id: number, batch: Partial<InsertOrganizationBatch>): Promise<OrganizationBatch> {
    try {
      console.log(`Updating batch with ID: ${id}`, batch);

      const [updatedBatch] = await db
        .update(organizationBatches)
        .set({
          ...batch,
          updatedAt: new Date()
        })
        .where(eq(organizationBatches.id, id))
        .returning() as OrganizationBatch[];

      if (!updatedBatch) {
        throw new Error('Batch not found');
      }

      console.log('Successfully updated batch:', updatedBatch);
      return updatedBatch;
    } catch (error) {
      console.error('Error updating batch:', error);
      throw error;
    }
  }

  async deleteBatch(id: number): Promise<void> {
    try {
      console.log(`Attempting to delete batch with ID: ${id}`);

      const result = await db
        .delete(organizationBatches)
        .where(eq(organizationBatches.id, id))
        .returning();

      if (!result.length) {
        throw new Error('Batch not found or deletion failed');
      }

      console.log(`Successfully deleted batch with ID: ${id}`);
    } catch (error) {
      console.error('Error deleting batch:', error);
      throw error;
    }
  }

  async getActiveManagersByLocation(locationId: number): Promise<User[]> {
    try {
      const managers = await db
        .select()
        .from(users)
        .where(eq(users.locationId, locationId))
        .where(eq(users.role, 'manager'))
        .where(eq(users.active, true))
        .where(eq(users.category, 'active')) as User[];

      return managers;
    } catch (error) {
      console.error('Error fetching managers by location:', error);
      throw error;
    }
  }

  async getActiveTrainersByManager(managerId: number): Promise<User[]> {
    try {
      const trainers = await db
        .select()
        .from(users)
        .where(eq(users.managerId, managerId))
        .where(eq(users.role, 'trainer'))
        .where(eq(users.active, true))
        .where(eq(users.category, 'active')) as User[];

      return trainers;
    } catch (error) {
      console.error('Error fetching trainers by manager:', error);
      throw error;
    }
  }
  async getActiveTrainersByLocationAndProcess(locationId: number, processId: number): Promise<User[]> {
    try {
      // Get all active trainers in this location who are assigned to this process
      const trainers = await db
        .select()
        .from(users)
        .where(eq(users.locationId, locationId))
        .where(eq(users.role, 'trainer'))
        .where(eq(users.active, true))
        .where(eq(users.category, 'active'))
        .leftJoin(userProcesses, eq(users.id, userProcesses.userId))
        .where(eq(userProcesses.processId, processId)) as User[];

      return trainers;
    } catch (error) {
      console.error('Error fetching trainers by location and process:', error);
      throw error;
    }
  }
  async getLineOfBusinessesByLocation(locationId: number, organizationId: number): Promise<OrganizationLineOfBusiness[]> {
    try {
      console.log(`[Storage] Starting LOBfetch for location ${locationId} in org ${organizationId}`);

      // Log user processes first to see what we're working with
      const userProcessesForLocation = await db
        .select()
        .from(userProcesses)
        .where(eq(userProcesses.locationId, locationId));

      console.log(`[Storage] Found ${userProcessesForLocation.length} user processes for location:`, userProcessesForLocation);

      // Get LOBs directly from user_processes table using lineOfBusinessId
      const lobs = await db
        .selectDistinct({
          id: organizationLineOfBusinesses.id,
          name: organizationLineOfBusinesses.name,
          description: organizationLineOfBusinesses.description,
          organizationId: organizationLineOfBusinesses.organizationId,
          createdAt: organizationLineOfBusinesses.createdAt
        })
        .from(userProcesses)
        .innerJoin(
          organizationLineOfBusinesses,
          eq(userProcesses.lineOfBusinessId, organizationLineOfBusinesses.id)
        )
        .where(eq(userProcesses.locationId, locationId))
        .where(eq(organizationLineOfBusinesses.organizationId, organizationId));

      console.log(`[Storage] Found ${lobs.length} unique LOBs:`, lobs);

      if (lobs.length === 0) {
        console.log('[Storage] No LOBs found. This might indicate missing user_processes entries or incorrect join conditions');
      }

      return lobs as OrganizationLineOfBusiness[];
    } catch (error) {
      console.error('[Storage] Error fetching LOBs by location:', error);
      throw error;
    }
  }

  async getActiveTrainersByLocationAndProcess(locationId: number, processId: number): Promise<User[]> {
    try {
      // Get all active trainers in this location who are assigned to this process
      const trainers = await db
        .select()
        .from(users)
        .where(eq(users.locationId, locationId))
        .where(eq(users.role, 'trainer'))
        .where(eq(users.active, true))
        .where(eq(users.category, 'active'))
        .leftJoin(userProcesses, eq(users.id, userProcesses.userId))
        .where(eq(userProcesses.processId, processId)) as User[];

      return trainers;
    } catch (error) {
      console.error('Error fetching trainers by location and process:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();