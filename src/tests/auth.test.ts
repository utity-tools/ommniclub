import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { requireAuth, syncOrganization } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockPrismaOrg = vi.mocked(prisma.organization);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAuth", () => {
  it("lanza UNAUTHENTICATED si no hay userId", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null, orgId: null } as never);
    await expect(requireAuth()).rejects.toThrow("UNAUTHENTICATED");
  });

  it("lanza NO_ORGANIZATION si no hay orgId", async () => {
    mockAuth.mockResolvedValueOnce({ userId: "user_1", orgId: null } as never);
    await expect(requireAuth()).rejects.toThrow("NO_ORGANIZATION");
  });

  it("retorna AuthContext completo cuando está autenticado", async () => {
    mockAuth.mockResolvedValueOnce({
      userId: "user_1",
      orgId: "org_abc",
      orgSlug: "my-club",
      orgRole: "org:admin",
    } as never);

    const ctx = await requireAuth();

    expect(ctx).toEqual({
      userId: "user_1",
      organizationId: "org_abc",
      orgSlug: "my-club",
      role: "org:admin",
    });
  });
});

describe("syncOrganization", () => {
  it("llama a prisma.organization.upsert con los datos correctos", async () => {
    const mockOrg = { id: "1", clerkOrgId: "org_abc", name: "Test Club", slug: "test-club" };
    mockPrismaOrg.upsert.mockResolvedValueOnce(mockOrg as never);

    const result = await syncOrganization("org_abc", "Test Club", "test-club");

    expect(mockPrismaOrg.upsert).toHaveBeenCalledWith({
      where: { clerkOrgId: "org_abc" },
      update: { name: "Test Club", slug: "test-club" },
      create: { clerkOrgId: "org_abc", name: "Test Club", slug: "test-club" },
    });
    expect(result).toEqual(mockOrg);
  });
});
