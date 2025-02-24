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
import {
  courses,
  learningPaths,
  userProgress,
  type Course,
  type InsertCourse,
  type LearningPath,
  type InsertLearningPath,
  type UserProgress,
  type InsertUserProgress,
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
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

  // Course operations
  getCourse(id: number): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  listCourses(): Promise<Course[]>;

  // Learning path operations
  getLearningPath(id: number): Promise<LearningPath | undefined>;
  createLearningPath(path: InsertLearningPath): Promise<LearningPath>;
  listLearningPaths(): Promise<LearningPath[]>;

  // User progress operations
  getUserProgress(userId: string, courseId: number): Promise<UserProgress | undefined>;
  createUserProgress(progress: InsertUserProgress): Promise<UserProgress>;
  updateUserProgress(id: number, progress: Partial<InsertUserProgress>): Promise<UserProgress>;
  listUserProgress(userId: string): Promise<UserProgress[]>;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
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

  // Course operations
  async getCourse(id: number): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course;
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const [newCourse] = await db.insert(courses).values(course).returning();
    return newCourse;
  }

  async listCourses(): Promise<Course[]> {
    return await db.select().from(courses);
  }

  // Learning path operations
  async getLearningPath(id: number): Promise<LearningPath | undefined> {
    const [path] = await db.select().from(learningPaths).where(eq(learningPaths.id, id));
    return path;
  }

  async createLearningPath(path: InsertLearningPath): Promise<LearningPath> {
    const [newPath] = await db.insert(learningPaths).values(path).returning();
    return newPath;
  }

  async listLearningPaths(): Promise<LearningPath[]> {
    return await db.select().from(learningPaths);
  }

  // User progress operations
  async getUserProgress(userId: string, courseId: number): Promise<UserProgress | undefined> {
    const [progress] = await db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, userId))
      .where(eq(userProgress.courseId, courseId));
    return progress;
  }

  async createUserProgress(progress: InsertUserProgress): Promise<UserProgress> {
    const [newProgress] = await db.insert(userProgress).values(progress).returning();
    return newProgress;
  }

  async updateUserProgress(
    id: number,
    progress: Partial<InsertUserProgress>
  ): Promise<UserProgress> {
    const [updatedProgress] = await db
      .update(userProgress)
      .set(progress)
      .where(eq(userProgress.id, id))
      .returning();
    return updatedProgress;
  }

  async listUserProgress(userId: string): Promise<UserProgress[]> {
    return await db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, userId));
  }
}

export const storage = new DatabaseStorage();