-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "githubId" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "maxMembers" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_invites" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "repoUrl" TEXT,
    "repoBranch" TEXT DEFAULT 'main',
    "thumbnail" TEXT,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "color" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "replicas" INTEGER,
    "rateLimit" INTEGER,
    "timeoutMs" INTEGER,
    "metricsHistory" JSONB,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edges" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "connectionType" TEXT NOT NULL DEFAULT 'http',
    "animated" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "maxRps" INTEGER,
    "timeoutMs" INTEGER,
    "config" JSONB,

    CONSTRAINT "edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulations" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trafficPattern" TEXT NOT NULL DEFAULT 'steady',
    "rps" INTEGER NOT NULL DEFAULT 100,
    "duration" INTEGER NOT NULL DEFAULT 300,
    "scenario" TEXT,
    "metrics" JSONB,
    "globalMetrics" JSONB,
    "currentRps" INTEGER,
    "logs" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "monteCarloPasses" INTEGER NOT NULL DEFAULT 1,
    "confidenceLevel" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "growthScenario" TEXT,
    "generateReport" BOOLEAN NOT NULL DEFAULT true,
    "deterministicSeed" INTEGER NOT NULL DEFAULT 0,
    "engineVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "reportVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "inputSnapshot" JSONB,
    "assumptions" JSONB,
    "validationResult" JSONB,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualDurationMs" INTEGER,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "totalSimulatedCost" DOUBLE PRECISION DEFAULT 0,
    "projectedMonthlyCost" DOUBLE PRECISION DEFAULT 0,
    "projectedAnnualCost" DOUBLE PRECISION DEFAULT 0,

    CONSTRAINT "simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_reports" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "overallScore" INTEGER NOT NULL,
    "architectureScore" INTEGER,
    "reliabilityScore" INTEGER,
    "performanceScore" INTEGER,
    "costScore" INTEGER,
    "securityScore" INTEGER,
    "scalabilityScore" INTEGER,
    "confidenceScore" INTEGER,
    "executiveSummary" JSONB NOT NULL,
    "topologyAnalysis" JSONB NOT NULL,
    "performanceAnalysis" JSONB NOT NULL,
    "reliabilityAnalysis" JSONB NOT NULL,
    "scalabilityAnalysis" JSONB NOT NULL,
    "costAnalysis" JSONB,
    "securityAnalysis" JSONB,
    "failureScenarios" JSONB NOT NULL,
    "aiInsights" JSONB,
    "actionPlan" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "designId" TEXT,
    "simulationId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "optimization_history" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "simulationId" TEXT,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'applying',
    "changes" JSONB,
    "error" TEXT,
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "optimization_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "teams_ownerId_idx" ON "teams"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_userId_key" ON "team_members"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "team_invites_token_key" ON "team_invites"("token");

-- CreateIndex
CREATE INDEX "team_invites_team_id_idx" ON "team_invites"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_invites_team_id_email_key" ON "team_invites"("team_id", "email");

-- CreateIndex
CREATE INDEX "designs_ownerId_idx" ON "designs"("ownerId");

-- CreateIndex
CREATE INDEX "designs_ownerId_updatedAt_idx" ON "designs"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "designs_teamId_idx" ON "designs"("teamId");

-- CreateIndex
CREATE INDEX "blocks_designId_type_idx" ON "blocks"("designId", "type");

-- CreateIndex
CREATE INDEX "blocks_designId_replicas_idx" ON "blocks"("designId", "replicas");

-- CreateIndex
CREATE INDEX "edges_designId_connectionType_idx" ON "edges"("designId", "connectionType");

-- CreateIndex
CREATE INDEX "simulations_designId_idx" ON "simulations"("designId");

-- CreateIndex
CREATE INDEX "simulations_userId_idx" ON "simulations"("userId");

-- CreateIndex
CREATE INDEX "simulations_status_idx" ON "simulations"("status");

-- CreateIndex
CREATE INDEX "simulations_createdAt_idx" ON "simulations"("createdAt");

-- CreateIndex
CREATE INDEX "simulations_designId_status_idx" ON "simulations"("designId", "status");

-- CreateIndex
CREATE INDEX "simulations_designId_createdAt_idx" ON "simulations"("designId", "createdAt");

-- CreateIndex
CREATE INDEX "simulations_projectedMonthlyCost_idx" ON "simulations"("projectedMonthlyCost");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_reports_simulationId_key" ON "simulation_reports"("simulationId");

-- CreateIndex
CREATE INDEX "simulation_reports_designId_idx" ON "simulation_reports"("designId");

-- CreateIndex
CREATE INDEX "simulation_reports_userId_idx" ON "simulation_reports"("userId");

-- CreateIndex
CREATE INDEX "simulation_reports_generatedAt_idx" ON "simulation_reports"("generatedAt");

-- CreateIndex
CREATE INDEX "simulation_reports_designId_generatedAt_idx" ON "simulation_reports"("designId", "generatedAt");

-- CreateIndex
CREATE INDEX "audit_logs_simulationId_idx" ON "audit_logs"("simulationId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_designId_idx" ON "audit_logs"("designId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_simulationId_createdAt_idx" ON "audit_logs"("simulationId", "createdAt");

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designs" ADD CONSTRAINT "designs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designs" ADD CONSTRAINT "designs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edges" ADD CONSTRAINT "edges_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edges" ADD CONSTRAINT "edges_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edges" ADD CONSTRAINT "edges_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_reports" ADD CONSTRAINT "simulation_reports_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_reports" ADD CONSTRAINT "simulation_reports_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_reports" ADD CONSTRAINT "simulation_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "simulations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
