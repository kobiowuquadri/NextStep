-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "syncRev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" UUID NOT NULL,
    "deviceId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "institution" TEXT,
    "programme" TEXT,
    "defaultSessionMinutes" INTEGER NOT NULL,
    "minSessionMinutes" INTEGER NOT NULL,
    "maxSessionMinutes" INTEGER NOT NULL,
    "breakMinutes" INTEGER NOT NULL,
    "dailyLimitMinutes" INTEGER NOT NULL,
    "bufferMinutes" INTEGER NOT NULL,
    "deadlineBufferHours" INTEGER NOT NULL,
    "maxSessionsPerTaskPerDay" INTEGER NOT NULL,
    "planningMode" TEXT NOT NULL,
    "weeklyActiveDaysGoal" INTEGER NOT NULL,
    "quietHoursStart" TEXT NOT NULL,
    "quietHoursEnd" TEXT NOT NULL,
    "notifySessions" BOOLEAN NOT NULL,
    "notifyDeadlines" BOOLEAN NOT NULL,
    "notifyRecovery" BOOLEAN NOT NULL,
    "reminderLeadMinutes" INTEGER NOT NULL,
    "theme" TEXT NOT NULL,
    "motion" TEXT NOT NULL,
    "haptics" BOOLEAN NOT NULL,
    "sound" BOOLEAN NOT NULL,
    "streaksEnabled" BOOLEAN NOT NULL,
    "celebrationsEnabled" BOOLEAN NOT NULL,
    "syncOnCellular" BOOLEAN NOT NULL,
    "mascotSkin" TEXT NOT NULL,
    "mascotAccessory" TEXT NOT NULL,
    "onboardingCompletedAt" TIMESTAMP(3),
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semester" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TEXT,
    "endDate" TEXT,
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "color" TEXT NOT NULL,
    "semesterId" UUID,
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "courseId" UUID,
    "goalId" UUID,
    "kind" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "importance" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "remainingMinutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "dependsOn" TEXT[],
    "preferredSessionMinutes" INTEGER,
    "splittable" BOOLEAN NOT NULL,
    "optional" BOOLEAN NOT NULL,
    "connectivity" TEXT NOT NULL,
    "links" JSONB NOT NULL DEFAULT '[]',
    "resourceIds" TEXT[],
    "completedAt" TIMESTAMP(3),
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subtask" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL,
    "position" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER,
    "completedAt" TIMESTAMP(3),
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Subtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "online" BOOLEAN NOT NULL,
    "label" TEXT,
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commitment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "weekdays" INTEGER[],
    "date" TEXT,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "protected" BOOLEAN NOT NULL,
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayOverride" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" TEXT NOT NULL,
    "maxMinutes" INTEGER,
    "windows" JSONB,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DayOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "planRevisionId" UUID,
    "label" TEXT,
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ScheduledSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanRevision" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "parentNumber" INTEGER,
    "reason" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "replacedSessions" JSONB NOT NULL DEFAULT '[]',
    "createdSessionIds" TEXT[],
    "proposalId" UUID,
    "undoneAt" TIMESTAMP(3),
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlanRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskId" UUID,
    "sessionId" UUID,
    "mode" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "focusMinutes" INTEGER NOT NULL,
    "breakCount" INTEGER NOT NULL,
    "finishedNote" TEXT,
    "remainingMinutes" INTEGER,
    "readiness" TEXT,
    "obstacles" TEXT[],
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FocusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryProposal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "baseRevision" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "nextActionSessionId" UUID,
    "nextActionCompletedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RecoveryProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReflection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "weekStart" TEXT NOT NULL,
    "plannedMinutes" INTEGER NOT NULL,
    "completedMinutes" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "actualMinutes" INTEGER NOT NULL,
    "wentWell" TEXT,
    "obstacles" TEXT[],
    "adjustments" TEXT[],
    "note" TEXT,
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WeeklyReflection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalGoal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "weeklyTargetMinutes" INTEGER NOT NULL,
    "sessionMinutes" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,
    "scheduleIt" BOOLEAN NOT NULL,
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PersonalGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalCheckin" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "date" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GoalCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningResource" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "estMinutes" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "provenance" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceProgress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "downloadedVersion" INTEGER,
    "downloadedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastScore" INTEGER,
    "attempts" INTEGER NOT NULL,
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ResourceProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamificationEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "localDate" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GamificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "badge" TEXT NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL,
    "rev" INTEGER NOT NULL,
    "fieldRevs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncOperation" (
    "opId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("opId")
);

-- CreateTable
CREATE TABLE "DeletionMarker" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "rev" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeletionMarker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncConflict" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "fields" TEXT[],
    "serverValues" JSONB NOT NULL,
    "clientValues" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "rev" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SyncConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "feature" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE INDEX "UserPreferences_userId_rev_idx" ON "UserPreferences"("userId", "rev");

-- CreateIndex
CREATE INDEX "Semester_userId_rev_idx" ON "Semester"("userId", "rev");

-- CreateIndex
CREATE INDEX "Course_userId_rev_idx" ON "Course"("userId", "rev");

-- CreateIndex
CREATE INDEX "Task_userId_rev_idx" ON "Task"("userId", "rev");

-- CreateIndex
CREATE INDEX "Task_userId_dueAt_idx" ON "Task"("userId", "dueAt");

-- CreateIndex
CREATE INDEX "Subtask_userId_rev_idx" ON "Subtask"("userId", "rev");

