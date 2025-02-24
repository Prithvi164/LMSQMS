import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Role enum
export const roleEnum = pgEnum('role', ['admin', 'manager', 'trainer', 'trainee']);

// Organizations table
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Add customizable options
  locations: jsonb("locations").notNull().default(['default']).$type<string[]>(),
  processNames: jsonb("process_names").notNull().default(['default']).$type<string[]>(),
  educationOptions: jsonb("education_options").notNull().default(['default']).$type<string[]>(),
  batchNames: jsonb("batch_names").notNull().default(['default']).$type<string[]>(),
});

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),  // Make optional for existing records
  employeeId: text("employee_id"),  // Make optional for existing records
  role: roleEnum("role").notNull(),
  batchName: text("batch_name"),
  location: text("location"),  // Make optional for existing records
  email: text("email"),  // Make optional for existing records
  processName: text("process_name"),
  education: text("education"),
  dateOfJoining: date("date_of_joining"),
  phoneNumber: text("phone_number"),  // Make optional for existing records
  dateOfBirth: date("date_of_birth"),
  organizationId: integer("organization_id")
    .references(() => organizations.id),
  managerId: integer("manager_id")
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Course table
export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  duration: integer("duration").notNull(),
  imageUrl: text("image_url"),
  modules: jsonb("modules").notNull().$type<{
    id: string;
    title: string;
    content: string;
    quizzes: {
      id: string;
      question: string;
      options: string[];
      correctAnswer: number;
    }[];
  }[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Learning Path table
export const learningPaths = pgTable("learning_paths", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  requiredForRoles: jsonb("required_for_roles").notNull().$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Learning Path Courses (Junction table)
export const learningPathCourses = pgTable("learning_path_courses", {
  learningPathId: integer("learning_path_id")
    .notNull()
    .references(() => learningPaths.id),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id),
});

// User Progress table
export const userProgress = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id),
  moduleId: text("module_id").notNull(),
  completed: boolean("completed").default(false).notNull(),
  score: integer("score"),
  lastAccessed: timestamp("last_accessed").defaultNow().notNull(),
});

// Define relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  manager: one(users, {
    fields: [users.managerId],
    references: [users.id],
  }),
  subordinates: many(users, { relationName: "manager_subordinates" }),
  progress: many(userProgress),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  learningPaths: many(learningPathCourses),
  progress: many(userProgress),
}));

export const learningPathsRelations = relations(learningPaths, ({ many }) => ({
  courses: many(learningPathCourses),
}));

// Create insert schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true })
  .extend({
    fullName: z.string().min(1, "Full name is required"),
    employeeId: z.string().min(1, "Employee ID is required"),
    location: z.string().min(1, "Location is required"),
    email: z.string().email("Invalid email format"),
    phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
    dateOfJoining: z.string().optional(),
    dateOfBirth: z.string().optional(),
    batchName: z.string().optional(),
    processName: z.string().optional(),
    education: z.string().optional(),
  });
export const insertCourseSchema = createInsertSchema(courses);
export const insertLearningPathSchema = createInsertSchema(learningPaths);
export const insertUserProgressSchema = createInsertSchema(userProgress);

// Export types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type LearningPath = typeof learningPaths.$inferSelect;
export type InsertLearningPath = z.infer<typeof insertLearningPathSchema>;
export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;