import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Crea un cliente con el organization_id seteado en session para que
 * las RLS policies de PostgreSQL filtren automáticamente por tenant.
 */
export async function getPrismaForOrg(organizationId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, TRUE)`,
            query(args) as never,
          ]);
          return result;
        },
      },
    },
  });
}
