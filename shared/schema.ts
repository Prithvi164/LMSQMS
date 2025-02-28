import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, type InferSelectModel } from "drizzle-orm";
import { z } from "zod";

// Role enum and permission enum remain unchanged
export const roleEnum = pgEnum('role', [
  'owner',     
  'admin',     
  'manager',   
  'team_lead', 
  'trainer',   
  'trainee',   
  'advisor'    
]);

export const permissionEnum = pgEnum('permission', [
  'manage_billing',
  'manage_subscription',
  'create_admin',
  'manage_organization_settings',

  'manage_users',
  'view_users',
  'edit_users',
  'delete_users',
  'upload_users',

  'manage_courses',
  'view_courses',
  'edit_courses',
  'delete_courses',
  'create_courses',

  'manage_learning_paths',
  'view_learning_paths',
  'edit_learning_paths',
  'delete_learning_paths',
  'create_learning_paths',

  'manage_organization',
  'view_organization',
  'edit_organization',
  'manage_locations',
  'manage_processes',
  'manage_batches',

  'view_performance',
  'manage_performance',
  'export_reports'
]);

// Batch status enum remains unchanged
export const batchStatusEnum = pgEnum('batch_status', ['planned', 'ongoing', 'completed', 'cancelled']);

// Add new process status enum
export const processStatusEnum = pgEnum('process_status', [
  'active',
  'inactive',
  'archived'
]);

// Organizations table remains unchanged
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Organization = InferSelectModel<typeof organizations>;

