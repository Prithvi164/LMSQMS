import { db } from '../db';
import { sql } from 'drizzle-orm';
import { users, userProcesses, organizationProcesses, organizationLocations, organizationBatches, organizationLineOfBusinesses } from '@shared/schema';
import { eq, and, isNull, gte, lte, inArray } from 'drizzle-orm/expressions';

// Types for the analytics service responses
export interface HeadcountByCategory {
  active: number;
  trainee: number;
}

export interface HeadcountByRole {
  [role: string]: number;
}

export interface HeadcountByLocation {
  [location: string]: number;
}

export interface HeadcountProjection {
  date: string;
  expectedHeadcount: number;
}

export interface ProcessHeadcountAnalytics {
  processId: number;
  processName: string;
  totalHeadcount: number;
  byCategory: HeadcountByCategory;
  byRole: HeadcountByRole;
  byLocation: HeadcountByLocation;
  projection?: HeadcountProjection[];
}

/**
 * Get headcount analytics for all processes in an organization
 */
export const getOrganizationHeadcountAnalytics = async (organizationId: number): Promise<ProcessHeadcountAnalytics[]> => {
  try {
    // First, get all processes for the organization
    const processes = await db.select()
      .from(organizationProcesses)
      .where(eq(organizationProcesses.organizationId, organizationId));
    
    // For each process, get the headcount analytics
    const analytics: ProcessHeadcountAnalytics[] = [];
    for (const process of processes) {
      const analyticsData = await getProcessHeadcountAnalytics(organizationId, process.id);
      analytics.push(analyticsData);
    }
    
    return analytics;
  } catch (error) {
    console.error('Error getting organization headcount analytics:', error);
    throw error;
  }
};

/**
 * Get headcount analytics for a specific process
 */
export const getProcessHeadcountAnalytics = async (organizationId: number, processId: number): Promise<ProcessHeadcountAnalytics> => {
  try {
    // Get the process details
    const process = await db.select()
      .from(organizationProcesses)
      .where(and(
        eq(organizationProcesses.id, processId),
        eq(organizationProcesses.organizationId, organizationId)
      ))
      .limit(1);

    if (!process || process.length === 0) {
      throw new Error('Process not found');
    }

    // Get all users assigned to this process
    const processUsers = await db.select({
      userId: userProcesses.userId,
    })
    .from(userProcesses)
    .where(and(
      eq(userProcesses.processId, processId),
      eq(userProcesses.status, 'assigned')
    ));

    if (!processUsers || processUsers.length === 0) {
      // Return empty analytics if no users are assigned to this process
      return {
        processId,
        processName: process[0].name,
        totalHeadcount: 0,
        byCategory: { active: 0, trainee: 0 },
        byRole: {},
        byLocation: {},
      };
    }

    // Get user IDs
    const userIds = processUsers.map(u => u.userId);

    // Get user details with necessary information
    let userDetails: { id: number; role: string; category: string; locationId: number | null; lastWorkingDay: Date | null }[] = [];
    
    // Only query if we have userIds
    if (userIds.length > 0) {
      userDetails = await db.select({
        id: users.id,
        role: users.role,
        category: users.category,
        locationId: users.locationId,
        lastWorkingDay: users.lastWorkingDay,
      })
      .from(users)
      .where(
        and(
          sql`${users.id} IN (${sql.join(userIds)})`,
          eq(users.organizationId, organizationId)
        )
      );
    }

    // Calculate total headcount
    const totalHeadcount = userDetails.length;

    // Calculate headcount by category
    const byCategory: HeadcountByCategory = {
      active: 0,
      trainee: 0,
    };

    userDetails.forEach(user => {
      if (user.category === 'active') {
        byCategory.active += 1;
      } else if (user.category === 'trainee') {
        byCategory.trainee += 1;
      }
    });

    // Calculate headcount by role
    const byRole: HeadcountByRole = {};
    userDetails.forEach(user => {
      const role = user.role;
      byRole[role] = (byRole[role] || 0) + 1;
    });

    // Calculate headcount by location
    const byLocation: HeadcountByLocation = {};
    // Get all location IDs
    const locationIds = userDetails
      .map(u => u.locationId)
      .filter(id => id !== null) as number[];

    // Get location details if there are location IDs
    if (locationIds.length > 0) {
      const locationDetails = await db.select({
        id: organizationLocations.id,
        name: organizationLocations.name,
      })
      .from(organizationLocations)
      .where(
        and(
          sql`${organizationLocations.id} IN (${sql.join(locationIds)})`,
          eq(organizationLocations.organizationId, organizationId)
        )
      );

      // Create mapping of location ID to name
      const locationMap = new Map<number, string>();
      locationDetails.forEach(loc => {
        locationMap.set(loc.id, loc.name);
      });

      // Count users by location
      userDetails.forEach(user => {
        if (user.locationId) {
          const locationName = locationMap.get(user.locationId) || 'Unknown';
          byLocation[locationName] = (byLocation[locationName] || 0) + 1;
        } else {
          byLocation['Unassigned'] = (byLocation['Unassigned'] || 0) + 1;
        }
      });
    } else {
      byLocation['Unassigned'] = totalHeadcount;
    }

    // Get future projection data
    const projection = await getHeadcountProjection(organizationId, processId);

    return {
      processId,
      processName: process[0].name,
      totalHeadcount,
      byCategory,
      byRole,
      byLocation,
      projection,
    };
  } catch (error) {
    console.error('Error getting process headcount analytics:', error);
    throw error;
  }
};

