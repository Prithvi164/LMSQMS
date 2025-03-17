import { pgTable, text, serial, integer, boolean, timestamp, jsonb, pgEnum, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, type InferSelectModel } from "drizzle-orm";
import { z } from "zod";

// Define all enums at the top
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

// Quiz-related tables
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  type: questionTypeEnum("type").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation"),
  difficultyLevel: integer("difficulty_level").notNull(),
  category: text("category").notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quizTemplates = pgTable("quiz_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  timeLimit: integer("time_limit").notNull(),
  passingScore: integer("passing_score").notNull(),
  shuffleQuestions: boolean("shuffle_questions").default(false).notNull(),
  shuffleOptions: boolean("shuffle_options").default(false).notNull(),
  questionCount: integer("question_count").notNull(),
  categoryDistribution: jsonb("category_distribution").$type<Record<string, number>>(),
  difficultyDistribution: jsonb("difficulty_distribution").$type<Record<string, number>>(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  questions: jsonb("questions").$type<number[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  timeLimit: integer("time_limit").notNull(),
  passingScore: integer("passing_score").notNull(),
  questions: jsonb("questions").$type<number[]>().notNull(),
  templateId: integer("template_id")
    .references(() => quizTemplates.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  status: quizStatusEnum("status").default('in_progress').notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id")
    .references(() => quizzes.id)
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  score: integer("score").notNull(),
  answers: jsonb("answers").$type<{
    questionId: number;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
  }[]>().notNull(),
  completedAt: timestamp("completed_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quizResponses = pgTable("quiz_responses", {
  id: serial("id").primaryKey(),
  quizAttemptId: integer("quiz_attempt_id")
    .references(() => quizAttempts.id)
    .notNull(),
  questionId: integer("question_id")
    .references(() => questions.id)
    .notNull(),
  selectedAnswer: text("selected_answer").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quiz-related types
export type Question = InferSelectModel<typeof questions>;
export type QuizTemplate = InferSelectModel<typeof quizTemplates>;
export type Quiz = InferSelectModel<typeof quizzes>;
export type QuizAttempt = InferSelectModel<typeof quizAttempts>;
export type QuizResponse = InferSelectModel<typeof quizResponses>;

// Quiz-related schemas
export const insertQuestionSchema = createInsertSchema(questions)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    question: z.string().min(1, "Question text is required"),
    type: z.enum(['multiple_choice', 'true_false', 'short_answer']),
    options: z.array(z.string()).min(2, "At least two options are required for multiple choice"),
    correctAnswer: z.string().min(1, "Correct answer is required"),
    explanation: z.string().optional(),
    difficultyLevel: z.number().int().min(1).max(5),
    category: z.string().min(1, "Category is required"),
    processId: z.number().int().positive("Process is required"),
    organizationId: z.number().int().positive("Organization is required"),
    createdBy: z.number().int().positive("Creator is required"),
  });

export const insertQuizTemplateSchema = createInsertSchema(quizTemplates)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Quiz name is required"),
    description: z.string().optional(),
    timeLimit: z.number().int().positive("Time limit must be positive"),
    passingScore: z.number().int().min(0).max(100),
    shuffleQuestions: z.boolean().default(false),
    shuffleOptions: z.boolean().default(false),
    questionCount: z.number().int().positive("Must select at least one question"),
    categoryDistribution: z.record(z.string(), z.number()).optional(),
    difficultyDistribution: z.record(z.string(), z.number()).optional(),
    processId: z.number().int().positive("Process is required"),
    organizationId: z.number().int().positive("Organization is required"),
    createdBy: z.number().int().positive("Creator is required"),
    questions: z.array(z.number()).min(1, "At least one question is required"),
  });

export const insertQuizSchema = createInsertSchema(quizzes)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    name: z.string().min(1, "Quiz name is required"),
    description: z.string().optional(),
    timeLimit: z.number().int().positive("Time limit must be positive"),
    passingScore: z.number().int().min(0).max(100),
    questions: z.array(z.number()).min(1, "At least one question is required"),
    templateId: z.number().int().positive("Template is required"),
    organizationId: z.number().int().positive("Organization is required"),
    createdBy: z.number().int().positive("Creator is required"),
    processId: z.number().int().positive("Process is required"),
    status: z.enum(['active', 'completed', 'expired']).default('active'),
    startTime: z.date(),
    endTime: z.date(),
  });

