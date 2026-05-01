-- CreateIndex: ContactIdentity.contactId (lookup by contact)
CREATE INDEX "ContactIdentity_contactId_idx" ON "ContactIdentity"("contactId");

-- CreateIndex: Conversation.updatedAt (list/sort by recency)
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");

-- CreateIndex: Conversation.contactId (lookup conversations per contact)
CREATE INDEX "Conversation_contactId_idx" ON "Conversation"("contactId");

-- CreateIndex: Message(conversationId, createdAt) (rolling history window)
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex: DocumentChunk.documentId (cascade delete + chunk lookups)
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");

-- CreateIndex: RetryQueue.conversationId (find retries per conversation)
CREATE INDEX "RetryQueue_conversationId_idx" ON "RetryQueue"("conversationId");

-- CreateIndex: RetryQueue.nextRetryAt (poll for due retries)
CREATE INDEX "RetryQueue_nextRetryAt_idx" ON "RetryQueue"("nextRetryAt");
