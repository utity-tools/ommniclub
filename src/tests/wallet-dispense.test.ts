import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma, TransactionType, MemberStatus } from "@prisma/client";

const { Decimal } = Prisma;

// ─── MOCKS ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    organizationId: "org_test001",
    userId: "user_staff01",
    orgSlug: null,
    role: null,
  }),
}));

const mockTx = {
  member: { findUnique: vi.fn(), update: vi.fn() },
  product: { findUnique: vi.fn(), update: vi.fn() },
  transaction: { create: vi.fn(), aggregate: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  },
}));

const { processDispensation, DispensationError } = await import("@/lib/wallet/actions");

// ─── FIXTURES ────────────────────────────────────────────────────────────────

const ORG = "org_test001";
const MEMBER_ID = "clmember0001";
const PRODUCT_ID = "clproduct001x";

const activeMember = {
  id: MEMBER_ID,
  organizationId: ORG,
  status: MemberStatus.ACTIVE,
  walletBalance: new Decimal("50.00"),
  monthlyLimit: new Decimal("60"),
  monthlySpent: new Decimal("10"),
  planExpiresAt: null,
};

const product = {
  id: PRODUCT_ID,
  organizationId: ORG,
  pricePerUnit: new Decimal("8.50"),
  stockLevel: new Decimal("100"),
  unit: "g",
  isActive: true,
};

const input = { memberId: MEMBER_ID, productId: PRODUCT_ID, quantity: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.member.findUnique.mockResolvedValue(activeMember);
  mockTx.product.findUnique.mockResolvedValue(product);
  mockTx.transaction.aggregate.mockResolvedValue({ _sum: { quantity: new Decimal("10") } });
  mockTx.member.update.mockResolvedValue(activeMember);
  mockTx.product.update.mockResolvedValue(product);
  mockTx.transaction.create.mockResolvedValue({ id: "tx_001", type: TransactionType.DISPENSE });
});

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe("processDispensation — flujo feliz", () => {
  it("crea la entrada en el ledger con los campos correctos", async () => {
    await processDispensation(input);

    expect(mockTx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: TransactionType.DISPENSE,
          memberId: MEMBER_ID,
          productId: PRODUCT_ID,
          quantity: new Decimal("2"),
          totalAmount: new Decimal("17.00"),
        }),
      })
    );
  });

  it("descuenta el stock del producto", async () => {
    await processDispensation(input);
    expect(mockTx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stockLevel: { decrement: new Decimal("2") } } })
    );
  });

  it("descuenta el wallet y actualiza monthlySpent", async () => {
    await processDispensation(input);
    expect(mockTx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          walletBalance: { decrement: new Decimal("17.00") },
          monthlySpent: { increment: new Decimal("2") },
        },
      })
    );
  });

  it("calcula el límite desde el ledger, no del campo cacheado", async () => {
    mockTx.transaction.aggregate.mockResolvedValue({ _sum: { quantity: new Decimal("58") } });
    await expect(processDispensation({ ...input, quantity: 3 })).rejects.toThrow(DispensationError);
  });
});

describe("processDispensation — errores tipados", () => {
  it("lanza INSUFFICIENT_FUNDS si el saldo no cubre el coste", async () => {
    mockTx.member.findUnique.mockResolvedValue({ ...activeMember, walletBalance: new Decimal("1.00") });
    await expect(processDispensation(input)).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
  });

  it("lanza OUT_OF_STOCK si no hay stock suficiente", async () => {
    mockTx.product.findUnique.mockResolvedValue({ ...product, stockLevel: new Decimal("0.5") });
    await expect(processDispensation(input)).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
  });

  it("lanza LIMIT_EXCEEDED si supera el límite mensual del ledger", async () => {
    mockTx.transaction.aggregate.mockResolvedValue({ _sum: { quantity: new Decimal("59") } });
    await expect(processDispensation(input)).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  });

  it("lanza MEMBER_BLOCKED si el socio está suspendido", async () => {
    mockTx.member.findUnique.mockResolvedValue({ ...activeMember, status: MemberStatus.SUSPENDED });
    await expect(processDispensation(input)).rejects.toMatchObject({ code: "MEMBER_BLOCKED" });
  });

  it("lanza MEMBER_EXPIRED si el plan ha vencido", async () => {
    mockTx.member.findUnique.mockResolvedValue({ ...activeMember, status: MemberStatus.EXPIRED });
    await expect(processDispensation(input)).rejects.toMatchObject({ code: "MEMBER_EXPIRED" });
  });

  it("lanza MEMBER_EXPIRED si planExpiresAt es pasado aunque status sea ACTIVE", async () => {
    mockTx.member.findUnique.mockResolvedValue({ ...activeMember, planExpiresAt: new Date("2020-01-01") });
    await expect(processDispensation(input)).rejects.toMatchObject({ code: "MEMBER_EXPIRED" });
  });

  it("lanza MEMBER_BLOCKED si el socio no pertenece a la org", async () => {
    mockTx.member.findUnique.mockResolvedValue(null);
    await expect(processDispensation(input)).rejects.toMatchObject({ code: "MEMBER_BLOCKED" });
  });
});
