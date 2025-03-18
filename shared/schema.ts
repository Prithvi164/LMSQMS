import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, type InferSelectModel } from "drizzle-orm";
import { z } from "zod";

// Define all enums at the top
export const evaluationStatusEnum = pgEnum('evaluation_status', [
  'draft',
  'active', 
  'archived'
]);

export const questionTypeEnum = pgEnum('question_type', [
  'multiple_choice',
  'true_false',
  'short_answer'
]);

export const quizStatusEnum = pgEnum('quiz_status', [
  'active',
  'completed',
  'expired'
]);

export const batchCategoryEnum = pgEnum('batch_category', [
  'new_training',
  'upskill'
]);

export const batchStatusEnum = pgEnum('batch_status', [
  'planned',
  'induction',
  'training',
  'certification',
  'ojt',
  'ojt_certification',
  'completed'
]);

export const userCategoryTypeEnum = pgEnum('user_category_type', ['active', 'trainee']);

export const roleEnum = pgEnum('role', [
  'owner',
  'admin',
  'manager',
  'team_lead',
  'quality_analyst',
  'trainer',
  'advisor',
  'trainee'
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
  'view_performance',
  'manage_performance',
  'export_reports'
]);

export const processStatusEnum = pgEnum('process_status', [
  'active',
  'inactive',
  'archived'
]);

// Core tables in dependency order
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(), 
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  employeeId: text("employee_id").notNull().unique(),
  role: roleEnum("role").notNull(),
  category: userCategoryTypeEnum("category").default('trainee').notNull(),
  email: text("email").notNull(),
  education: text("education"),
  dateOfJoining: date("date_of_joining"),
  phoneNumber: text("phone_number"),
  dateOfBirth: date("date_of_birth"),
  lastWorkingDay: date("last_working_day"),
  active: boolean("active").notNull().default(true),
  certified: boolean("certified").notNull().default(false),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  organizationId: integer("organization_id")
    .references(() => organizations.id),
  locationId: integer("location_id")
    .references(() => organizationLocations.id),
  managerId: integer("manager_id")
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const organizationLineOfBusinesses = pgTable("organization_line_of_businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

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
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Evaluation tables
export const evaluationTemplates = pgTable("evaluation_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: evaluationStatusEnum("status").default('draft').notNull(),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const evaluationPillars = pgTable("evaluation_pillars", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  templateId: integer("template_id")
    .references(() => evaluationTemplates.id)
    .notNull(),
  weightage: integer("weightage").notNull(),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const evaluationParameters = pgTable("evaluation_parameters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  guidelines: text("guidelines"),
  pillarId: integer("pillar_id")
    .references(() => evaluationPillars.id)
    .notNull(),
  ratingType: text("rating_type").notNull(), // yes_no_na, numeric, or custom
  weightage: integer("weightage").notNull(),
  weightageEnabled: boolean("weightage_enabled").default(true).notNull(),
  isFatal: boolean("is_fatal").default(false).notNull(),
  requiresComment: boolean("requires_comment").default(false).notNull(),
  noReasons: jsonb("no_reasons").$type<string[]>(),
  customRatingOptions: jsonb("custom_rating_options").$type<string[]>(),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const evaluationResults = pgTable("evaluation_results", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .references(() => evaluationTemplates.id)
    .notNull(),
  traineeId: integer("trainee_id")
    .references(() => users.id)
    .notNull(),
  evaluatorId: integer("evaluator_id")
    .references(() => users.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  finalScore: integer("final_score").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const evaluationParameterResults = pgTable("evaluation_parameter_results", {
  id: serial("id").primaryKey(),
  evaluationId: integer("evaluation_id")
    .references(() => evaluationResults.id)
    .notNull(),
  parameterId: integer("parameter_id")
    .references(() => evaluationParameters.id)
    .notNull(),
  score: text("score").notNull(), // Can be numeric or yes/no/na
  comment: text("comment"),
  noReason: text("no_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Evaluation types
export type EvaluationTemplate = InferSelectModel<typeof evaluationTemplates>;
export type EvaluationPillar = InferSelectModel<typeof evaluationPillars>;
export type EvaluationParameter = InferSelectModel<typeof evaluationParameters>;
export type EvaluationResult = InferSelectModel<typeof evaluationResults>;
export type EvaluationParameterResult = InferSelectModel<typeof evaluationParameterResults>;

// Evaluation validation schemas
export const insertEvaluationTemplateSchema = createInsertSchema(evaluationTemplates)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Template name is required"),
    description: z.string().optional(),
    status: z.enum(['draft', 'active', 'archived']).default('draft'),
    createdBy: z.number().int().positive("Creator is required"),
    organizationId: z.number().int().positive("Organization is required"),
  });

export const insertEvaluationPillarSchema = createInsertSchema(evaluationPillars)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Pillar name is required"),
    description: z.string().optional(),
    templateId: z.number().int().positive("Template is required"),
    weightage: z.number().int().min(0).max(100),
    orderIndex: z.number().int().min(0),
  });

export const insertEvaluationParameterSchema = createInsertSchema(evaluationParameters)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Parameter name is required"),
    description: z.string().optional(),
    guidelines: z.string().optional(),
    pillarId: z.number().int().positive("Pillar is required"),
    ratingType: z.enum(['yes_no_na', 'numeric', 'custom']),
    weightage: z.number().int().min(0).max(100),
    weightageEnabled: z.boolean().default(true),
    isFatal: z.boolean().default(false),
    requiresComment: z.boolean().default(false),
    noReasons: z.array(z.string()).optional(),
    customRatingOptions: z.array(z.string()).optional(),
    orderIndex: z.number().int().min(0),
  });

export const insertEvaluationResultSchema = createInsertSchema(evaluationResults)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    templateId: z.number().int().positive("Template is required"),
    traineeId: z.number().int().positive("Trainee is required"),
    evaluatorId: z.number().int().positive("Evaluator is required"),
    organizationId: z.number().int().positive("Organization is required"),
    finalScore: z.number().int().min(0).max(100),
  });

