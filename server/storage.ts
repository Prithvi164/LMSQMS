import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  organizationLineOfBusinesses,
  userProcesses,
  users,
  type OrganizationLineOfBusiness,
  type User,
  type InsertUser,
} from "@shared/schema";

export interface IStorage {
  getLineOfBusinessesByLocation(organizationId: number, locationId: number): Promise<OrganizationLineOfBusiness[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUser(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      console.log('Fetching user by username:', username);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username)) as User[];
      console.log('User found:', user ? 'yes' : 'no');
      return user;
    } catch (error) {
      console.error('Error fetching user by username:', error);
      throw new Error('Failed to fetch user');
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      console.log('Fetching user by ID:', id);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id)) as User[];
      console.log('User found:', user ? 'yes' : 'no');
      return user;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw new Error('Failed to fetch user');
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      console.log('Creating new user:', { username: user.username, email: user.email });
      const [newUser] = await db
        .insert(users)
        .values(user)
        .returning() as User[];
      console.log('User created successfully:', { id: newUser.id, username: newUser.username });
      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  async getLineOfBusinessesByLocation(organizationId: number, locationId: number): Promise<OrganizationLineOfBusiness[]> {
    try {
      console.log('Fetching LOBs for location:', { locationId, organizationId });

      // Get only the LOBs that have processes assigned to the location
      const lobs = await db
        .select({
          id: organizationLineOfBusinesses.id,
          name: organizationLineOfBusinesses.name,
          description: organizationLineOfBusinesses.description,
          organizationId: organizationLineOfBusinesses.organizationId,
          createdAt: organizationLineOfBusinesses.createdAt,
        })
        .from(userProcesses)
        .innerJoin(
          organizationLineOfBusinesses,
          eq(userProcesses.lineOfBusinessId, organizationLineOfBusinesses.id)
        )
        .where(eq(userProcesses.locationId, locationId))
        .where(eq(organizationLineOfBusinesses.organizationId, organizationId))
        .distinct() as OrganizationLineOfBusiness[];

      console.log('Found LOBs:', {
        locationId,
        count: lobs.length,
        lobs: lobs.map(lob => ({
          id: lob.id,
          name: lob.name
        }))
      });

      return lobs;
    } catch (error) {
      console.error('Error fetching LOBs:', error);
      throw new Error('Failed to fetch LOBs');
    }
  }
}

export const storage = new DatabaseStorage();