export const insertQuizAttemptSchema = createInsertSchema(quizAttempts)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    quizId: z.number().int().positive("Quiz is required"),
    userId: z.number().int().positive("User is required"),
    organizationId: z.number().int().positive("Organization is required"),
    score: z.number().int().min(0).max(100),
    answers: z.array(z.object({
      questionId: z.number(),
      userAnswer: z.string(),
      correctAnswer: z.string(),
      isCorrect: z.boolean(),
    })),
    completedAt: z.date(),
  });

export const insertQuizResponseSchema = createInsertSchema(quizResponses)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    quizAttemptId: z.number().int().positive("Quiz attempt is required"),
    questionId: z.number().int().positive("Question is required"),
    selectedAnswer: z.string().min(1, "Selected answer is required"),
    isCorrect: z.boolean(),
  });

// Add evaluation schema and types
// Evaluation Results schema - simplified version
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
  batchId: integer("batch_id")
    .references(() => organizationBatches.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  totalScore: integer("total_score").default(0).notNull(),
  status: text("status").notNull(),
  evaluatedAt: timestamp("evaluated_at").defaultNow().notNull(),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Evaluation Result schema validation
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
    batchId: z.number().int().positive("Batch is required"),
    organizationId: z.number().int().positive("Organization is required"),
    totalScore: z.number().int().min(0).max(100).default(0),
    status: z.string().min(1, "Status is required").default("pending"),
    evaluatedAt: z.coerce.date().default(() => new Date()),
    comments: z.string().optional().nullable(),
  });

export type EvaluationResult = InferSelectModel<typeof evaluationResults>;
export type InsertEvaluationResult = z.infer<typeof insertEvaluationResultSchema>;

export const evaluationResultsRelations = relations(evaluationResults, ({ one }) => ({
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
  batch: one(organizationBatches, {
    fields: [evaluationResults.batchId],
    references: [organizationBatches.id],
  }),
  organization: one(organizations, {
    fields: [evaluationResults.organizationId],
    references: [organizations.id],
  }),
}));

export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type InsertQuizTemplate = z.infer<typeof insertQuizTemplateSchema>;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type InsertQuizResponse = z.infer<typeof insertQuizResponseSchema>;

// Quiz-related relations
export const questionsRelations = relations(questions, ({ one }) => ({
  process: one(organizationProcesses, {
    fields: [questions.processId],
    references: [organizationProcesses.id],
  }),
  organization: one(organizations, {
    fields: [questions.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [questions.createdBy],
    references: [users.id],
  }),
}));

export const quizTemplatesRelations = relations(quizTemplates, ({ one }) => ({
  process: one(organizationProcesses, {
    fields: [quizTemplates.processId],
    references: [organizationProcesses.id],
  }),
  organization: one(organizations, {
    fields: [quizTemplates.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [quizTemplates.createdBy],
    references: [users.id],
  }),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  template: one(quizTemplates, {
    fields: [quizzes.templateId],
    references: [quizTemplates.id],
  }),
  organization: one(organizations, {
    fields: [quizzes.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [quizzes.createdBy],
    references: [users.id],
  }),
  process: one(organizationProcesses, {
    fields: [quizzes.processId],
    references: [organizationProcesses.id],
  }),
  attempts: many(quizAttempts),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [quizAttempts.organizationId],
    references: [organizations.id],
  }),
  responses: many(quizResponses)
}));

export const quizResponsesRelations = relations(quizResponses, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [quizResponses.quizAttemptId],
    references: [quizAttempts.id],
  }),
  question: one(questions, {
    fields: [quizResponses.questionId],
    references: [questions.id],
  }),
}));


export const batchTemplates = pgTable("batch_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  locationId: integer("location_id")
    .references(() => organizationLocations.id)
    .notNull(),
  lineOfBusinessId: integer("line_of_business_id")
    .references(() => organizationLineOfBusinesses.id)
    .notNull(),
  trainerId: integer("trainer_id")
    .references(() => users.id, { onDelete: 'set null' }),  
  batchCategory: batchCategoryEnum("batch_category").notNull(),
  capacityLimit: integer("capacity_limit").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BatchTemplate = InferSelectModel<typeof batchTemplates>;

// Add template schema validation
export const insertBatchTemplateSchema = createInsertSchema(batchTemplates)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Template name is required"),
    description: z.string().optional(),
    organizationId: z.number().int().positive("Organization is required"),
    processId: z.number().int().positive("Process is required"),
    locationId: z.number().int().positive("Location is required"),
    lineOfBusinessId: z.number().int().positive("Line of Business is required"),
    trainerId: z.number().int().positive("Trainer is required"),
    batchCategory: z.enum(['new_training', 'upskill']),
    capacityLimit: z.number().int().min(1, "Capacity must be at least 1"),
  });

