import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
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

// Learning Path Courses (Junction table for many-to-many relationship)
export const learningPathCourses = pgTable("learning_path_courses", {
  learningPathId: integer("learning_path_id")
    .notNull()
    .references(() => learningPaths.id),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id),
});

// User Progress table - keeping userId as text for now to avoid migration issues
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
export const usersRelations = relations(users, ({ many }) => ({
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
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertCourseSchema = createInsertSchema(courses);
export const insertLearningPathSchema = createInsertSchema(learningPaths);
export const insertUserProgressSchema = createInsertSchema(userProgress);

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type LearningPath = typeof learningPaths.$inferSelect;
export type InsertLearningPath = z.infer<typeof insertLearningPathSchema>;
export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;