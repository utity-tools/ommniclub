import { auth } from "@clerk/nextjs/server";
import { prisma, getPrismaForOrg } from "./prisma";

export type AuthContext = {
  userId: string;
  organizationId: string;
  orgSlug: string | null;
  role: string | null;
};

export async function requireAuth(): Promise<AuthContext> {
  const { userId, orgId, orgSlug, orgRole } = await auth();

  if (!userId) throw new Error("UNAUTHENTICATED");

  const clerkOrgId = orgId ?? process.env.DEV_ORG_CLERK_ID;
  if (!clerkOrgId) throw new Error("NO_ORGANIZATION");

  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true, slug: true },
  });
  if (!org) throw new Error("ORGANIZATION_NOT_FOUND");

  return {
    userId,
    organizationId: org.id,
    orgSlug: orgSlug ?? org.slug,
    role: orgRole ?? null,
  };
}

export async function getOrgDb() {
  const { organizationId } = await requireAuth();
  return getPrismaForOrg(organizationId);
}

export async function syncOrganization(clerkOrgId: string, name: string, slug: string) {
  return prisma.organization.upsert({
    where: { clerkOrgId },
    update: { name, slug },
    create: { clerkOrgId, name, slug },
  });
}
