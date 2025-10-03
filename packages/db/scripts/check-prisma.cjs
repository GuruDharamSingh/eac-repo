const { prisma } = require('../dist/index.js');

async function main() {
  const result = await prisma.$queryRaw`SELECT 1 as ok`;
  console.log('Prisma connection check:', result);
}

main()
  .catch(error => {
    console.error('Prisma connection failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
