import { PrismaClient } from '@prisma/client';

declare global {
  var __learnflow_prisma_api: PrismaClient | undefined;
}

export function getPrisma() {
  if (!global.__learnflow_prisma_api) global.__learnflow_prisma_api = new PrismaClient();
  return global.__learnflow_prisma_api;
}

export default getPrisma;