// Update Organization Processes table - remove user and role fields completely
export const organizationProcesses = pgTable("organization_processes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  status: processStatusEnum("status").default('active').notNull(),
  inductionDays: integer("induction_days").notNull(),
  trainingDays: integer("training_days").notNull(),
  certificationDays: integer("certification_days").notNull(),
  ojtDays: integer("ojt_days").notNull(),
  ojtCertificationDays: integer("ojt_certification_days").notNull(),
  lineOfBusinessId: integer("line_of_business_id")
    .references(() => organizationLineOfBusinesses.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  locationId: integer("location_id")
    .references(() => organizationLocations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OrganizationProcess = typeof organizationProcesses.$inferSelect;

// Organization Locations table with unique name constraint
export const organizationLocations = pgTable("organization_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OrganizationLocation = InferSelectModel<typeof organizationLocations>;

// Organization Line of Business table
export const organizationLineOfBusinesses = pgTable("organization_line_of_businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OrganizationLineOfBusiness = InferSelectModel<typeof organizationLineOfBusinesses>;

// Users table - ensure username is unique
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  employeeId: text("employee_id"),
  role: roleEnum("role").notNull(),
  locationId: integer("location_id").references(() => organizationLocations.id),
  email: text("email").notNull(),
  education: text("education"),
  dateOfJoining: date("date_of_joining"),
  phoneNumber: text("phone_number"),
  dateOfBirth: date("date_of_birth"),
  organizationId: integer("organization_id")
    .references(() => organizations.id),
  managerId: integer("manager_id")
    .references(() => users.id),
  active: boolean("active").notNull().default(true),
  certified: boolean("certified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = InferSelectModel<typeof users>;

// Enhanced User Processes junction table for multiple process assignments
export const userProcesses = pgTable("user_processes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  status: text("status").default('assigned').notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    unq: unique().on(table.userId, table.processId),
  };
});

export type UserProcess = typeof userProcesses.$inferSelect;

// User Batches junction table
export const userBatches = pgTable("user_batches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  batchId: integer("batch_id")
    .references(() => organizationBatches.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    unq: unique().on(table.userId, table.batchId),
  };
});

export type UserBatch = InferSelectModel<typeof userBatches>;


// Organization Batches table with improved structure
export const organizationBatches = pgTable("organization_batches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  batchNumber: text("batch_number").notNull(),
  status: batchStatusEnum("status").default('planned').notNull(),
  lineOfBusiness: text("line_of_business").notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  trainerId: integer("trainer_id")
    .references(() => users.id)
    .notNull(),
  managerId: integer("manager_id")
    .references(() => users.id)
    .notNull(),
  locationId: integer("location_id")
    .references(() => organizationLocations.id)
    .notNull(),
  participantCount: integer("participant_count").notNull(),
  capacityLimit: integer("capacity_limit").notNull(),
  inductionStartDate: date("induction_start_date").notNull(),
  inductionEndDate: date("induction_end_date").notNull(),
  trainingStartDate: date("training_start_date").notNull(),
  trainingEndDate: date("training_end_date").notNull(),
  certificationStartDate: date("certification_start_date").notNull(),
  certificationEndDate: date("certification_end_date").notNull(),
  recertificationStartDate: date("recertification_start_date"),
  recertificationEndDate: date("recertification_end_date"),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Update the insert schema to match the new table structure
export const insertOrganizationBatchSchema = createInsertSchema(organizationBatches)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Batch name is required"),
    batchNumber: z.string().min(1, "Batch number is required"),
    lineOfBusiness: z.string().min(1, "Line of business is required"),
    processId: z.number().int().positive("Process is required"),
    trainerId: z.number().int().positive("Trainer is required"),
    managerId: z.number().int().positive("Manager is required"),
    locationId: z.number().int().positive("Location is required"),
    participantCount: z.number().int().min(1, "Participant count must be at least 1"),
    capacityLimit: z.number().int().min(1, "Capacity limit must be at least 1"),
    inductionStartDate: z.string().min(1, "Induction start date is required"),
    inductionEndDate: z.string().min(1, "Induction end date is required"),
    trainingStartDate: z.string().min(1, "Training start date is required"),
    trainingEndDate: z.string().min(1, "Training end date is required"),
    certificationStartDate: z.string().min(1, "Certification start date is required"),
    certificationEndDate: z.string().min(1, "Certification end date is required"),
    recertificationStartDate: z.string().optional(),
    recertificationEndDate: z.string().optional(),
    organizationId: z.number().int().positive("Organization is required"),
  });

export type OrganizationBatch = typeof organizationBatches.$inferSelect;
export type InsertOrganizationBatch = z.infer<typeof insertOrganizationBatchSchema>;


// Role Permissions table - defines what each role can do
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: roleEnum("role").notNull(),  // Uses the same role enum
  permissions: jsonb("permissions").notNull().$type<string[]>(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Keep existing tables and add relations
export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  organization: one(organizations, {
    fields: [rolePermissions.organizationId],
    references: [organizations.id],
  }),
}));

// Add new insert schema for role permissions
export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export types for role permissions
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;


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

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  processes: many(organizationProcesses),
  batches: many(organizationBatches),
  locations: many(organizationLocations),
  lineOfBusinesses: many(organizationLineOfBusinesses),
  rolePermissions: many(rolePermissions),
}));

export const organizationProcessesRelations = relations(organizationProcesses, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationProcesses.organizationId],
    references: [organizations.id],
  }),
  lineOfBusiness: one(organizationLineOfBusinesses, {
    fields: [organizationProcesses.lineOfBusinessId],
    references: [organizationLineOfBusinesses.id],
  }),
  location: one(organizationLocations, {
    fields: [organizationProcesses.locationId],
    references: [organizationLocations.id],
  }),
}));

export const organizationBatchesRelations = relations(organizationBatches, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [organizationBatches.organizationId],
    references: [organizations.id],
  }),
  process: one(organizationProcesses, {
    fields: [organizationBatches.processId],
    references: [organizationProcesses.id],
  }),
  trainer: one(users, {
    fields: [organizationBatches.trainerId],
    references: [users.id],
  }),
  manager: one(users, {
    fields: [organizationBatches.managerId],
    references: [users.id],
  }),
  location: one(organizationLocations, {
    fields: [organizationBatches.locationId],
    references: [organizationLocations.id],
  }),
  users: many(users),
}));

