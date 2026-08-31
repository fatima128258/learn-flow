import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tables = [
  'AuditLog','Category','Certificate','Course','CourseProgress',
  'EmailVerificationToken','Enrollment','Lesson','LessonProgress','Media',
  'Module','Notification','Order','OrderItem','Organization',
  'PasswordResetToken','Payment','Question','Quiz','QuizAttempt',
  'QuizOption','Session','User','UserOrganization',
];

const sql = `TRUNCATE TABLE ${tables.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`;
console.log('Executing:', sql);
await prisma.$executeRawUnsafe(sql);
console.log('TRUNCATE complete — all application data removed.');
await prisma.$disconnect();