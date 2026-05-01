const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 LIMPEZA NUCLEAR - Removendo TUDO que pode causar "image.png"\n');

  // 1. Limpar systemPrompt de TODOS os agentes
  console.log('=== 1. Limpando systemPrompts ===');
  const agents = await prisma.agentSession.findMany();
  
  for (const agent of agents) {
    if (!agent.systemPrompt) continue;
    
    const original = agent.systemPrompt;
    let cleaned = original;
    
    // Remover QUALQUER referencia a imagem
    cleaned = cleaned.replace(/image\.png/gi, ' ');
    cleaned = cleaned.replace(/"image\.\w+"/gi, ' ');
    cleaned = cleaned.replace(/'image\.\w+'/gi, ' ');
    cleaned = cleaned.replace(/\bimage\b/gi, ' ');
    cleaned = cleaned.replace(/\bpng\b/gi, ' ');
    cleaned = cleaned.replace(/\.png/gi, ' ');
    
    if (cleaned !== original) {
      await prisma.agentSession.update({
        where: { id: agent.id },
        data: { systemPrompt: cleaned }
      });
      console.log(`✅ Agent "${agent.name}" limpo!`);
      console.log(`   ANTES: ${original.substring(0, 100)}`);
      console.log(`   DEPOIS: ${cleaned.substring(0, 100)}`);
    } else {
      console.log(`✓ Agent "${agent.name}" já limpo`);
    }
  }

  // 2. Limpar summaries de TODAS as conversas
  console.log('\n=== 2. Limpando summaries ===');
  const convs = await prisma.conversation.findMany({
    where: { summary: { not: null } }
  });
  
  let summaryCount = 0;
  for (const conv of convs) {
    if (!conv.summary) continue;
    
    const original = conv.summary;
    let cleaned = original;
    
    cleaned = cleaned.replace(/image\.png/gi, ' ');
    cleaned = cleaned.replace(/"image\.\w+"/gi, ' ');
    cleaned = cleaned.replace(/\bimage\b/gi, ' ');
    
    if (cleaned !== original) {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { summary: cleaned }
      });
      summaryCount++;
      console.log(`✅ Conversation ${conv.id.substring(0, 8)}... limpa!`);
    }
  }
  console.log(`✅ ${summaryCount} summaries limpos`);

  // 3. Deletar TODAS as mensagens com referencia a imagem
  console.log('\n=== 3. Deletando mensagens com imagem ===');
  const deleteResult = await prisma.message.deleteMany({
    where: {
      OR: [
        { content: { contains: 'image' } },
        { content: { contains: '.png' } },
        { content: { contains: '.jpg' } },
        { content: { contains: 'png"' } },
        { content: { contains: "png'" } },
        { content: { contains: 'data:image' } }
      ]
    }
  });
  console.log(`✅ ${deleteResult.count} mensagens deletadas`);

  // 4. Verificação FINAL
  console.log('\n=== 4. Verificação FINAL ===');
  const remaining = await prisma.message.findMany({
    where: {
      OR: [
        { content: { contains: 'image' } },
        { content: { contains: '.png' } }
      ]
    },
    take: 5
  });
  
  if (remaining.length > 0) {
    console.log('⚠️ AINDA EXISTEM mensagens com imagem:');
    remaining.forEach(m => {
      console.log(`  ID: ${m.id}, Preview: ${m.content.substring(0, 50)}`);
    });
  } else {
    console.log('✅ Nenhuma mensagem com "image" ou ".png" encontrada!');
  }

  await prisma.$disconnect();
  console.log('\n✅ LIMPEZA NUCLEAR CONCLUÍDA!');
}

main().catch(e => {
  console.error('❌ Erro:', e.message);
  process.exit(1);
});