export const organizationLocationsRelations = relations(organizationLocations, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationLocations.organizationId],
    references: [organizations.id],
  }),
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
  location: one(organizationLocations, {
    fields: [users.locationId],
    references: [organizationLocations.id],
  }),
  managedProcesses: many(userProcesses),
  managedBatches: many(userBatches),
})) as const;

export const userProcessesRelations = relations(userProcesses, ({ one }) => ({
  user: one(users, {
    fields: [userProcesses.userId],
    references: [users.id],
  }),
  process: one(organizationProcesses, {
    fields: [userProcesses.processId],
    references: [organizationProcesses.id],
  }),
  organization: one(organizations, {
    fields: [userProcesses.organizationId],
    references: [organizations.id],
  }),
}));

export const userBatchesRelations = relations(userBatches, ({ one }) => ({
  user: one(users, {
    fields: [userBatches.userId],
    references: [users.id],
  }),
  batch: one(organizationBatches, {
    fields: [userBatches.batchId],
    references: [organizationBatches.id],
  }),
  organization: one(organizations, {
    fields: [userBatches.organizationId],
    references: [organizations.id],
  }),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  learningPaths: many(learningPathCourses),
  progress: many(userProgress),
}));

export const learningPathsRelations = relations(learningPaths, ({ many }) => ({
  courses: many(learningPathCourses),
}));


// Update the insert schema for organization processes
export const insertOrganizationProcessSchema = createInsertSchema(organizationProcesses)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true
  })
  .extend({
    name: z.string().min(1, "Process name is required"),
    description: z.string().optional(),
    status: z.enum(['active', 'inactive', 'archived']).default('active'),
    inductionDays: z.number().min(1, "Induction days must be at least 1"),
    trainingDays: z.number().min(1, "Training days must be at least 1"),
    certificationDays: z.number().min(1, "Certification days must be at least 1"),
    ojtDays: z.number().min(0, "OJT days cannot be negative"),
    ojtCertificationDays: z.number().min(0, "OJT certification days cannot be negative"),
    lineOfBusinessId: z.number().int().positive("Line of Business is required"),
    organizationId: z.number().int().positive("Organization is required"),
    locationId: z.number().int().optional(),
  });

// Create insert schema for user processes
export const insertUserProcessSchema = createInsertSchema(userProcesses)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    assignedAt: true,
    completedAt: true
  })
  .extend({
    userId: z.number().int().positive("User ID is required"),
    processId: z.number().int().positive("Process ID is required"),
    organizationId: z.number().int().positive("Organization ID is required"),
    status: z.string().default('assigned'),
  });

// Update insert schema to handle unique constraint error
export const insertOrganizationLocationSchema = createInsertSchema(organizationLocations)
  .omit({
    id: true,
    createdAt: true
  })
  .extend({
    name: z.string().min(1, "Location name is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    country: z.string().min(1, "Country is required"),
    organizationId: z.number().int().positive("Organization is required"),
  });

export const insertOrganizationLineOfBusinessSchema = createInsertSchema(organizationLineOfBusinesses)
  .omit({
    id: true,
    createdAt: true
  })
  .extend({
    name: z.string().min(1, "LOB name is required"),
    description: z.string().min(1, "Description is required"),
    organizationId: z.number().int().positive("Organization is required"),
  });

export type InsertOrganizationLineOfBusiness = z.infer<typeof insertOrganizationLineOfBusinessSchema>;

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
    certified: z.boolean().default(false),
    active: z.boolean().default(true),
  });
export const insertCourseSchema = createInsertSchema(courses);
export const insertLearningPathSchema = createInsertSchema(learningPaths);
export const insertUserProgressSchema = createInsertSchema(userProgress);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type InsertLearningPath = z.infer<typeof insertLearningPathSchema>;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type InsertOrganizationProcess = z.infer<typeof insertOrganizationProcessSchema>;
export type InsertUserProcess = z.infer<typeof insertUserProcessSchema>;