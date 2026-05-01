-- apply-indexes.sql
-- Run this directly in Railway → your PostgreSQL service → Data → Query tab
-- (or via psql: psql $DATABASE_URL -f apply-indexes.sql)
-- Safe to run multiple times: CREATE INDEX IF NOT EXISTS

CREATE INDEX IF NOT EXISTS "ContactIdentity_contactId_idx"       ON "ContactIdentity"("contactId");
CREATE INDEX IF NOT EXISTS "Conversation_updatedAt_idx"           ON "Conversation"("updatedAt");
CREATE INDEX IF NOT EXISTS "Conversation_contactId_idx"           ON "Conversation"("contactId");
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "DocumentChunk_documentId_idx"         ON "DocumentChunk"("documentId");
CREATE INDEX IF NOT EXISTS "RetryQueue_conversationId_idx"        ON "RetryQueue"("conversationId");
CREATE INDEX IF NOT EXISTS "RetryQueue_nextRetryAt_idx"           ON "RetryQueue"("nextRetryAt");

-- Register the migration in Prisma's _prisma_migrations table so migrate status stays clean
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
  gen_random_uuid()::text,
  'manual',
  now(),
  '20260501000000_add_indexes',
  NULL,
  NULL,
  now(),
  1
) ON CONFLICT DO NOTHING;
