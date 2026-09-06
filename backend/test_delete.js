const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  
  try {
    const id = '9b9d4e39-bced-4cd6-8f12-61681333d456';
    await prisma.$transaction([
      prisma.productVariant.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ]);
    console.log('Deleted successfully');
  } catch (e) {
    console.error('Delete failed:', e.message);
  } finally {
  }
  await prisma.$disconnect();
}
main();
