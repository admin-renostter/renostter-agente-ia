const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  console.log('🔍 Checking database for image.png references...\n');

  // Check AgentSession (systemPrompt)
  const agents = await prisma.agentSession.findMany();
  console.log('=== AGENT SESSIONS ===');
  for (const agent of agents) {
    const hasImage = (agent.systemPrompt || '').toLowerCase().includes('image.png');
    console.log(`Agent: ${agent.name}`);
    console.log(`  has image.png: ${hasImage}`);
    if (hasImage) {
      console.log(`  systemPrompt preview: ${agent.systemPrompt.substring(0, 200)}`);
    }
  }

  // Check Conversations (summary)
  const convs = await prisma.conversation.findMany({
    where: { summary: { not: null } }
  });
  console.log('\n=== CONVERSATIONS WITH SUMMARY ===');
  for (const conv of convs) {
    const hasImage = (conv.summary || '').toLowerCase().includes('image.png');
    if (hasImage) {
      console.log(`Conversation: ${conv.id}`);
      console.log(`  has image.png in summary: YES`);
      console.log(`  summary preview: ${conv.summary.substring(0, 200)}`);
    }
  }

  // Check Messages
  const msgs = await prisma.message.findMany({
    where: {
      OR: [
        { content: { contains: 'image.png' } },
        { content: { contains: '"image.png"' } },
        { content: { contains: "'image.png'" } }
      ]
    }
  });
  console.log('\n=== MESSAGES WITH IMAGE.PNG ===');
  console.log(`Found: ${msgs.length} messages`);
  for (const msg of msgs.slice(0, 5)) {
    console.log(`  Msg ID: ${msg.id}, Role: ${msg.role}`);
    console.log(`  Content preview: ${msg.content.substring(0, 100)}`);
  }

  await prisma.$disconnect();
  console.log('\n✅ Check complete!');
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