export type InsertBatchTemplate = z.infer<typeof insertBatchTemplateSchema>;

// Add relations for batch templates
export const batchTemplatesRelations = relations(batchTemplates, ({ one }) => ({
  organization: one(organizations, {
    fields: [batchTemplates.organizationId],
    references: [organizations.id],
  }),
  process: one(organizationProcesses, {
    fields: [batchTemplates.processId],
    references: [organizationProcesses.id],
  }),
  location: one(organizationLocations, {
    fields: [batchTemplates.locationId],
    references: [organizationLocations.id],
  }),
  lob: one(organizationLineOfBusinesses, {
    fields: [batchTemplates.lineOfBusinessId],
    references: [organizationLineOfBusinesses.id],
  }),
  trainer: one(users, {
    fields: [batchTemplates.trainerId],
    references: [users.id],
  }),
}));

export const organizationBatches = pgTable("organization_batches", {
  id: serial("id").primaryKey(),
  batchCategory: batchCategoryEnum("batch_category").notNull(),
  name: text("name").notNull().unique(),
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
    .references(() => users.id, { onDelete: 'set null' }),  
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  lineOfBusinessId: integer("line_of_business_id")
    .references(() => organizationLineOfBusinesses.id)
    .notNull(),
  inductionStartDate: date("induction_start_date").notNull(),
  inductionEndDate: date("induction_end_date"),
  trainingStartDate: date("training_start_date"),
  trainingEndDate: date("training_end_date"),
  certificationStartDate: date("certification_start_date"),
  certificationEndDate: date("certification_end_date"),
  ojtStartDate: date("ojt_start_date"),
  ojtEndDate: date("ojt_end_date"),
  ojtCertificationStartDate: date("ojt_certification_start_date"),
  ojtCertificationEndDate: date("ojt_certification_end_date"),
  handoverToOpsDate: date("handover_to_ops_date"),
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
  lob: one(organizationLineOfBusinesses, {
    fields: [organizationBatches.lineOfBusinessId],
    references: [organizationLineOfBusinesses.id],
  }),
  trainer: one(users, {
    fields: [organizationBatches.trainerId],
    references: [users.id],
  }),
}));

// Update validation schema to properly handle the enum
export const insertOrganizationBatchSchema = createInsertSchema(organizationBatches)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    batchCategory: z.enum(['new_training', 'upskill']),
    name: z.string().min(1, "Batch name is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    inductionStartDate: z.string().min(1, "Induction Start date is required"),
    inductionEndDate: z.string().optional(),
    trainingStartDate: z.string().optional(),
    trainingEndDate: z.string().optional(),
    certificationStartDate: z.string().optional(),
    certificationEndDate: z.string().optional(),
    ojtStartDate: z.string().optional(),
    ojtEndDate: z.string().optional(),
    ojtCertificationStartDate: z.string().optional(),
    ojtCertificationEndDate: z.string().optional(),
    handoverToOpsDate: z.string().optional(),
    capacityLimit: z.number().int().min(1, "Capacity must be at least 1"),
    status: z.enum(['planned', 'induction', 'training', 'certification', 'ojt', 'ojt_certification', 'completed']).default('planned'),
    processId: z.number().int().positive("Process is required"),
    locationId: z.number().int().positive("Location is required"),
    lineOfBusinessId: z.number().int().positive("Line of Business is required"),
    trainerId: z.number().int().positive("Trainer is required"),
    organizationId: z.number().int().positive("Organization is required"),
  });

export type InsertOrganizationBatch = z.infer<typeof insertOrganizationBatchSchema>;

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Organization = InferSelectModel<typeof organizations>;

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

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
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
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
});

export type User = InferSelectModel<typeof users>;

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
  lineOfBusinessId: integer("line_of_business_id")
    .references(() => organizationLineOfBusinesses.id),  
  locationId: integer("location_id")
    .references(() => organizationLocations.id),  
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
  batches: many(organizationBatches),
  templates: many(batchTemplates)
}));

