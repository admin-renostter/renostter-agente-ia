// Run: node clean-prompt.js
// Cleans contaminated messages, summaries, and system prompts with image references.
const { PrismaClient } = require("./src/generated/prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Iniciando limpeza do banco...\n");

  // 1. Delete messages containing image references
  const msgResult = await prisma.message.deleteMany({
    where: {
      OR: [
        { content: { contains: "image" } },
        { content: { contains: ".png" } },
        { content: { contains: ".jpg" } },
        { content: { contains: ".jpeg" } },
        { content: { contains: ".gif" } },
        { content: { contains: ".webp" } },
        { content: { contains: "data:image" } },
      ],
    },
  });
  console.log(`✅ ${msgResult.count} mensagem(ns) apagada(s)`);

  // 2. Clear summaries with image references
  const convResult = await prisma.conversation.updateMany({
    where: {
      OR: [
        { summary: { contains: "image" } },
        { summary: { contains: ".png" } },
        { summary: { contains: ".jpg" } },
        { summary: { contains: "data:image" } },
      ],
    },
    data: { summary: null },
  });
  console.log(`✅ ${convResult.count} summary(ies) limpo(s)`);

  // 3. Clean systemPrompts in AgentSession
  const agents = await prisma.agentSession.findMany();
  let agentsCleaned = 0;

  for (const agent of agents) {
    const cleaned = agent.systemPrompt
      .replace(/data:image\/[^;]+;base64[^"'\s]*/gi, "")
      .replace(/https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp)([^\s]*)?/gi, "")
      .replace(/\bimage\.\w{3,4}\b/gi, "")
      .replace(/\bimage\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (cleaned !== agent.systemPrompt) {
      await prisma.agentSession.update({
        where: { id: agent.id },
        data: { systemPrompt: cleaned },
      });
      console.log(`✅ AgentSession "${agent.name}" limpo`);
      agentsCleaned++;
    }
  }

  if (agentsCleaned === 0) console.log("✅ Nenhum AgentSession com contaminação");

  console.log("\n✅ Limpeza concluída!");
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
