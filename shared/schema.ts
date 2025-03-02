import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, type InferSelectModel } from "drizzle-orm";
import { z } from "zod";

// Add batch status enum
export const batchStatusEnum = pgEnum('batch_status', [
  'planned',
  'ongoing',
  'completed'
]);

// Existing enums remain unchanged...
export const userCategoryTypeEnum = pgEnum('user_category_type', ['active', 'trainee']);
export const roleEnum = pgEnum('role', [
  'owner',     
  'admin',     
  'manager',   
  'team_lead', 
  'qualityassurance',
  'trainer',   
  'advisor'    
]);

// Add organizationBatches table
export const organizationBatches = pgTable("organization_batches", {
  id: serial("id").primaryKey(),
  batchCode: text("batch_code").notNull().unique(),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: batchStatusEnum("status").default('planned').notNull(),
  capacityLimit: integer("capacity_limit").notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  locationId: integer("location_id")
    .references(() => organizationLocations.id)
    .notNull(),
  trainerId: integer("trainer_id")
    .references(() => users.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OrganizationBatch = InferSelectModel<typeof organizationBatches>;

// Add relations for batches
export const organizationBatchesRelations = relations(organizationBatches, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationBatches.organizationId],
    references: [organizations.id],
  }),
  process: one(organizationProcesses, {
    fields: [organizationBatches.processId],
    references: [organizationProcesses.id],
  }),
  location: one(organizationLocations, {
    fields: [organizationBatches.locationId],
    references: [organizationLocations.id],
  }),
  trainer: one(users, {
    fields: [organizationBatches.trainerId],
    references: [users.id],
  }),
}));

// Add Zod schema for batch creation/updates
export const insertOrganizationBatchSchema = createInsertSchema(organizationBatches)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    batchCode: z.string().min(1, "Batch code is required"),
    name: z.string().min(1, "Batch name is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    capacityLimit: z.number().int().min(1, "Capacity must be at least 1"),
    status: z.enum(['planned', 'ongoing', 'completed']).default('planned'),
    processId: z.number().int().positive("Process is required"),
    locationId: z.number().int().positive("Location is required"),
    trainerId: z.number().int().positive("Trainer is required"),
    organizationId: z.number().int().positive("Organization is required"),
  });

export type InsertOrganizationBatch = z.infer<typeof insertOrganizationBatchSchema>;

// Rest of the enums and tables remain unchanged...

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
  'view_performance',
  'manage_performance',
  'export_reports'
]);

// Add new process status enum
export const processStatusEnum = pgEnum('process_status', [
  'active',
  'inactive',
  'archived'
]);

// Keep all the existing tables and their relations that are not batch-related
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Organization = InferSelectModel<typeof organizations>;

// Organization Processes table
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OrganizationProcess = typeof organizationProcesses.$inferSelect;

// Organization Locations table
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

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  employeeId: text("employee_id").notNull().unique(),
  role: roleEnum("role").notNull(),
  category: userCategoryTypeEnum("category").default('trainee').notNull(),
  locationId: integer("location_id").references(() => organizationLocations.id),
  email: text("email").notNull(),
  education: text("education"),
  dateOfJoining: date("date_of_joining"),
  phoneNumber: text("phone_number"),
  dateOfBirth: date("date_of_birth"),
  lastWorkingDay: date("last_working_day"),
  organizationId: integer("organization_id")
    .references(() => organizations.id),
  managerId: integer("manager_id")
    .references(() => users.id),
  active: boolean("active").notNull().default(true),
  certified: boolean("certified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = InferSelectModel<typeof users>;

// User Processes junction table
export const userProcesses = pgTable("user_processes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  lineOfBusinessId: integer("line_of_business_id")
    .references(() => organizationLineOfBusinesses.id)
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

// Role Permissions table
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: roleEnum("role").notNull(),
  permissions: jsonb("permissions").notNull().$type<string[]>(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  processes: many(organizationProcesses),
  locations: many(organizationLocations),
  lineOfBusinesses: many(organizationLineOfBusinesses),
  rolePermissions: many(rolePermissions),
  batches: many(organizationBatches)
}));

export const organizationProcessesRelations = relations(organizationProcesses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [organizationProcesses.organizationId],
    references: [organizations.id],
  }),
  lineOfBusiness: one(organizationLineOfBusinesses, {
    fields: [organizationProcesses.lineOfBusinessId],
    references: [organizationLineOfBusinesses.id],
  }),
  batches: many(organizationBatches)
}));

export const organizationLocationsRelations = relations(organizationLocations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [organizationLocations.organizationId],
    references: [organizations.id],
  }),
  batches: many(organizationBatches)
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
  batches: many(organizationBatches)
}));

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
  lineOfBusiness: one(organizationLineOfBusinesses, {
    fields: [userProcesses.lineOfBusinessId],
    references: [organizationLineOfBusinesses.id],
  })
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  organization: one(organizations, {
    fields: [rolePermissions.organizationId],
    references: [organizations.id],
  }),
}));

// Export Zod schemas
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
    organizationId: z.number().int().positive("Organization is required")
  });

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
    lastWorkingDay: z.string().optional().nullable(),
    education: z.string().optional(),
    certified: z.boolean().default(false),
    active: z.boolean().default(true),
    category: z.enum(['active', 'trainee']).default('trainee'),
  });

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Add new type for combined user and process creation
export const insertUserWithProcessesSchema = insertUserSchema.extend({
  processes: z.array(z.number()).optional(),
});

export type InsertUserWithProcesses = z.infer<typeof insertUserWithProcessesSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertOrganizationProcess = z.infer<typeof insertOrganizationProcessSchema>;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type InsertOrganizationBatch = z.infer<typeof insertOrganizationBatchSchema>;

export type {
  Organization,
  OrganizationProcess,
  OrganizationLocation,
  OrganizationLineOfBusiness,
  User,
  UserProcess,
  RolePermission,
  InsertUser,
  InsertOrganization,
  InsertOrganizationProcess,
  InsertRolePermission,
  OrganizationBatch,
  InsertOrganizationBatch
};