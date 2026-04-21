import { auth } from "@clerk/nextjs/server";
import { prisma, getPrismaForOrg } from "./prisma";

export type AuthContext = {
  userId: string;
  organizationId: string;
  orgSlug: string | null;
  role: string | null;
};

/**
 * Obtiene el contexto de auth desde Clerk y valida que el usuario
 * pertenezca a una organización activa. Lanza si no está autenticado.
 */
export async function requireAuth(): Promise<AuthContext> {
  const { userId, orgId, orgSlug, orgRole } = await auth();

  if (!userId) throw new Error("UNAUTHENTICATED");
  if (!orgId) throw new Error("NO_ORGANIZATION");

  return {
    userId,
    organizationId: orgId,
    orgSlug: orgSlug ?? null,
    role: orgRole ?? null,
  };
}

/**
 * Devuelve un cliente Prisma con RLS configurado para el org del usuario actual.
 * Usar en Server Actions y Route Handlers.
 */
export async function getOrgDb() {
  const { organizationId } = await requireAuth();
  return getPrismaForOrg(organizationId);
}

/**
 * Asegura que la Organization existe en nuestra DB, sincronizando desde Clerk.
 * Se llama en el webhook de Clerk `organization.created`.
 */
export async function syncOrganization(clerkOrgId: string, name: string, slug: string) {
  return prisma.organization.upsert({
    where: { clerkOrgId },
    update: { name, slug },
    create: { clerkOrgId, name, slug },
  });
}
