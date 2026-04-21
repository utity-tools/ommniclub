import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const { Decimal } = Prisma;

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ organizationId: "org_test001", userId: "cluser00001" }),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

const mockProductFindMany = vi.fn();
const mockProductUpdate = vi.fn();
const mockProductCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findMany: mockProductFindMany,
      update: mockProductUpdate,
      create: mockProductCreate,
    },
  },
  getPrismaForOrg: vi.fn(),
}));

const { listProducts, getLowStockProducts, adjustStock, createProduct } =
  await import("@/lib/products/actions");

const makeProduct = (overrides = {}) => ({
  id: "clproduct001",
  organizationId: "org_test001",
  name: "OG Kush",
  sku: null,
  category: null,
  pricePerUnit: new Decimal("8.00"),
  unit: "g",
  stockLevel: new Decimal("50"),
  lowStockAlert: new Decimal("10"),
  isActive: true,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe("listProducts", () => {
  it("retorna productos activos del tenant", async () => {
    const products = [makeProduct()];
    mockProductFindMany.mockResolvedValue(products);
    const result = await listProducts();
    expect(result).toEqual(products);
    expect(mockProductFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org_test001", isActive: true } })
    );
  });
});

describe("getLowStockProducts", () => {
  it("filtra solo productos con stock <= lowStockAlert", async () => {
    mockProductFindMany.mockResolvedValue([
      makeProduct({ stockLevel: new Decimal("5"), lowStockAlert: new Decimal("10") }),  // bajo
      makeProduct({ id: "clproduct002", stockLevel: new Decimal("10"), lowStockAlert: new Decimal("10") }), // justo en el límite (lte)
      makeProduct({ id: "clproduct003", stockLevel: new Decimal("50"), lowStockAlert: new Decimal("10") }), // OK
    ]);
    const result = await getLowStockProducts();
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toContain("clproduct001");
    expect(result.map((p) => p.id)).toContain("clproduct002");
  });

  it("devuelve lista vacía si todos tienen stock suficiente", async () => {
    mockProductFindMany.mockResolvedValue([
      makeProduct({ stockLevel: new Decimal("50"), lowStockAlert: new Decimal("10") }),
    ]);
    expect(await getLowStockProducts()).toHaveLength(0);
  });
});

describe("adjustStock", () => {
  it("incrementa stock con delta positivo", async () => {
    mockProductUpdate.mockResolvedValue(makeProduct({ stockLevel: new Decimal("60") }));
    const result = await adjustStock({ productId: "clproduct001", delta: 10 });
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stockLevel: { increment: 10 } } })
    );
    expect(Number(result.stockLevel)).toBe(60);
  });

  it("decrementa stock con delta negativo", async () => {
    mockProductUpdate.mockResolvedValue(makeProduct({ stockLevel: new Decimal("40") }));
    await adjustStock({ productId: "clproduct001", delta: -10 });
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stockLevel: { increment: -10 } } })
    );
  });

  it("rechaza productId inválido (no cuid)", async () => {
    await expect(adjustStock({ productId: "bad-id", delta: 10 })).rejects.toThrow();
    expect(mockProductUpdate).not.toHaveBeenCalled();
  });
});

describe("createProduct", () => {
  it("crea un producto con los datos correctos", async () => {
    const product = makeProduct();
    mockProductCreate.mockResolvedValue(product);
    const result = await createProduct({
      name: "OG Kush",
      pricePerUnit: 8,
      unit: "g",
      stockLevel: 50,
      lowStockAlert: 10,
    });
    expect(result.name).toBe("OG Kush");
    expect(mockProductCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: "org_test001" }) })
    );
  });

  it("rechaza pricePerUnit negativo", async () => {
    await expect(createProduct({ name: "X", pricePerUnit: -1, unit: "g" })).rejects.toThrow();
  });
});
