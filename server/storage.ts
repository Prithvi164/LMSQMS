import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  organizationLineOfBusinesses,
  userProcesses,
  type OrganizationLineOfBusiness,
} from "@shared/schema";

export interface IStorage {
  getLineOfBusinessesByLocation(organizationId: number, locationId: number): Promise<OrganizationLineOfBusiness[]>;
}

export class DatabaseStorage implements IStorage {
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