-- Resonance AI Chat — Phase 0/1 foundation (spec §21, §23-27)
-- Adds chat_sessions, chat_messages, chat_requests, generations
-- and the version column on designs (context-correctness mechanism).

-- ----------------------------------------------------------------------------
-- Design versioning (spec §21)
-- ----------------------------------------------------------------------------
ALTER TABLE "designs" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- ----------------------------------------------------------------------------
-- chat_sessions (spec §23)
-- ----------------------------------------------------------------------------
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "designId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_sessions_userId_updatedAt_idx" ON "chat_sessions"("userId", "updatedAt" DESC);
CREATE INDEX "chat_sessions_userId_status_updatedAt_idx" ON "chat_sessions"("userId", "status", "updatedAt" DESC);
CREATE INDEX "chat_sessions_designId_idx" ON "chat_sessions"("designId");
CREATE INDEX "chat_sessions_status_userId_idx" ON "chat_sessions"("status", "userId");

ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- chat_messages (spec §24) — (sessionId, sequence) is the ordering invariant
-- ----------------------------------------------------------------------------
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "requestId" TEXT,
    "idempotencyKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_messages_sessionId_sequence_key" ON "chat_messages"("sessionId", "sequence");
CREATE INDEX "chat_messages_sessionId_createdAt_idx" ON "chat_messages"("sessionId", "createdAt");
CREATE INDEX "chat_messages_requestId_idx" ON "chat_messages"("requestId");

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- chat_requests (spec §25) — idempotent, durable AI operation state
-- ----------------------------------------------------------------------------
CREATE TABLE "chat_requests" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "messageId" TEXT,
    "responseId" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_requests_userId_idempotencyKey_key" ON "chat_requests"("userId", "idempotencyKey");
CREATE INDEX "chat_requests_sessionId_status_idx" ON "chat_requests"("sessionId", "status");

ALTER TABLE "chat_requests" ADD CONSTRAINT "chat_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_requests" ADD CONSTRAINT "chat_requests_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- generations (spec §26)
-- ----------------------------------------------------------------------------
CREATE TABLE "generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "designId" TEXT,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestKey" TEXT,
    "designVersion" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "generations_userId_createdAt_idx" ON "generations"("userId", "createdAt");
CREATE INDEX "generations_sessionId_idx" ON "generations"("sessionId");
CREATE INDEX "generations_status_idx" ON "generations"("status");

ALTER TABLE "generations" ADD CONSTRAINT "generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generations" ADD CONSTRAINT "generations_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "generations" ADD CONSTRAINT "generations_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
