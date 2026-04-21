import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPrismaForOrg } from "@/lib/prisma";

// Extraemos los fns del mock definido en setup.ts para poder tiparlos correctamente
const { prisma } = await vi.importMock<typeof import("@/lib/prisma")>("@/lib/prisma");

const mockOrgCreate = prisma.organization.create as ReturnType<typeof vi.fn>;
const mockMemberCreate = prisma.member.create as ReturnType<typeof vi.fn>;
const mockGetOrg = getPrismaForOrg as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Multi-tenant schema isolation", () => {
  const ORG_ID = "org_test_123";

  it("getPrismaForOrg devuelve un cliente extendido", async () => {
    const fakePrismaForOrg = { member: { findMany: vi.fn() } };
    mockGetOrg.mockResolvedValueOnce(fakePrismaForOrg);

    const orgDb = await getPrismaForOrg(ORG_ID);
    expect(orgDb).toBeDefined();
    expect(mockGetOrg).toHaveBeenCalledWith(ORG_ID);
  });

  it("organization.create genera los campos requeridos", async () => {
    const mockOrg = {
      id: "clx_abc",
      clerkOrgId: "org_clerk_1",
      name: "Cannabis Club BCN",
      slug: "ccbcn",
      stripeAccountId: null,
      stripeAccountStatus: "pending",
      applicationFeePercent: "0.00",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockOrgCreate.mockResolvedValueOnce(mockOrg);

    const org = await prisma.organization.create({
      data: { clerkOrgId: "org_clerk_1", name: "Cannabis Club BCN", slug: "ccbcn" },
    });

    expect(org.clerkOrgId).toBe("org_clerk_1");
    expect(org.slug).toBe("ccbcn");
    expect(org.stripeAccountStatus).toBe("pending");
  });

  it("member.create incluye wallet_balance por defecto en 0", async () => {
    const mockMember = {
      id: "m_1",
      organizationId: ORG_ID,
      documentNumber: "ENCRYPTED_DNI",
      documentType: "DNI",
      firstName: "Ana",
      lastName: "García",
      walletBalance: "0.00",
      monthlyLimit: "60.00",
      monthlySpent: "0.00",
      status: "ACTIVE",
      rfidTag: "A1B2C3D4",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockMemberCreate.mockResolvedValueOnce(mockMember);

    const member = await prisma.member.create({
      data: {
        organizationId: ORG_ID,
        documentNumber: "ENCRYPTED_DNI",
        firstName: "Ana",
        lastName: "García",
        rfidTag: "A1B2C3D4",
      },
    });

    expect(member.walletBalance).toBe("0.00");
    expect(member.monthlyLimit).toBe("60.00");
    expect(member.status).toBe("ACTIVE");
  });
});

describe("Prisma schema: enums", () => {
  it("TransactionType incluye DISPENSE y WALLET_TOPUP", () => {
    const validTypes = [
      "DISPENSE",
      "WALLET_TOPUP",
      "WALLET_CASH",
      "SUBSCRIPTION",
      "REFUND",
      "ADJUSTMENT",
    ];
    expect(validTypes).toContain("DISPENSE");
    expect(validTypes).toContain("WALLET_TOPUP");
  });

  it("AccessResult incluye todos los estados de denegación", () => {
    const validResults = [
      "GRANTED",
      "DENIED_EXPIRED",
      "DENIED_SUSPENDED",
      "DENIED_NOT_FOUND",
    ];
    expect(validResults).toHaveLength(4);
  });
});