-- CreateIndex
CREATE INDEX "Subtask_taskId_idx" ON "Subtask"("taskId");

-- CreateIndex
CREATE INDEX "AvailabilityRule_userId_rev_idx" ON "AvailabilityRule"("userId", "rev");

-- CreateIndex
CREATE INDEX "Commitment_userId_rev_idx" ON "Commitment"("userId", "rev");

-- CreateIndex
CREATE INDEX "DayOverride_userId_rev_idx" ON "DayOverride"("userId", "rev");

-- CreateIndex
CREATE INDEX "DayOverride_userId_date_idx" ON "DayOverride"("userId", "date");

-- CreateIndex
CREATE INDEX "ScheduledSession_userId_rev_idx" ON "ScheduledSession"("userId", "rev");

-- CreateIndex
CREATE INDEX "ScheduledSession_userId_startAt_idx" ON "ScheduledSession"("userId", "startAt");

-- CreateIndex
CREATE INDEX "PlanRevision_userId_rev_idx" ON "PlanRevision"("userId", "rev");

-- CreateIndex
CREATE UNIQUE INDEX "PlanRevision_userId_number_key" ON "PlanRevision"("userId", "number");

-- CreateIndex
CREATE INDEX "FocusLog_userId_rev_idx" ON "FocusLog"("userId", "rev");

-- CreateIndex
CREATE INDEX "RecoveryProposal_userId_rev_idx" ON "RecoveryProposal"("userId", "rev");

-- CreateIndex
CREATE INDEX "WeeklyReflection_userId_rev_idx" ON "WeeklyReflection"("userId", "rev");

-- CreateIndex
CREATE INDEX "WeeklyReflection_userId_weekStart_idx" ON "WeeklyReflection"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "PersonalGoal_userId_rev_idx" ON "PersonalGoal"("userId", "rev");

-- CreateIndex
CREATE INDEX "GoalCheckin_userId_rev_idx" ON "GoalCheckin"("userId", "rev");

-- CreateIndex
CREATE UNIQUE INDEX "LearningResource_slug_key" ON "LearningResource"("slug");

-- CreateIndex
CREATE INDEX "ResourceProgress_userId_rev_idx" ON "ResourceProgress"("userId", "rev");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceProgress_userId_resourceId_key" ON "ResourceProgress"("userId", "resourceId");

-- CreateIndex
CREATE INDEX "GamificationEvent_userId_rev_idx" ON "GamificationEvent"("userId", "rev");

-- CreateIndex
CREATE INDEX "GamificationEvent_userId_localDate_idx" ON "GamificationEvent"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "GamificationEvent_userId_dedupeKey_key" ON "GamificationEvent"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_rev_idx" ON "UserAchievement"("userId", "rev");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "SyncOperation_userId_createdAt_idx" ON "SyncOperation"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeletionMarker_userId_entity_entityId_key" ON "DeletionMarker"("userId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "SyncConflict_userId_rev_idx" ON "SyncConflict"("userId", "rev");

-- CreateIndex
CREATE INDEX "SyncConflict_userId_status_idx" ON "SyncConflict"("userId", "status");

-- CreateIndex
CREATE INDEX "AiUsage_userId_createdAt_idx" ON "AiUsage"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayOverride" ADD CONSTRAINT "DayOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledSession" ADD CONSTRAINT "ScheduledSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledSession" ADD CONSTRAINT "ScheduledSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanRevision" ADD CONSTRAINT "PlanRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusLog" ADD CONSTRAINT "FocusLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryProposal" ADD CONSTRAINT "RecoveryProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReflection" ADD CONSTRAINT "WeeklyReflection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalGoal" ADD CONSTRAINT "PersonalGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalCheckin" ADD CONSTRAINT "GoalCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalCheckin" ADD CONSTRAINT "GoalCheckin_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "PersonalGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceProgress" ADD CONSTRAINT "ResourceProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceProgress" ADD CONSTRAINT "ResourceProgress_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "LearningResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamificationEvent" ADD CONSTRAINT "GamificationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncOperation" ADD CONSTRAINT "SyncOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletionMarker" ADD CONSTRAINT "DeletionMarker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncConflict" ADD CONSTRAINT "SyncConflict_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain constraints the application also validates, enforced again by the database.
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "availability_weekday_range" CHECK ("weekday" BETWEEN 0 AND 6);
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "availability_times" CHECK ("start" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "end" ~ '^[0-2][0-9]:[0-5][0-9]$');
ALTER TABLE "Task" ADD CONSTRAINT "task_importance_range" CHECK ("importance" BETWEEN 1 AND 4);
ALTER TABLE "Task" ADD CONSTRAINT "task_minutes_nonnegative" CHECK ("estimatedMinutes" > 0 AND "remainingMinutes" >= 0);
ALTER TABLE "ScheduledSession" ADD CONSTRAINT "session_time_order" CHECK ("endAt" > "startAt" AND "minutes" > 0);
ALTER TABLE "FocusLog" ADD CONSTRAINT "focus_minutes_nonnegative" CHECK ("focusMinutes" >= 0 AND "endedAt" >= "startedAt");
ALTER TABLE "GamificationEvent" ADD CONSTRAINT "event_xp_range" CHECK ("xp" BETWEEN 0 AND 500);
ALTER TABLE "PlanRevision" ADD CONSTRAINT "plan_revision_positive" CHECK ("number" >= 1);
ALTER TABLE "User" ADD CONSTRAINT "user_email_lowercase" CHECK ("email" = lower("email"));
