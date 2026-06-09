import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://spoke:harness_dev@localhost:5432/spoke_dev';

export const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
export * from '@prisma/client';
