import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  organizations,
  type User,
  type InsertUser,
  type Organization,
  type InsertOrganization,
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
  createUser(user: InsertUser): Promise<User>;

  // Organization operations
  getOrganization(id: number): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;

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

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
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