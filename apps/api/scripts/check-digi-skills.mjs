import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: 'digi skills' },
    include: { 
      users: {
        select: { 
          id: true, 
          role: true, 
          user: { select: { name: true, email: true } }
        }
      }
    }
  });
  
  if (!org) {
    console.log('Organization "digi skills" not found');
    return;
  }
  
  console.log(`Organization: ${org.name}`);
  console.log(`Total members in DB: ${org.users.length}`);
  console.log(`Slug: ${org.slug}`);
  console.log(`\nMembers:`);
  org.users.forEach(u => {
    console.log(`  - ${u.user.name} (${u.user.email}) - Role: ${u.role}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
