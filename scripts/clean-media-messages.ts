// Script to clean up messages that might have media references
// Run with: npx tsx scripts/clean-media-messages.ts

import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

// Load .env file
config({ path: "../.env" });
config({ path: "./.env" });
config({ path: "../.env.local" });
config({ path: "./.env.local" });

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Cleaning up messages with media references...");

  // Try to connect to database
  try {
    await prisma.$connect();
    console.log("✅ Database connected");
  } catch (e) {
    console.error("❌ Database connection failed. Make sure DATABASE_URL is set in .env");
    console.error("   You can also run: $env:DATABASE_URL = 'your-url-here'");
    process.exit(1);
  }

  // Delete messages that might have media references
  const deleteResult = await prisma.message.deleteMany({
    where: {
      OR: [
        { mediaUrl: { not: null } },
        { mediaUrl: { not: "" } },
        { content: { contains: ".png" } },
        { content: { contains: ".jpg" } },
        { content: { contains: "image" } },
        { content: { contains: "data:image" } },
      ],
    },
  });

  console.log(`✅ Deleted ${deleteResult.count} messages with potential media references`);

  // Also delete messages where content is suspicious (very long, might be base64)
  const allMessages = await prisma.message.findMany();
  let suspiciousCount = 0;
  for (const msg of allMessages) {
    // Check if content looks like it might contain image data
    if (msg.content && msg.content.length > 10000) {
      await prisma.message.delete({ where: { id: msg.id } });
      suspiciousCount++;
    }
  }

  if (suspiciousCount > 0) {
    console.log(`✅ Deleted ${suspiciousCount} suspicious messages (very long content)`);
  }

  await prisma.$disconnect();
  console.log("✅ Done! Database cleaned.");
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