export const insertEvaluationParameterResultSchema = createInsertSchema(evaluationParameterResults)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    evaluationId: z.number().int().positive("Evaluation is required"),
    parameterId: z.number().int().positive("Parameter is required"),
    score: z.string().min(1, "Score is required"),
    comment: z.string().optional(),
    noReason: z.string().optional(),
  });

export type InsertEvaluationTemplate = z.infer<typeof insertEvaluationTemplateSchema>;
export type InsertEvaluationPillar = z.infer<typeof insertEvaluationPillarSchema>;
export type InsertEvaluationParameter = z.infer<typeof insertEvaluationParameterSchema>;
export type InsertEvaluationResult = z.infer<typeof insertEvaluationResultSchema>;
export type InsertEvaluationParameterResult = z.infer<typeof insertEvaluationParameterResultSchema>;

// Base relations
export const evaluationTemplatesRelations = relations(evaluationTemplates, ({ one, many }) => ({
  creator: one(users, {
    fields: [evaluationTemplates.createdBy],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [evaluationTemplates.organizationId],
    references: [organizations.id],
  }),
  pillars: many(evaluationPillars),
  results: many(evaluationResults),
}));

export const evaluationPillarsRelations = relations(evaluationPillars, ({ one, many }) => ({
  template: one(evaluationTemplates, {
    fields: [evaluationPillars.templateId],
    references: [evaluationTemplates.id],
  }),
  parameters: many(evaluationParameters),
}));

export const evaluationParametersRelations = relations(evaluationParameters, ({ one, many }) => ({
  pillar: one(evaluationPillars, {
    fields: [evaluationParameters.pillarId],
    references: [evaluationPillars.id],
  }),
  results: many(evaluationParameterResults),
}));

export const evaluationResultsRelations = relations(evaluationResults, ({ one, many }) => ({
  template: one(evaluationTemplates, {
    fields: [evaluationResults.templateId],
    references: [evaluationTemplates.id],
  }),
  trainee: one(users, {
    fields: [evaluationResults.traineeId],
    references: [users.id],
  }),
  evaluator: one(users, {
    fields: [evaluationResults.evaluatorId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [evaluationResults.organizationId],
    references: [organizations.id],
  }),
  parameterResults: many(evaluationParameterResults),
}));

export const evaluationParameterResultsRelations = relations(evaluationParameterResults, ({ one }) => ({
  evaluation: one(evaluationResults, {
    fields: [evaluationParameterResults.evaluationId],
    references: [evaluationResults.id],
  }),
  parameter: one(evaluationParameters, {
    fields: [evaluationParameterResults.parameterId],
    references: [evaluationParameters.id],
  }),
}));