export const organizationLocationsRelations = relations(organizationLocations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [organizationLocations.organizationId],
    references: [organizations.id],
  }),
  batches: many(organizationBatches)
}));

export const userBatchStatusEnum = pgEnum('user_batch_status', [
  'active',
  'completed',
  'dropped',
  'on_hold'
]);

export const userBatchProcesses = pgTable("user_batch_processes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  batchId: integer("batch_id")
    .references(() => organizationBatches.id)
    .notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  status: userBatchStatusEnum("status").default('active').notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Ensure a user can only be assigned to a batch-process combination once
    unq: unique().on(table.userId, table.batchId, table.processId),
  };
});

export type UserBatchProcess = InferSelectModel<typeof userBatchProcesses>;

export const insertUserBatchProcessSchema = createInsertSchema(userBatchProcesses)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    userId: z.number().int().positive("User ID is required"),
    batchId: z.number().int().positive("Batch ID is required"),
    processId: z.number().int().positive("Process ID is required"),
    status: z.enum(['active', 'completed', 'dropped', 'on_hold']).default('active'),
    joinedAt: z.string().min(1, "Joined date is required"),
    completedAt: z.string().optional(),
  });

export type InsertUserBatchProcess = z.infer<typeof insertUserBatchProcessSchema>;

export const userBatchProcessesRelations = relations(userBatchProcesses, ({ one }) => ({
  user: one(users, {
    fields: [userBatchProcesses.userId],
    references: [users.id],
  }),
  batch: one(organizationBatches, {
    fields: [userBatchProcesses.batchId],
    references: [organizationBatches.id],
  }),
  process: one(organizationProcesses, {
    fields: [userBatchProcesses.processId],
    references: [organizationProcesses.id],
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
  batches: many(organizationBatches),
  batchProcesses: many(userBatchProcesses)
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
  }),
  location: one(organizationLocations, {
    fields: [userProcesses.locationId],
    references: [organizationLocations.id],
  }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  organization: one(organizations, {
    fields: [rolePermissions.organizationId],
    references: [organizations.id],
  }),
}));

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
    inductionDays: z.number().min(0, "Induction days cannot be negative"),
    trainingDays: z.number().min(0, "Training days cannot be negative"),
    certificationDays: z.number().min(0, "Certification days cannot be negative"),
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
    createdAt: true})
  .extend({
    name: z.string().min(11, "LOBname is required"),
    description: z.string().min(11, "Description is required"),
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
    role: z.enum(['owner', 'admin', 'manager', 'team_lead', 'quality_analyst', 'trainer', 'advisor', 'trainee']).default('trainee'),
  });

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserWithProcessesSchema = insertUserSchema.extend({
  processes: z.array(z.number()).optional(),
});

export type InsertUserWithProcesses = z.infer<typeof insertUserWithProcessesSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertOrganizationProcess = z.infer<typeof insertOrganizationProcessSchema>;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type InsertBatchTemplate = z.infer<typeof insertBatchTemplateSchema>;


export const batchHistoryEventTypeEnum = pgEnum('batch_history_event_type', [
  'phase_change',
  'status_update',
  'milestone',
  'note'
]);

export const batchHistory = pgTable("batch_history", {  id: serial("id").primaryKey(),
  batchId: integer("batch_id")
    .references(() => organizationBatches.id)
    .notNull(),
  eventType: batchHistoryEventTypeEnum("event_type").notNull(),
  description: text("description").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  date: timestamp("date").defaultNow().notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BatchHistory = InferSelectModel<typeof batchHistory>;

export const insertBatchHistorySchema = createInsertSchema(batchHistory)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    batchId: z.number().int().positive("Batch ID is required"),
    eventType:z.enum(['phase_change', 'status_update', 'milestone', 'note']),    description: z.string().min(1, "Description is required"),
    previousValue: z.string().optional(),
    newValue: z.string().optional(),
    date: z.string().min(1, "Date is required"),
    userId: z.number().int().positive("User ID is required"),
    organizationId: z.number().int().positive("Organization ID is required"),
  });

export type InsertBatchHistory = z.infer<typeof insertBatchHistorySchema>;

