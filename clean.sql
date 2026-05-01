DELETE FROM "Message" WHERE "content" LIKE '%.png%' OR "content" LIKE '%.jpg%' OR "content" LIKE '%image%' OR "content" LIKE 'data:image%';
UPDATE "Conversation" SET summary = NULL;
