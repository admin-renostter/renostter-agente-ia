// Use the correct path where Prisma Client is generated
const { PrismaClient } = require('./src/generated/prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Conectando ao banco...');
  await prisma.$connect();
  
  console.log('🗑️  Apagando mensagens com referência a imagens...');
  const result = await prisma.message.deleteMany({
    where: {
      OR: [
        { content: { contains: 'image' } },
        { content: { contains: '.png' } },
        { content: { contains: '.jpg' } },
        { content: { contains: 'data:image' } }
      ]
    }
  });
  
  console.log(`✅ ${result.count} mensagens apagadas`);
  
  console.log('🧹 Limpando resumos...');
  await prisma.conversation.updateMany({
    data: { summary: null }
  });
  
  await prisma.$disconnect();
  console.log('✅ Concluído!');
}

main().catch(e => {
  console.error('❌ Erro:', e.message);
  process.exit(1);
});
