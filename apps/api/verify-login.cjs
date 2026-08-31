const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const prisma = new PrismaClient();

(async () => {
  const user = await prisma.user.findUnique({ where: { email: 'admin@gmail.com' } });
  if (!user) { console.log('FAIL: admin user not found'); return; }
  const ok = await argon2.verify(user.passwordHash, 'admin123');
  console.log('admin found:', user.email, '| hashtype:', user.passwordHash.slice(0, 11));
  console.log('password admin123 verifies:', ok);
  const org = await prisma.userOrganization.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  });
  console.log('role:', org?.role, '| org:', org?.organization?.name, '| slug:', org?.organization?.slug);
  await prisma.$disconnect();
})().catch(async (e) => { console.error('ERR', e.message); process.exit(1); });
