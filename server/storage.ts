import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  organizations,
  organizationProcesses,
  organizationBatches,
  organizationLocations,
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
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  listUsers(organizationId: number): Promise<User[]>;

  // Organization operations
  getOrganization(id: number): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganizationByName(name: string): Promise<Organization | undefined>;
  updateOrganization(id: number, org: Partial<Organization>): Promise<Organization>;

  // Organization settings operations
  createProcess(process: InsertOrganizationProcess): Promise<OrganizationProcess>;
  createBatch(batch: InsertOrganizationBatch): Promise<OrganizationBatch>;
  createLocation(location: InsertOrganizationLocation): Promise<OrganizationLocation>;
  listProcesses(organizationId: number): Promise<OrganizationProcess[]>;
  listBatches(organizationId: number): Promise<OrganizationBatch[]>;
  listLocations(organizationId: number): Promise<OrganizationLocation[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async listUsers(organizationId: number): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.organizationId, organizationId));
  }

  // Organization operations
  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [newOrg] = await db.insert(organizations).values(org).returning();
    return newOrg;
  }

  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.name, name));
    return org;
  }

  async updateOrganization(id: number, org: Partial<Organization>): Promise<Organization> {
    const [updatedOrg] = await db
      .update(organizations)
      .set(org)
      .where(eq(organizations.id, id))
      .returning();
    return updatedOrg;
  }

  // Organization settings operations
  async createProcess(process: InsertOrganizationProcess): Promise<OrganizationProcess> {
    const [newProcess] = await db.insert(organizationProcesses).values(process).returning();
    return newProcess;
  }

  async createBatch(batch: InsertOrganizationBatch): Promise<OrganizationBatch> {
    const [newBatch] = await db.insert(organizationBatches).values(batch).returning();
    return newBatch;
  }

  async createLocation(location: InsertOrganizationLocation): Promise<OrganizationLocation> {
    const [newLocation] = await db.insert(organizationLocations).values(location).returning();
    return newLocation;
  }

  async listProcesses(organizationId: number): Promise<OrganizationProcess[]> {
    return await db
      .select()
      .from(organizationProcesses)
      .where(eq(organizationProcesses.organizationId, organizationId));
  }

  async listBatches(organizationId: number): Promise<OrganizationBatch[]> {
    return await db
      .select()
      .from(organizationBatches)
      .where(eq(organizationBatches.organizationId, organizationId));
  }

  async listLocations(organizationId: number): Promise<OrganizationLocation[]> {
    return await db
      .select()
      .from(organizationLocations)
      .where(eq(organizationLocations.organizationId, organizationId));
  }
}

export const storage = new DatabaseStorage();