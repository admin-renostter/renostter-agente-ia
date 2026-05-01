const { PrismaClient } = require('./src/generated/prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking for image.png in database...\n');

  // Check AgentSession systemPrompt
  const agents = await prisma.agentSession.findMany();
  console.log('=== AGENT SESSIONS ===');
  for (const agent of agents) {
    const hasPng = (agent.systemPrompt || '').toLowerCase().includes('image.png');
    console.log(`Agent: ${agent.name}`);
    console.log(`  Has "image.png": ${hasPng}`);
    if (hasPng) {
      console.log(`  BEFORE: ${agent.systemPrompt.substring(0, 200)}`);
      // Clean it
      const cleaned = (agent.systemPrompt || '')
        .replace(/image\.png/gi, '[IMG]')
        .replace(/"image\.\w+"/gi, '[IMG]')
        .replace(/'image\.\w+'/gi, '[IMG]');
      await prisma.agentSession.update({
        where: { id: agent.id },
        data: { systemPrompt: cleaned }
      });
      console.log(`  AFTER: ${cleaned.substring(0, 200)}`);
      console.log(`  ✅ CLEANED!`);
    }
  }

  // Check Conversation summary
  const convs = await prisma.conversation.findMany({
    where: { summary: { not: null } }
  });
  console.log('\n=== CONVERSATIONS WITH SUMMARY ===');
  for (const conv of convs) {
    const hasPng = (conv.summary || '').toLowerCase().includes('image.png');
    if (hasPng) {
      console.log(`Conversation: ${conv.id}`);
      console.log(`  BEFORE: ${conv.summary.substring(0, 200)}`);
      const cleaned = (conv.summary || '')
        .replace(/image\.png/gi, '[IMG]')
        .replace(/"image\.\w+"/gi, '[IMG]');
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { summary: cleaned }
      });
      console.log(`  ✅ CLEANED!`);
    }
  }

  // Check Messages
  const msgs = await prisma.message.findMany({
    where: {
      OR: [
        { content: { contains: 'image.png' } },
        { content: { contains: '"image' } },
        { content: { contains: "'image" } }
      ]
    }
  });
  console.log(`\n=== MESSAGES WITH IMAGE REFS: ${msgs.length} ===`);
  if (msgs.length > 0) {
    const result = await prisma.message.deleteMany({
      where: {
        OR: [
          { content: { contains: 'image.png' } },
          { content: { contains: '"image' } },
          { content: { contains: "'image" } }
        ]
      }
    });
    console.log(`✅ Deleted ${result.count} messages`);
  }

  await prisma.$disconnect();
  console.log('\n✅ Database cleanup complete!');
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