export const batchHistoryRelations = relations(batchHistory, ({ one }) => ({
  batch: one(organizationBatches, {
    fields: [batchHistory.batchId],
    references: [organizationBatches.id],
  }),
  user: one(users, {
    fields: [batchHistory.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [batchHistory.organizationId],
    references: [organizations.id],
  }),
}));

export interface RolePermission {
  id: number;
  role: string;
  permissions: string[];
  organizationId: number;
  createdAt: Date;
  updatedAt: Date;
}

export const attendanceStatusEnum = pgEnum('attendance_status', [
  'present',
  'absent',
  'late',
  'leave'
]);

export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  traineeId: integer("trainee_id")
    .references(() => users.id)
    .notNull(),
  batchId: integer("batch_id")
    .references(() => organizationBatches.id)
    .notNull(),
  phase: batchStatusEnum("phase").notNull(),
  status: attendanceStatusEnum("status").notNull(),
  date: date("date").notNull(),
  markedById: integer("marked_by_id")
    .references(() => users.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Ensure only one attendance record per trainee per day per batch
    unq: unique().on(table.traineeId, table.date, table.batchId),
  };
});

export const attendanceRelations = relations(attendance, ({ one }) => ({
  trainee: one(users, {
    fields: [attendance.traineeId],
    references: [users.id],
  }),
  markedBy: one(users, {
    fields: [attendance.markedById],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [attendance.organizationId],
    references: [organizations.id],
  }),
  batch: one(organizationBatches, {
    fields: [attendance.batchId],
    references: [organizationBatches.id],
  }),
}));

export const insertAttendanceSchema = createInsertSchema(attendance)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    traineeId: z.number().int().positive("Trainee ID is required"),
    batchId: z.number().int().positive("Batch ID is required"),
    phase: z.enum(['induction', 'training', 'certification', 'ojt', 'ojt_certification']),
    status: z.enum(['present', 'absent', 'late', 'leave']),
    date: z.string().min(1, "Date is required"),
    markedById: z.number().int().positive("Marker ID is required"),
    organizationId: z.number().int().positive("Organization ID is required"),
  });

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = InferSelectModel<typeof attendance>;

export const phaseChangeRequestStatusEnum = pgEnum('phase_change_request_status', [
  'pending',
  'approved',
  'rejected'
]);

export const batchPhaseChangeRequests = pgTable("batch_phase_change_requests", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id")
    .references(() => organizationBatches.id)
    .notNull(),
  trainerId: integer("trainer_id")
    .references(() => users.id)
    .notNull(),
  managerId: integer("manager_id")
    .references(() => users.id)
    .notNull(),
  currentPhase: batchStatusEnum("current_phase").notNull(),
  requestedPhase: batchStatusEnum("requested_phase").notNull(),
  justification: text("justification").notNull(),
  status: phaseChangeRequestStatusEnum("status").default('pending').notNull(),
  managerComments: text("manager_comments"),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const batchPhaseChangeRequestsRelations = relations(batchPhaseChangeRequests, ({ one }) => ({
  batch: one(organizationBatches, {
    fields: [batchPhaseChangeRequests.batchId],
    references: [organizationBatches.id],
  }),
  trainer: one(users, {
    fields: [batchPhaseChangeRequests.trainerId],
    references: [users.id],
  }),
  manager: one(users, {
    fields: [batchPhaseChangeRequests.managerId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [batchPhaseChangeRequests.organizationId],
    references: [organizations.id],
  }),
}));

export type BatchPhaseChangeRequest = InferSelectModel<typeof batchPhaseChangeRequests>;

export const insertBatchPhaseChangeRequestSchema = createInsertSchema(batchPhaseChangeRequests)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    batchId: z.number().int().positive("Batch ID is required"),
    trainerId: z.number().int().positive("Trainer ID is required"),
    managerId: z.number().int().positive("Manager ID is required"),
    currentPhase: z.enum(['planned', 'induction', 'training', 'certification', 'ojt', 'ojt_certification', 'completed']),
    requestedPhase: z.enum(['planned', 'induction', 'training', 'certification', 'ojt', 'ojt_certification', 'completed']),
    justification: z.string().min(1, "Justification is required"),
    status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
    managerComments: z.string().optional(),
    organizationId: z.number().int().positive("Organization ID is required"),
  });

export type InsertBatchPhaseChangeRequest = z.infer<typeof insertBatchPhaseChangeRequestSchema>;

