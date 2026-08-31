const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const inv = await prisma.inventory.findFirst();
  if (inv) {
    const updated = await prisma.inventory.updateMany({
      where: {
        id: inv.id,
        availableQuantity: { gte: 1 }
      },
      data: {
        availableQuantity: { decrement: 1 }
      }
    });
    console.log("Updated count:", updated.count);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
