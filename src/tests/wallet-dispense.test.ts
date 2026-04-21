import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma, TransactionType } from "@prisma/client";
const { Decimal } = Prisma;

// ─── MOCKS ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    organizationId: "org_1",
    userId: "user_1",
    orgSlug: "test-club",
    role: "org:admin",
  }),
}));

vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

const mockTx = {
  member: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  product: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  transaction: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    member: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    transaction: { findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn((fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  },
  getPrismaForOrg: vi.fn(),
}));

const { dispense, topUpWallet } = await import("@/lib/wallet/actions");
const { prisma } = await import("@/lib/prisma");

// ─── FIXTURES ────────────────────────────────────────────────────────────────

const member = {
  id: "clmember0001",
  organizationId: "org_1",
  status: "ACTIVE",
  walletBalance: new Decimal("100.00"),
  monthlyLimit: new Decimal("60"),
  monthlySpent: new Decimal("10"),
  spentResetAt: new Date(),
};

const product = {
  id: "clproduct001",
  organizationId: "org_1",
  isActive: true,
  pricePerUnit: new Decimal("8.00"),
  stockLevel: new Decimal("50"),
  unit: "g",
};

const txResult = {
  id: "tx_1",
  type: TransactionType.DISPENSE,
  totalAmount: new Decimal("40.00"),
};

// ─── TESTS ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.member.findUniqueOrThrow).mockResolvedValue(member as never);
  mockTx.member.findUniqueOrThrow.mockResolvedValue(member);
  mockTx.member.update.mockResolvedValue(member);
  mockTx.product.findUniqueOrThrow.mockResolvedValue(product);
  mockTx.product.update.mockResolvedValue(product);
  mockTx.transaction.create.mockResolvedValue(txResult);
});

describe("dispense — ACID transaction", () => {
  const validInput = { memberId: "clmember0001", productId: "clproduct001", quantity: 5 };

  it("ejecuta la transacción y devuelve el ledger entry", async () => {
    const result = await dispense(validInput);
    expect(result).toMatchObject({ id: "tx_1", type: TransactionType.DISPENSE });
  });

  it("actualiza stock del producto con la cantidad dispensada", async () => {
    await dispense(validInput);
    expect(mockTx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stockLevel: { decrement: new Decimal(5) } } })
    );
  });

  it("descuenta wallet y suma monthly_spent del socio", async () => {
    await dispense(validInput);
    expect(mockTx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          walletBalance: { decrement: new Decimal("40.00") },
          monthlySpent: { increment: new Decimal(5) },
        },
      })
    );
  });

  it("lanza si el saldo es insuficiente", async () => {
    mockTx.member.findUniqueOrThrow.mockResolvedValue({
      ...member,
      walletBalance: new Decimal("1.00"),
    });
    await expect(dispense(validInput)).rejects.toThrow("Saldo insuficiente");
  });

  it("lanza si supera el límite mensual", async () => {
    mockTx.member.findUniqueOrThrow.mockResolvedValue({
      ...member,
      monthlySpent: new Decimal("58"),
    });
    await expect(dispense({ ...validInput, quantity: 5 })).rejects.toThrow("Límite mensual superado");
  });

  it("lanza si el stock es insuficiente", async () => {
    mockTx.product.findUniqueOrThrow.mockResolvedValue({
      ...product,
      stockLevel: new Decimal("2"),
    });
    await expect(dispense(validInput)).rejects.toThrow("Stock insuficiente");
  });

  it("rechaza input inválido (Zod) sin llegar a la DB", async () => {
    await expect(dispense({ memberId: "not-a-valid-cuid-because-it-has-hyphens-xyz", productId: "clproduct001", quantity: 5 })).rejects.toThrow();
    expect(mockTx.member.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe("topUpWallet", () => {
  it("incrementa el wallet y devuelve la transacción", async () => {
    mockTx.member.findUniqueOrThrow.mockResolvedValue(member);
    mockTx.transaction.create.mockResolvedValue({
      id: "tx_2",
      type: TransactionType.WALLET_CASH,
      totalAmount: new Decimal("50.00"),
    });

    const result = await topUpWallet({
      memberId: "clmember0001",
      amount: 50,
      type: TransactionType.WALLET_CASH,
    });

    expect(result.type).toBe(TransactionType.WALLET_CASH);
    expect(mockTx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { walletBalance: { increment: new Decimal(50) } } })
    );
  });

  it("rechaza amount negativo", async () => {
    await expect(
      topUpWallet({ memberId: "clmember0001", amount: -10, type: TransactionType.WALLET_CASH })
    ).rejects.toThrow();
  });
});