export type {
  Organization,
  OrganizationProcess,
  OrganizationLocation,
  OrganizationLineOfBusiness,
  User,
  UserProcess,
  BatchTemplate,
  UserBatchProcess,
  InsertUser,
  InsertOrganization,
  InsertOrganizationProcess,
  InsertRolePermission,
  InsertOrganizationBatch,
  InsertBatchTemplate,
  InsertUserBatchProcess,
  RolePermission,
  Attendance,
  BatchPhaseChangeRequest,
  InsertBatchPhaseChangeRequest,
  InsertAttendance,
  BatchHistory,
  InsertBatchHistory,
  Question,
  QuizTemplate,
  QuizAttempt,
  QuizResponse,
  InsertQuestion,
  InsertQuizTemplate,
  InsertQuizAttempt,
  InsertQuizResponse,
  Quiz,
  InsertQuiz,
  MockCallScenario,
  MockCallAttempt,
  InsertMockCallScenario,
  InsertMockCallAttempt,
  EvaluationTemplate,
  EvaluationPillar,
  EvaluationParameter,
  EvaluationSubReason,
  EvaluationResult,
  EvaluationParameterResult,
  InsertEvaluationTemplate,
  InsertEvaluationPillar,
  InsertEvaluationParameter,
  InsertEvaluationSubReason,
  InsertEvaluationResult,
  InsertEvaluationParameterResult
};

// Add new enums for mock calls
export const mockCallDifficultyEnum = pgEnum('mock_call_difficulty', [
  'basic',
  'intermediate',
  'advanced'
]);

export const callEvaluationStatusEnum = pgEnum('call_evaluation_status', [
  'pending',
  'completed',
  'failed'
]);

// Mock call scenarios table
export const mockCallScenarios = pgTable("mock_call_scenarios", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  difficulty: mockCallDifficultyEnum("difficulty").notNull(),
  customerProfile: jsonb("customer_profile").$type<{
    name: string;
    background: string;
    personality: string;
    concerns: string[];
  }>().notNull(),
  expectedDialogue: jsonb("expected_dialogue").$type<{
    greeting: string;
    keyPoints: string[];
    resolutions: string[];
    closingStatements: string[];
  }>().notNull(),
  evaluationRubric: jsonb("evaluation_rubric").$type<{
    greetingScore: number;
    problemIdentificationScore: number;
    solutionScore: number;
    communicationScore: number;
    closingScore: number;
  }>().notNull(),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Mock call attempts table
export const mockCallAttempts = pgTable("mock_call_attempts", {
  id: serial("id").primaryKey(),
  scenarioId: integer("scenario_id")
    .references(() => mockCallScenarios.id)
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  evaluatorId: integer("evaluator_id")
    .references(() => users.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  status: callEvaluationStatusEnum("status").default('pending').notNull(),
  recordingUrl: text("recording_url"),
  scores: jsonb("scores").$type<{
    greeting: number;
    problemIdentification: number;
    solution: number;
    communication: number;
    closing: number;
    total: number;
  }>(),
  feedback: text("feedback"),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Types for the new tables
export type MockCallScenario = typeof mockCallScenarios.$inferSelect;
export type MockCallAttempt = typeof mockCallAttempts.$inferSelect;

// Insert schemas for validation
export const insertMockCallScenarioSchema = createInsertSchema(mockCallScenarios)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    difficulty: z.enum(['basic', 'intermediate', 'advanced']),
    customerProfile: z.object({
      name: z.string(),
      background: z.string(),
      personality: z.string(),
      concerns: z.array(z.string()),
    }),
    expectedDialogue: z.object({
      greeting: z.string(),
      keyPoints: z.array(z.string()),
      resolutions: z.array(z.string()),
      closingStatements: z.array(z.string()),
    }),
    evaluationRubric: z.object({
      greetingScore: z.number().min(0).max(100),
      problemIdentificationScore: z.number().min(0).max(100),
      solutionScore: z.number().min(0).max(100),
      communicationScore: z.number().min(0).max(100),
      closingScore: z.number().min(0).max(100),
    }),
    processId: z.number().int().positive("Process is required"),
    organizationId: z.number().int().positive("Organization is required"),
    createdBy: z.number().int().positive("Creator is required"),
  });

export const insertMockCallAttemptSchema = createInsertSchema(mockCallAttempts)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    scenarioId: z.number().int().positive("Scenario is required"),
    userId: z.number().int().positive("User is required"),
    evaluatorId: z.number().int().positive("Evaluator is required"),
    organizationId: z.number().int().positive("Organization is required"),
    status: z.enum(['pending', 'completed', 'failed']).default('pending'),
    recordingUrl: z.string().optional(),
    scores: z.object({
      greeting: z.number().min(0).max(100),
      problemIdentification: z.number().min(0).max(100),
      solution: z.number().min(0).max(100),
      communication: z.number().min(0).max(100),
      closing: z.number().min(0).max(100),
      total: z.number().min(0).max(100),
    }).optional(),
    feedback: z.string().optional(),
    startedAt: z.string().min(1, "Start time is required"),
    completedAt: z.string().optional(),
  });

