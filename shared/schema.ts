import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Role enum
export const roleEnum = pgEnum('role', ['admin', 'manager', 'trainer', 'trainee']);

// Organizations table - remove JSON arrays
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// New tables for organization settings
export const organizationProcesses = pgTable("organization_processes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizationBatches = pgTable("organization_batches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizationLocations = pgTable("organization_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Keep existing Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  employeeId: text("employee_id"),
  role: roleEnum("role").notNull(),
  batchId: integer("batch_id").references(() => organizationBatches.id),
  locationId: integer("location_id").references(() => organizationLocations.id),
  email: text("email").notNull(),
  processId: integer("process_id").references(() => organizationProcesses.id),
  education: text("education"),
  dateOfJoining: date("date_of_joining"),
  phoneNumber: text("phone_number"),
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
  processes: many(organizationProcesses),
  batches: many(organizationBatches),
  locations: many(organizationLocations),
}));

export const organizationProcessesRelations = relations(organizationProcesses, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationProcesses.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationBatchesRelations = relations(organizationBatches, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationBatches.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationLocationsRelations = relations(organizationLocations, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationLocations.organizationId],
    references: [organizations.id],
  }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  manager: one(users, {
    fields: [users.managerId],
    references: [users.id],
  }),
  batch: one(organizationBatches, {
    fields: [users.batchId],
    references: [organizationBatches.id],
  }),
  location: one(organizationLocations, {
    fields: [users.locationId],
    references: [organizationLocations.id],
  }),
  process: one(organizationProcesses, {
    fields: [users.processId],
    references: [organizationProcesses.id],
  }),

}));

export const coursesRelations = relations(courses, ({ many }) => ({
  learningPaths: many(learningPathCourses),
  progress: many(userProgress),
}));

export const learningPathsRelations = relations(learningPaths, ({ many }) => ({
  courses: many(learningPathCourses),
}));


// Create insert schemas for new tables
export const insertOrganizationProcessSchema = createInsertSchema(organizationProcesses).omit({ 
  id: true, 
  createdAt: true 
});

export const insertOrganizationBatchSchema = createInsertSchema(organizationBatches).omit({ 
  id: true, 
  createdAt: true 
});

export const insertOrganizationLocationSchema = createInsertSchema(organizationLocations).omit({ 
  id: true, 
  createdAt: true 
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true })
  .extend({
    fullName: z.string().min(1, "Full name is required"),
    employeeId: z.string().min(1, "Employee ID is required"),
    email: z.string().email("Invalid email format"),
    phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
    dateOfJoining: z.string().optional(),
    dateOfBirth: z.string().optional(),
    education: z.string().optional(),
  });
export const insertCourseSchema = createInsertSchema(courses);
export const insertLearningPathSchema = createInsertSchema(learningPaths);
export const insertUserProgressSchema = createInsertSchema(userProgress);

// Export types for new tables
export type OrganizationProcess = typeof organizationProcesses.$inferSelect;
export type InsertOrganizationProcess = z.infer<typeof insertOrganizationProcessSchema>;

export type OrganizationBatch = typeof organizationBatches.$inferSelect;
export type InsertOrganizationBatch = z.infer<typeof insertOrganizationBatchSchema>;

export type OrganizationLocation = typeof organizationLocations.$inferSelect;
export type InsertOrganizationLocation = z.infer<typeof insertOrganizationLocationSchema>;

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