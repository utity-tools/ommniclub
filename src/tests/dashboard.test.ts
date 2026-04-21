import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const { Decimal } = Prisma;

// ─── MOCKS ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ organizationId: "org_test", userId: "u1", orgSlug: null, role: null }),
}));

const mockMemberCount = vi.fn();
const mockTxAggregate = vi.fn();
const mockProductCount = vi.fn();
const mockMemberAggregate = vi.fn();
const mockProductFindMany = vi.fn();
const mockTxFindMany = vi.fn();
const mockTxCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    member: { count: mockMemberCount, aggregate: mockMemberAggregate },
    transaction: { aggregate: mockTxAggregate, findMany: mockTxFindMany, count: mockTxCount },
    product: { count: mockProductCount, findMany: mockProductFindMany },
  },
}));

const { getDashboardStats, listTransactions } = await import("@/lib/dashboard/actions");

// ─── FIXTURES ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockMemberCount.mockResolvedValue(42);
  mockTxAggregate.mockResolvedValue({ _sum: { totalAmount: new Decimal("150.00") } });
  mockProductCount.mockResolvedValue(5);
  mockMemberAggregate.mockResolvedValue({ _sum: { walletBalance: new Decimal("830.00") } });
  mockProductFindMany.mockResolvedValue([
    { stockLevel: new Decimal("5"), lowStockAlert: new Decimal("10") },   // bajo
    { stockLevel: new Decimal("100"), lowStockAlert: new Decimal("10") }, // ok
  ]);
});

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe("getDashboardStats", () => {
  it("devuelve activeMembers, todayRevenue, walletTotal correctos", async () => {
    const stats = await getDashboardStats();

    expect(stats.activeMembers).toBe(42);
    expect(stats.todayRevenue).toBe(150);
    expect(stats.walletTotal).toBe(830);
  });

  it("cuenta correctamente los productos con stock bajo", async () => {
    const stats = await getDashboardStats();
    expect(stats.lowStockProducts).toBe(1);
  });

  it("devuelve 0 cuando no hay ingresos hoy", async () => {
    mockTxAggregate.mockResolvedValue({ _sum: { totalAmount: null } });
    const stats = await getDashboardStats();
    expect(stats.todayRevenue).toBe(0);
  });
});

describe("listTransactions", () => {
  beforeEach(() => {
    mockTxFindMany.mockResolvedValue([
      {
        id: "tx1",
        type: "DISPENSE",
        totalAmount: new Decimal("8.50"),
        quantity: new Decimal("1"),
        createdAt: new Date("2026-04-21T10:00:00Z"),
        notes: null,
        member: { firstName: "Ana", lastName: "García" },
        product: { name: "OG Kush", unit: "g" },
      },
    ]);
    mockTxCount.mockResolvedValue(1);
  });

  it("devuelve items y total correctos", async () => {
    const result = await listTransactions(1, 30);

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe("DISPENSE");
  });

  it("calcula páginas correctamente", async () => {
    mockTxCount.mockResolvedValue(65);
    const result = await listTransactions(1, 30);
    expect(result.pages).toBe(3);
  });
});
