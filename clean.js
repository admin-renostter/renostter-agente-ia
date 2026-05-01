
@"
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.`\$connect`();
  console.log('Conectado! Limpando...');
  
  // Apaga mensagens com possível referência a imagem
  const r = await prisma.message.deleteMany({
    where: {
      OR: [
        { content: { contains: 'image' } },
        { content: { contains: '.png' } },
        { content: { contains: '.jpg' } },
        { content: { contains: 'data:image' } }
      ]
    }
  });
  
  console.log('Mensagens apagadas:', r.count);
  
  // Limpa resumos também
  await prisma.conversation.updateMany({
    data: { summary: null }
  });
  
  await prisma.`\$disconnect`();
  console.log('Concluído!');
}

main().catch(e => { console.error(e); process.exit(1); });
"@ | Out-File -FilePath "clean.js" -Encoding UTF8