export type InsertMockCallScenario = z.infer<typeof insertMockCallScenarioSchema>;
export type InsertMockCallAttempt = z.infer<typeof insertMockCallAttemptSchema>;

// Add relations for the new tables
export const mockCallScenariosRelations = relations(mockCallScenarios, ({ one, many }) => ({
  process: one(organizationProcesses, {
    fields: [mockCallScenarios.processId],
    references: [organizationProcesses.id],
  }),
  organization: one(organizations, {
    fields: [mockCallScenarios.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [mockCallScenarios.createdBy],
    references: [users.id],
  }),
  attempts: many(mockCallAttempts),
}));

export const mockCallAttemptsRelations = relations(mockCallAttempts, ({ one }) => ({
  scenario: one(mockCallScenarios, {
    fields: [mockCallAttempts.scenarioId],
    references: [mockCallScenarios.id],
  }),
  user: one(users, {
    fields: [mockCallAttempts.userId],
    references: [users.id],
  }),
  evaluator: one(users, {
    fields: [mockCallAttempts.evaluatorId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [mockCallAttempts.organizationId],
    references: [organizations.id],
  }),
}));

// Evaluation related enums
export const evaluationRatingTypeEnum = pgEnum('evaluation_rating_type', [
  'yes_no_na',
  'numeric',
  'custom'
]);

export const evaluationStatusEnum = pgEnum('evaluation_status', [
  'draft',
  'active',
  'archived'
]);

// Evaluation Templates
export const evaluationTemplates = pgTable("evaluation_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  processId: integer("process_id")
    .references(() => organizationProcesses.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  status: evaluationStatusEnum("status").default('draft').notNull(),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Evaluation Pillars (Categories)
export const evaluationPillars = pgTable("evaluation_pillars", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .references(() => evaluationTemplates.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  weightage: integer("weightage").notNull(), // Percentage weightage of this pillar
  orderIndex: integer("order_index").notNull(), // For maintaining display order
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Evaluation Parameters
export const evaluationParameters = pgTable("evaluation_parameters", {
  id: serial("id").primaryKey(),
  pillarId: integer("pillar_id")
    .references(() => evaluationPillars.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  guidelines: text("guidelines"), // Detailed instructions for evaluation
  ratingType: text("rating_type").notNull(),
  weightage: integer("weightage").notNull(), // Percentage weightage within the pillar
  weightageEnabled: boolean("weightage_enabled").default(true).notNull(), // New field
  isFatal: boolean("is_fatal").default(false).notNull(), // Whether this parameter can cause automatic failure
  requiresComment: boolean("requires_comment").default(false).notNull(),
  noReasons: jsonb("no_reasons").$type<string[]>(),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sub-reasons for parameter ratings
export const evaluationSubReasons = pgTable("evaluation_sub_reasons", {
  id: serial("id").primaryKey(),
  parameterId: integer("parameter_id")
    .references(() => evaluationParameters.id)
    .notNull(),
  reason: text("reason").notNull(),
  appliesTo: text("applies_to").notNull(), // e.g., "no" for Yes/No/NA, or specific rating value
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Add evaluation result tables and schemas
// Evaluation Results schema - simplified version
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
  batchId: integer("batch_id")
    .references(() => organizationBatches.id)
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  totalScore: integer("total_score").default(0).notNull(),
  status: text("status").notNull(),
  evaluatedAt: timestamp("evaluated_at").defaultNow().notNull(),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Evaluation Result schema validation
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
    batchId: z.number().int().positive("Batch is required"),
    organizationId: z.number().int().positive("Organization is required"),
    totalScore: z.number().int().min(0).max(100).default(0),
    status: z.string().min(1, "Status is required").default("pending"),
    evaluatedAt: z.coerce.date().default(() => new Date()),
    comments: z.string().optional().nullable(),
  });

export type EvaluationResult = InferSelectModel<typeof evaluationResults>;
export type InsertEvaluationResult = z.infer<typeof insertEvaluationResultSchema>;

export const evaluationResultsRelations = relations(evaluationResults, ({ one }) => ({
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
  batch: one(organizationBatches, {
    fields: [evaluationResults.batchId],
    references: [organizationBatches.id],
  }),
  organization: one(organizations, {
    fields: [evaluationResults.organizationId],
    references: [organizations.id],
  }),
}));

export const evaluationParameterResults = pgTable("evaluation_parameter_results", {
  id: serial("id").primaryKey(),
  evaluationId: integer("evaluation_id")
    .references(() => evaluationResults.id)
    .notNull(),
  parameterId: integer("parameter_id")
    .references(() => evaluationParameters.id)
    .notNull(),
  score: integer("score").notNull(),
  rating: text("rating").notNull(),
  comment: text("comment"),
  noReasons: jsonb("no_reasons").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Add types
export type EvaluationParameterResult = InferSelectModel<typeof evaluationParameterResults>;

// Add insert schemas
export const insertEvaluationTemplateSchema = createInsertSchema(evaluationTemplates)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Template name is required"),
    processId: z.number().int().positive("Process is required"),
    organizationId: z.number().int().positive("Organization is required"),
    createdBy: z.number().int().positive("Creator is required"),
    status: z.enum(['draft', 'active', 'archived']).default('draft'),
  });

export const insertEvaluationPillarSchema = createInsertSchema(evaluationPillars)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    templateId: z.number().int().positive("Template is required"),
    name: z.string().min(1, "Pillar name is required"),
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
    pillarId: z.number().int().positive("Pillar is required"),
    name: z.string().min(1, "Parameter name is required"),
    description: z.string().optional(),
    guidelines: z.string().optional(),
    ratingType: z.string().min(1, "Rating type is required"),
    weightage: z.number().min(0).max(100),
    weightageEnabled: z.boolean().default(true),
    isFatal: z.boolean().default(false),
    requiresComment: z.boolean().default(false),
    noReasons: z.array(z.string()).optional(),
    orderIndex: z.number().int().min(0),
  });

export const insertEvaluationSubReasonSchema = createInsertSchema(evaluationSubReasons)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    parameterId: z.number().int().positive("Parameter is required"),
    reason: z.string().min(1, "Reason is required"),
    appliesTo: z.string().min(1, "Applies to value is required"),
    orderIndex: z.number().int().min(0),
  });

// Update the evaluation result schema to handle validation properly
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
    batchId: z.number().int().positive("Batch is required"),
    organizationId: z.number().int().positive("Organization is required"),
    totalScore: z.number().int().min(0).max(100).default(0),
    status: z.string().min(1, "Status is required").default("pending"),
    evaluatedAt: z.coerce.date().default(() => new Date()),
    comments: z.string().optional().nullable(),
  });

export const insertEvaluationParameterResultSchema = createInsertSchema(evaluationParameterResults)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    evaluationId: z.number().int().positive("Evaluation is required"),
    parameterId: z.number().int().positive("Parameter is required"),
    score: z.number().int().min(0).max(100),
    rating: z.string().min(1, "Rating is required"),
    comment: z.string().optional(),
    noReasons: z.array(z.string()).optional(),
  });

// Add types for the insert schemas
export type InsertEvaluationResult = z.infer<typeof insertEvaluationResultSchema>;
export type InsertEvaluationParameterResult = z.infer<typeof insertEvaluationParameterResultSchema>;

// Add relations
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
  batch: one(organizationBatches, {
    fields: [evaluationResults.batchId],
    references: [organizationBatches.id],
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

export const evaluationTemplatesRelations = relations(evaluationTemplates, ({ one, many }) => ({
  process: one(organizationProcesses, {
    fields: [evaluationTemplates.processId],
    references: [organizationProcesses.id],
  }),
  organization: one(organizations, {
    fields: [evaluationTemplates.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [evaluationTemplates.createdBy],
    references: [users.id],
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
  subReasons: many(evaluationSubReasons),
  results: many(evaluationParameterResults),
}));

export const evaluationSubReasonsRelations = relations(evaluationSubReasons, ({ one }) => ({
  parameter: one(evaluationParameters, {
    fields: [evaluationSubReasons.parameterId],
    references: [evaluationParameters.id],
  }),
}));