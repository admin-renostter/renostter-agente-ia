import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.agentSession.findFirst({ where: { active: true } });
  if (existing) {
    console.log("AgentSession já existe, pulando seed.");
    return;
  }
  await prisma.agentSession.create({
    data: {
      name: "Default SDR",
      systemPrompt:
        "Você é um assistente de pré-vendas da Renostter. Seu objetivo é qualificar leads: entender a necessidade, coletar nome, empresa e cargo, e propor o próximo passo (demo ou reunião). Seja conciso, profissional e amigável. Responda sempre em Português (BR).",
      model: "gemini-2.5-flash",
      temperature: 0.7,
      debounceMs: 5000,
      active: true,
    },
  });
  console.log("AgentSession Default SDR criado.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
