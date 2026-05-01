-- Clean up messages that might have image references
-- Run with: npx prisma db execute --file ./clean-messages.sql

DELETE FROM "Message"
WHERE "mediaUrl" IS NOT NULL
   OR "content" LIKE '%.png%'
   OR "content" LIKE '%.jpg%'
   OR "content" LIKE '%image%'
   OR "content" LIKE 'data:image%';

-- Also clear summaries that might reference images
UPDATE "Conversation" SET summary = NULL WHERE summary LIKE '%.png%' OR summary LIKE '%image%';
