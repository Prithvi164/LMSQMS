1:99: export type OrganizationLineOfBusiness = InferSelectModel<typeof organizationLineOfBusinesses>;
2:600: 
3:601: export const users = pgTable("users", {
4:602:   id: serial("id").primaryKey(),
5:603:   username: text("username").notNull().unique(),
6:604:   password: text("password").notNull(),
7:605:   fullName: text("full_name").notNull(),
8:606:   employeeId: text("employee_id").notNull().unique(),
9:607:   role: roleEnum("role").notNull(),
10:608:   category: userCategoryTypeEnum("category").default('trainee').notNull(),
11:609:   locationId: integer("location_id").references(() => organizationLocations.id),
12:610:   email: text("email").notNull(),
13:611:   education: text("education"),
14:612:   dateOfJoining: date("date_of_joining"),
15:613:   phoneNumber: text("phone_number"),
16:614:   dateOfBirth: date("date_of_birth"),
17:615:   lastWorkingDay: date("last_working_day"),
18:616:   organizationId: integer("organization_id")
19:617:     .references(() => organizations.id),
20:618:   managerId: integer("manager_id")
21:619:     .references(() => users.id),
22:620:   active: boolean("active").notNull().default(true),
23:621:   certified: boolean("certified").notNull().default(false),
24:622:   createdAt: timestamp("created_at").defaultNow().notNull(),
25:623:   onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
26:624: });
27:625: 
28:626: export type User = InferSelectModel<typeof users>;
29:627: 
30:628: export const userProcesses = pgTable("user_processes", {
31:629:   id: serial("id").primaryKey(),
32:630:   userId: integer("user_id")
33:631:     .references(() => users.id)
34:632:     .notNull(),
35:633:   processId: integer("process_id")
36:634:     .references(() => organizationProcesses.id)
37:635:     .notNull(),
38:636:   organizationId: integer("organization_id")
39:637:     .references(() => organizations.id)
40:638:     .notNull(),
41:639:   lineOfBusinessId: integer("line_of_business_id")
42:640:     .references(() => organizationLineOfBusinesses.id),
43:641:   locationId: integer("location_id")
44:642:     .references(() => organizationLocations.id),
45:643:   status: text("status").default('assigned').notNull(),
46:644:   assignedAt: timestamp("assigned_at").defaultNow().notNull(),
47:645:   completedAt: timestamp("completed_at"),
48:646:   createdAt: timestamp("created_at").defaultNow().notNull(),
49:647:   updatedAt: timestamp("updated_at").defaultNow().notNull(),
50:648: }, (table) => {
51:649:   return {
52:650:     unq: unique().on(table.userId, table.processId),
53:651:   };
54:652: });
55:653: 
56:654: export type UserProcess = typeof userProcesses.$inferSelect;
57:655: 
58:656: export const rolePermissions = pgTable("role_permissions", {
59:657:   id: serial("id").primaryKey(),
60:658:   role: roleEnum("role").notNull(),
61:659:   permissions: jsonb("permissions").notNull().$type<string[]>(),
62:660:   organizationId: integer("organization_id")
63:661:     .references(() => organizations.id)
64:662:     .notNull(),
65:663:   createdAt: timestamp("created_at").defaultNow().notNull(),
66:664:   updatedAt: timestamp("updated_at").defaultNow().notNull(),
67:665: });
68:666: 
69:667: export const organizationsRelations = relations(organizations, ({ many }) => ({
70:668:   users: many(users),
71:669:   processes: many(organizationProcesses),
72:670:   locations: many(organizationLocations),
73:671:   lineOfBusinesses: many(organizationLineOfBusinesses),
74:672:   rolePermissions: many(rolePermissions),
75:673:   batches: many(organizationBatches)
76:674: }));
77:675: 
78:676: export const organizationProcessesRelations = relations(organizationProcesses, ({ one, many }) => ({
79:677:   organization: one(organizations, {
80:678:     fields: [organizationProcesses.organizationId],
81:679:     references: [organizations.id],
82:680:   }),
83:681:   lineOfBusiness: one(organizationLineOfBusinesses, {
84:682:     fields: [organizationProcesses.lineOfBusinessId],
85:683:     references: [organizationLineOfBusinesses.id],
86:684:   }),
87:685:   batches: many(organizationBatches),
88:686:   templates: many(batchTemplates)
89:687: }));
90:688: 
91:689: export const organizationLocationsRelations = relations(organizationLocations, ({ one, many }) => ({
92:690:   organization: one(organizations, {
93:691:     fields: [organizationLocations.organizationId],
94:692:     references: [organizations.id],
95:693:   }),
96:694:   batches: many(organizationBatches)
97:695: }));
98:696: 
99:697: export const userBatchStatusEnum = pgEnum('user_batch_status', [
100:698:   'active',
101:699:   'completed',
102:700:   'dropped',
103:701:   'on_hold'
104:702: ]);
105:703: 
106:704: export const userBatchProcesses = pgTable("user_batch_processes", {
107:705:   id: serial("id").primaryKey(),
108:706:   userId: integer("user_id")
109:707:     .references(() => users.id)
110:708:     .notNull(),
111:709:   batchId: integer("batch_id")
112:710:     .references(() => organizationBatches.id)
113:711:     .notNull(),
114:712:   processId: integer("process_id")
115:713:     .references(() => organizationProcesses.id)
116:714:     .notNull(),
117:715:   status: userBatchStatusEnum("status").default('active').notNull(),
118:716:   joinedAt: timestamp("joined_at").defaultNow().notNull(),
119:717:   completedAt: timestamp("completed_at"),
120:718:   createdAt: timestamp("created_at").defaultNow().notNull(),
121:719:   updatedAt: timestamp("updated_at").defaultNow().notNull(),
122:720: }, (table) => {
123:721:   return {
124:722:     // Ensure a user can only be assigned to a batch-process combination once
125:723:     unq: unique().on(table.userId, table.batchId, table.processId),
126:724:   };
127:725: });
128:726: 
129:727: export type UserBatchProcess = InferSelectModel<typeof userBatchProcesses>;
130:728: 
131:729: export const insertUserBatchProcessSchema = createInsertSchema(userBatchProcesses)
132:730:   .omit({
133:731:     id: true,
134:732:     createdAt: true,
135:733:     updatedAt: true,
136:734:   })
137:735:   .extend({
138:736:     userId: z.number().int().positive("User ID is required"),
139:737:     batchId: z.number().int().positive("Batch ID is required"),
140:738:     processId: z.number().int().positive("Process ID is required"),
141:739:     status: z.enum(['active', 'completed', 'dropped', 'on_hold']).default('active'),
142:740:     joinedAt: z.string().min(1, "Joined date is required"),
143:741:     completedAt: z.string().optional(),
144:742:   });
145:743: 
146:744: export type InsertUserBatchProcess = z.infer<typeof insertUserBatchProcessSchema>;
147:745: 
148:746: export const userBatchProcessesRelations = relations(userBatchProcesses, ({ one }) => ({
149:747:   user: one(users, {
150:748:     fields: [userBatchProcesses.userId],
151:749:     references: [users.id],
152:750:   }),
153:751:   batch: one(organizationBatches, {
154:752:     fields: [userBatchProcesses.batchId],
155:753:     references: [organizationBatches.id],
156:754:   }),
157:755:   process: one(organizationProcesses, {
158:756:     fields: [userBatchProcesses.processId],
159:757:     references: [organizationProcesses.id],
160:758:   }),
161:759: }));
162:760: 
163:761: export const usersRelations = relations(users, ({ one, many }) => ({
164:762:   organization: one(organizations, {
165:763:     fields: [users.organizationId],
166:764:     references: [organizations.id],
167:765:   }),
168:766:   manager: one(users, {
169:767:     fields: [users.managerId],
170:768:     references: [users.id],
171:769:   }),
172:770:   location: one(organizationLocations, {
173:771:     fields: [users.locationId],
174:772:     references: [organizationLocations.id],
175:773:   }),
176:774:   managedProcesses: many(userProcesses),
177:775:   batches: many(organizationBatches),
178:776:   batchProcesses: many(userBatchProcesses)
179:777: }));
180:778: 
181:779: export const userProcessesRelations = relations(userProcesses, ({ one }) => ({
182:780:   user: one(users, {
183:781:     fields: [userProcesses.userId],
184:782:     references: [users.id],
185:783:   }),
186:784:   process: one(organizationProcesses, {
187:785:     fields: [userProcesses.processId],
188:786:     references: [organizationProcesses.id],
189:787:   }),
190:788:   organization: one(organizations, {
191:789:     fields: [userProcesses.organizationId],
192:790:     references: [organizations.id],
193:791:   }),
194:792:   lineOfBusiness: one(organizationLineOfBusinesses, {
195:793:     fields: [userProcesses.lineOfBusinessId],
196:794:     references: [organizationLineOfBusinesses.id],
197:795:   }),
198:796:   location: one(organizationLocations, {
199:797:     fields: [userProcesses.locationId],
200:798:     references: [organizationLocations.id],
201:799:   }),
202:800: }));
203:801: 
204:802: export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
205:803:   organization: one(organizations, {
206:804:     fields: [rolePermissions.organizationId],
207:805:     references: [organizations.id],
208:806:   }),
209:807: }));
210:808: 
211:809: export const insertOrganizationProcessSchema = createInsertSchema(organizationProcesses)
212:810:   .omit({
213:811:     id: true,
214:812:     createdAt: true,
215:813:     updatedAt: true
216:814:   })
217:815:   .extend({
218:816:     name: z.string().min(1, "Process name is required"),
219:817:     description: z.string().optional(),
220:818:     status: z.enum(['active', 'inactive', 'archived']).default('active'),
221:819:     inductionDays: z.number().min(0, "Induction days cannot be negative"),
222:820:     trainingDays: z.number().min(0, "Training days cannot be negative"),
223:821:     certificationDays: z.number().min(0, "Certification days cannot be negative"),
224:822:     ojtDays: z.number().min(0, "OJT days cannot be negative"),
225:823:     ojtCertificationDays: z.number().min(0, "OJT certification days cannot be negative"),
226:824:     lineOfBusinessId: z.number().int().positive("Line of Business is required"),
227:825:     organizationId: z.number().int().positive("Organization is required")
228:826:   });
229:827: 
230:828: export const insertOrganizationLocationSchema = createInsertSchema(organizationLocations)
231:829:   .omit({
232:830:     id: true,
233:831:     createdAt: true
234:832:   })
235:833:   .extend({
236:834:     name: z.string().min(1, "Location name is required"),
237:835:     address: z.string().min(1, "Address is required"),
238:836:     city: z.string().min(1, "City is required"),
239:837:     state: z.string().min(1, "State is required"),
240:838:     country: z.string().min(1, "Country is required"),
241:839:     organizationId: z.number().int().positive("Organization is required"),
242:840:   });
243:841: 
244:842: export const insertOrganizationLineOfBusinessSchema = createInsertSchema(organizationLineOfBusinesses)
245:843:   .omit({
246:844:     id: true,
247:845:     createdAt: true
248:846:   })
249:847:   .extend({
250:848:     name: z.string().min(1, "LOB name is required"),
251:849:     description: z.string().min(1, "Description is required"),
252:850:     organizationId: z.number().int().positive("Organization is required"),
253:851:   });
254:852: 
255:853: export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true });
256:854: 
257:855: export const insertUserSchema = createInsertSchema(users)
258:856:   .omit({ id: true, createdAt: true })
259:857:   .extend({
260:858:     fullName: z.string().min(1, "Full name is required"),
261:859:     employeeId: z.string().min(1, "Employee ID is required"),
262:860:     email: z.string().email("Invalid email format"),
263:861:     phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
264:862:     dateOfJoining: z.string().optional(),
265:863:     dateOfBirth: z.string().optional(),
266:864:     lastWorkingDay: z.string().optional().nullable(),
267:865:     education: z.string().optional(),
268:866:     certified: z.boolean().default(false),
269:867:     active: z.boolean().default(true),
270:868:     category: z.enum(['active', 'trainee']).default('trainee'),
271:869:     role: z.enum(['owner', 'admin', 'manager', 'team_lead', 'quality_analyst', 'trainer', 'advisor', 'trainee']).default('trainee'),
272:870:   });
273:871: 
274:872: export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
275:873:   id: true,
276:874:   createdAt: true,
277:875:   updatedAt: true,
278:876: });
279:877: 
280:878: export const insertUserWithProcessesSchema = insertUserSchema.extend({
281:879:   processes: z.array(z.number()).optional(),
282:880: });
283:881: 
284:882: export type InsertUserWithProcesses = z.infer<typeof insertUserWithProcessesSchema>;
285:883: export type InsertUser = z.infer<typeof insertUserSchema>;
286:884: export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
287:885: export type InsertOrganizationProcess = z.infer<typeof insertOrganizationProcessSchema>;
288:886: export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
289:887: export type InsertBatchTemplate = z.infer<typeof insertBatchTemplateSchema>;
290:888: 
291:889: 
292:890: export const batchHistoryEventTypeEnum = pgEnum('batch_history_event_type', [
293:891:   'phase_change',
294:892:   'status_update',
295:893:   'milestone',
296:894:   'note'
297:895: ]);
298:896: 
299:897: export const batchHistory = pgTable("batch_history", {
300:898:   id: serial("id").primaryKey(),
301:899:   batchId: integer("batch_id")
302:900:     .references(() => organizationBatches.id)
303:901:     .notNull(),
304:902:   eventType: batchHistoryEventTypeEnum("event_type").notNull(),
305:903:   description: text("description").notNull(),
306:904:   previousValue: text("previous_value"),
307:905:   newValue: text("new_value"),
308:906:   date: timestamp("date").defaultNow().notNull(),
309:907:   userId: integer("user_id")
310:908:     .references(() => users.id)
311:909:     .notNull(),
312:910:   organizationId: integer("organization_id")
313:911:     .references(() => organizations.id)
314:912:     .notNull(),
315:913:   createdAt: timestamp("created_at").defaultNow().notNull(),
316:914: });
317:915: 
318:916: export type BatchHistory = InferSelectModel<typeof batchHistory>;
319:917: 
320:918: export const insertBatchHistorySchema = createInsertSchema(batchHistory)
321:919:   .omit({
322:920:     id: true,
323:921:     createdAt: true,
324:922:   })
325:923:   .extend({
326:924:     batchId: z.number().int().positive("Batch ID is required"),
327:925:     eventType: z.enum(['phase_change', 'status_update', 'milestone', 'note']),
328:926:     description: z.string().min(1, "Description is required"),
329:927:     previousValue: z.string().optional(),
330:928:     newValue: z.string().optional(),
331:929:     date: z.string().min(1, "Date is required"),
332:930:     userId: z.number().int().positive("User ID is required"),
333:931:     organizationId: z.number().int().positive("Organization ID is required"),
334:932:   });
335:933: 
336:934: export type InsertBatchHistory = z.infer<typeof insertBatchHistorySchema>;
337:935: 
338:936: export const batchHistoryRelations = relations(batchHistory, ({ one }) => ({
339:937:   batch: one(organizationBatches, {
340:938:     fields: [batchHistory.batchId],
341:939:     references: [organizationBatches.id],
342:940:   }),
343:941:   user: one(users, {
344:942:     fields: [batchHistory.userId],
345:943:     references: [users.id],
346:944:   }),
347:945:   organization: one(organizations, {
348:946:     fields: [batchHistory.organizationId],
349:947:     references: [organizations.id],
350:948:   }),
351:949: }));
352:950: 
353:951: // Add batch quiz template mapping table after batchHistory table
354:952: export const batchQuizTemplates = pgTable("batch_quiz_templates", {
355:953:   id: serial("id").primaryKey(),
356:954:   batchId: integer("batch_id")
357:955:     .references(() => organizationBatches.id)
358:956:     .notNull(),
359:957:   quizTemplateId: integer("quiz_template_id")
360:958:     .references(() => quizTemplates.id)
361:959:     .notNull(),
362:960:   organizationId: integer("organization_id")
363:961:     .references(() => organizations.id)
364:962:     .notNull(),
365:963:   assignedBy: integer("assigned_by")
366:964:     .references(() => users.id)
367:965:     .notNull(),
368:966:   createdAt: timestamp("created_at").defaultNow().notNull(),
369:967:   updatedAt: timestamp("updated_at").defaultNow().notNull(),
370:968: }, (table) => {
371:969:   return {
372:970:     unq: unique().on(table.batchId, table.quizTemplateId),
373:971:   };
374:972: });
375:973: 
376:974: export type BatchQuizTemplate = InferSelectModel<typeof batchQuizTemplates>;
377:975: 
378:976: export const insertBatchQuizTemplateSchema = createInsertSchema(batchQuizTemplates)
379:977:   .omit({
380:978:     id: true,
381:979:     createdAt: true,
382:980:     updatedAt: true,
383:981:   })
384:982:   .extend({
385:983:     batchId: z.number().int().positive("Batch ID is required"),
386:984:     quizTemplateId: z.number().int().positive("Quiz template ID is required"),
387:985:     organizationId: z.number().int().positive("Organization ID is required"),
388:986:     assignedBy: z.number().int().positive("Assigner ID is required"),
389:987:   });
390:988: 
391:989: export type InsertBatchQuizTemplate = z.infer<typeof insertBatchQuizTemplateSchema>;
392:990: 
393:991: // Add relations
394:992: export const batchQuizTemplatesRelations = relations(batchQuizTemplates, ({ one }) => ({
395:993:   batch: one(organizationBatches, {
396:994:     fields: [batchQuizTemplates.batchId],
397:995:     references: [organizationBatches.id],
398:996:   }),
399:997:   template: one(quizTemplates, {
400:998:     fields: [batchQuizTemplates.quizTemplateId],
401:999:     references: [quizTemplates.id],
402:1000:   }),
403:1001:   organization: one(organizations, {
404:1002:     fields: [batchQuizTemplates.organizationId],
405:1003:     references: [organizations.id],
406:1004:   }),
407:1005:   assigner: one(users, {
408:1006:     fields: [batchQuizTemplates.assignedBy],
409:1007:     references: [users.id],
410:1008:   }),
411:1009: }));
412:1010: 
413:1011: // Update organizationBatches relations to include quiz templates
414:1012: export const organizationBatchesRelations = relations(organizationBatches, ({ one, many }) => ({
415:1013:   organization: one(organizations, {
416:1014:     fields: [organizationBatches.organizationId],
417:1015:     references: [organizations.id],
418:1016:   }),
419:1017:   process: one(organizationProcesses, {
420:1018:     fields: [organizationBatches.processId],
421:1019:     references: [organizationProcesses.id],
422:1020:   }),
423:1021:   location: one(organizationLocations, {
424:1022:     fields: [organizationBatches.locationId],
425:1023:     references: [organizationLocations.id],
426:1024:   }),
427:1025:   lob: one(organizationLineOfBusinesses, {
428:1026:     fields: [organizationBatches.lineOfBusinessId],
429:1027:     references: [organizationLineOfBusinesses.id],
430:1028:   }),
431:1029:   trainer: one(users, {
432:1030:     fields: [organizationBatches.trainerId],
433:1031:     references: [users.id],
434:1032:   }),
435:1033:   quizTemplates: many(batchQuizTemplates),
436:1034:   history: many(batchHistory)
437:1035: }));
438:1036: 
439:1037: export interface RolePermission {
440:1038:   id: number;
441:1039:   role: string;
442:1040:   permissions: string[];
443:1041:   organizationId: number;
444:1042:   createdAt: Date;
445:1043:   updatedAt: Date;
446:1044: }
447:1045: 
448:1046: export const attendanceStatusEnum = pgEnum('attendance_status', [
449:1047:   'present',
450:1048:   'absent',
451:1049:   'late',
452:1050:   'leave'
453:1051: ]);
454:1052: 
455:1053: export const attendance = pgTable("attendance", {
456:1054:   id: serial("id").primaryKey(),
457:1055:   traineeId: integer("trainee_id")
458:1056:     .references(() => users.id)
459:1057:     .notNull(),
460:1058:   batchId: integer("batch_id")
461:1059:     .references(() => organizationBatches.id)
462:1060:     .notNull(),
463:1061:   phase: batchStatusEnum("phase").notNull(),
464:1062:   status: attendanceStatusEnum("status").notNull(),
465:1063:   date: date("date").notNull(),
466:1064:   markedById: integer("marked_by_id")
467:1065:     .references(() => users.id)
468:1066:     .notNull(),
469:1067:   organizationId: integer("organization_id")
470:1068:     .references(() => organizations.id)
471:1069:     .notNull(),
472:1070:   createdAt: timestamp("created_at").defaultNow().notNull(),
473:1071:   updatedAt: timestamp("updated_at").defaultNow().notNull(),
474:1072: }, (table) => {
475:1073:   return {
476:1074:     // Ensure only one attendance record per trainee per day per batch
477:1075:     unq: unique().on(table.traineeId, table.date, table.batchId),
478:1076:   };
479:1077: });
480:1078: 
481:1079: export const attendanceRelations = relations(attendance, ({ one }) => ({
482:1080:   trainee: one(users, {
483:1081:     fields: [attendance.traineeId],
484:1082:     references: [users.id],
485:1083:   }),
486:1084:   markedBy: one(users, {
487:1085:     fields: [attendance.markedById],
488:1086:     references: [users.id],
489:1087:   }),
490:1088:   organization: one(organizations, {
491:1089:     fields: [attendance.organizationId],
492:1090:     references: [organizations.id],
493:1091:   }),
494:1092:   batch: one(organizationBatches, {
495:1093:     fields: [attendance.batchId],
496:1094:     references: [organizationBatches.id],
497:1095:   }),
498:1096: }));
499:1097: 
500:1098: export const insertAttendanceSchema = createInsertSchema(attendance)
501:1099:   .omit({
502:1100:     id: true,
503:1101:     createdAt: true,
504:1102:     updatedAt: true,
505:1103:   })
506:1104:   .extend({
507:1105:     traineeId: z.number().int().positive("Trainee ID is required"),
508:1106:     batchId: z.number().int().positive("Batch ID is required"),
509:1107:     phase: z.enum(['induction', 'training', 'certification', 'ojt', 'ojt_certification']),
510:1108:     status: z.enum(['present', 'absent', 'late', 'leave']),
511:1109:     date: z.string().min(1, "Date is required"),
512:1110:     markedById: z.number().int().positive("Marker ID is required"),
513:1111:     organizationId: z.number().int().positive("Organization ID is required"),
514:1112:   });
515:1113: 
516:1114: export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
517:1115: export type Attendance = InferSelectModel<typeof attendance>;
518:1116: 
519:1117: export const phaseChangeRequestStatusEnum = pgEnum('phase_change_request_status', [
520:1118:   'pending',
521:1119:   'approved',
522:1120:   'rejected'
523:1121: ]);
524:1122: 
525:1123: export const batchPhaseChangeRequests = pgTable("batch_phase_change_requests", {
526:1124:   id: serial("id").primaryKey(),
527:1125:   batchId: integer("batch_id")
528:1126:     .references(() => organizationBatches.id)
529:1127:     .notNull(),
530:1128:   trainerId: integer("trainer_id")
531:1129:     .references(() => users.id)
532:1130:     .notNull(),
533:1131:   managerId: integer("manager_id")
534:1132:     .references(() => users.id)
535:1133:     .notNull(),
536:1134:   currentPhase: batchStatusEnum("current_phase").notNull(),
537:1135:   requestedPhase: batchStatusEnum("requested_phase").notNull(),
538:1136:   justification: text("justification").notNull(),
539:1137:   status: phaseChangeRequestStatusEnum("status").default('pending').notNull(),
540:1138:   managerComments: text("manager_comments"),
541:1139:   organizationId: integer("organization_id")
542:1140:     .references(() => organizations.id)
543:1141:     .notNull(),
544:1142:   createdAt: timestamp("created_at").defaultNow().notNull(),
545:1143:   updatedAt: timestamp("updated_at").defaultNow().notNull(),
546:1144: });
547:1145: 
548:1146: export const batchPhaseChangeRequestsRelations = relations(batchPhaseChangeRequests, ({ one }) => ({
549:1147:   batch: one(organizationBatches, {
550:1148:     fields: [batchPhaseChangeRequests.batchId],
551:1149:     references: [organizationBatches.id],
552:1150:   }),
553:1151:   trainer: one(users, {
554:1152:     fields: [batchPhaseChangeRequests.trainerId],
555:1153:     references: [users.id],
556:1154:   }),
557:1155:   manager: one(users, {
558:1156:     fields: [batchPhaseChangeRequests.managerId],
559:1157:     references: [users.id],
560:1158:   }),
561:1159:   organization: one(organizations, {
562:1160:     fields: [batchPhaseChangeRequests.organizationId],
563:1161:     references: [organizations.id],
564:1162:   }),
565:1163: }));
566:1164: 
567:1165: export type BatchPhaseChangeRequest = InferSelectModel<typeof batchPhaseChangeRequests>;
568:1166: 
569:1167: export const insertBatchPhaseChangeRequestSchema = createInsertSchema(batchPhaseChangeRequests)
570:1168:   .omit({
571:1169:     id: true,
572:1170:     createdAt: true,
573:1171:     updatedAt: true,
574:1172:   })
575:1173:   .extend({
576:1174:     batchId: z.number().int().positive("Batch ID is required"),
577:1175:     trainerId: z.number().int().positive("Trainer ID is required"),
578:1176:     managerId: z.number().int().positive("Manager ID is required"),
579:1177:     currentPhase: z.enum(['planned', 'induction', 'training', 'certification', 'ojt', 'ojt_certification', 'completed']),
580:1178:     requestedPhase: z.enum(['planned', 'induction', 'training', 'certification', 'ojt', 'ojt_certification', 'completed']),
581:1179:     justification: z.string().min(1, "Justification is required"),
582:1180:     status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
583:1181:     managerComments: z.string().optional(),
584:1182:     organizationId: z.number().int().positive("Organization ID is required"),
585:1183:   });
586:1184: 
587:1185: export type InsertBatchPhaseChangeRequest = z.infer<typeof insertBatchPhaseChangeRequestSchema>;
588:1186: 
589:1187: export type {
590:1188:   Organization,
591:1189:   OrganizationProcess,
592:1190:   OrganizationLocation,
593:1191:   OrganizationLineOfBusiness,
594:1192:   User,
595:1193:   UserProcess,
596:1194:   BatchTemplate,
597:1195:   UserBatchProcess,
598:1196:   InsertUser,
599:1197:   InsertOrganization,
600:1198:   InsertOrganizationProcess,
601:1199:   InsertRolePermission,
602:1200:   InsertOrganizationBatch,
603:1201:   InsertBatchTemplate,
604:1202:   InsertUserBatchProcess,
605:1203:   RolePermission,
606:1204:   Attendance,
607:1205:   BatchPhaseChangeRequest,
608:1206:   InsertBatchPhaseChangeRequest,
609:1207:   InsertAttendance,
610:1208:   BatchHistory,
611:1209:   InsertBatchHistory,
612:1210:   Question,
613:1211:   QuizTemplate,
614:1212:   QuizAttempt,
615:1213:   QuizResponse,
616:1214:   InsertQuestion,
617:1215:   InsertQuizTemplate,
618:1216:   InsertQuizAttempt,
619:1217:   InsertQuizResponse,
620:1218:   Quiz,
621:1219:   InsertQuiz,
622:1220:   BatchQuizTemplate,
623:1221:   InsertBatchQuizTemplate
624:1222: };