/**
 * Get future headcount projection for a process
 */
export const getHeadcountProjection = async (
  organizationId: number, 
  processId: number
): Promise<HeadcountProjection[]> => {
  try {
    // Get all users assigned to this process
    const processUsers = await db.select({
      userId: userProcesses.userId,
    })
    .from(userProcesses)
    .where(and(
      eq(userProcesses.processId, processId),
      eq(userProcesses.status, 'assigned')
    ));

    if (!processUsers || processUsers.length === 0) {
      return [];
    }

    // Get user IDs
    const userIds = processUsers.map(u => u.userId);

    // Get user details with last working day
    let userDetails: { id: number; lastWorkingDay: Date | null }[] = [];
    
    // Only query if we have userIds
    if (userIds.length > 0) {
      userDetails = await db.select({
        id: users.id,
        lastWorkingDay: users.lastWorkingDay,
      })
      .from(users)
      .where(
        and(
          sql`${users.id} IN (${sql.join(userIds)})`,
          eq(users.organizationId, organizationId)
        )
      );
    }

    // Get batch ops handover dates for this process
    const batches = await db.select({
      id: organizationBatches.id,
      handoverToOpsDate: organizationBatches.handoverToOpsDate,
      capacityLimit: organizationBatches.capacityLimit,
    })
    .from(organizationBatches)
    .where(and(
      eq(organizationBatches.processId, processId),
      eq(organizationBatches.organizationId, organizationId),
      and(
        sql`${organizationBatches.handoverToOpsDate} IS NOT NULL`,
        gte(organizationBatches.handoverToOpsDate, new Date().toISOString().slice(0, 10))
      )
    ));

    // Create a projection for the next 90 days
    const projection: HeadcountProjection[] = [];
    const today = new Date();
    let currentHeadcount = userDetails.length;

    // Create a map of date to headcount change
    const dateChangeMap = new Map<string, number>();

    // Add decreases based on last working day
    userDetails.forEach(user => {
      if (user.lastWorkingDay) {
        const dateStr = new Date(user.lastWorkingDay).toISOString().slice(0, 10);
        const change = dateChangeMap.get(dateStr) || 0;
        dateChangeMap.set(dateStr, change - 1);
      }
    });

    // Add increases based on ops handover dates
    batches.forEach(batch => {
      if (batch.handoverToOpsDate) {
        const dateStr = new Date(batch.handoverToOpsDate).toISOString().slice(0, 10);
        const change = dateChangeMap.get(dateStr) || 0;
        // Assuming each batch's capacityLimit approximates how many people will join
        dateChangeMap.set(dateStr, change + (batch.capacityLimit || 0));
      }
    });

    // Generate a projection for the next 90 days
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10);
      
      // Apply any headcount changes for this date
      if (dateChangeMap.has(dateStr)) {
        currentHeadcount += dateChangeMap.get(dateStr) || 0;
      }
      
      // Only add to projection if it's a week interval or there's a change
      if (i % 7 === 0 || dateChangeMap.has(dateStr)) {
        projection.push({
          date: dateStr,
          expectedHeadcount: currentHeadcount
        });
      }
    }

    return projection;
  } catch (error) {
    console.error('Error getting headcount projection:', error);
    return [];
  }
};

/**
 * Get analytics data filtered by line of business
 */
export const getLineOfBusinessAnalytics = async (
  organizationId: number,
  lineOfBusinessId: number
): Promise<ProcessHeadcountAnalytics[]> => {
  try {
    // Get all processes for this line of business
    const processes = await db.select()
      .from(organizationProcesses)
      .where(and(
        eq(organizationProcesses.organizationId, organizationId),
        eq(organizationProcesses.lineOfBusinessId, lineOfBusinessId)
      ));
    
    if (!processes || processes.length === 0) {
      return [];
    }
    
    // For each process, get the headcount analytics
    const analytics: ProcessHeadcountAnalytics[] = [];
    for (const process of processes) {
      const analyticsData = await getProcessHeadcountAnalytics(organizationId, process.id);
      analytics.push(analyticsData);
    }
    
    return analytics;
  } catch (error) {
    console.error('Error getting line of business analytics:', error);
    throw error;
  }
};