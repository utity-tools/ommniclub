"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

const ProductSchema = z.object({
  name: z.string().min(1).max(100),
  sku: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  pricePerUnit: z.number().positive(),
  unit: z.enum(["g", "ml", "unit"]).default("g"),
  stockLevel: z.number().min(0).default(0).optional(),
  lowStockAlert: z.number().min(0).default(10).optional(),
});

const StockAdjustSchema = z.object({
  productId: z.string().cuid(),
  delta: z.number(),       // positivo = entrada, negativo = salida manual
  notes: z.string().optional(),
});

export type ProductInput = z.infer<typeof ProductSchema>;
export type StockAdjustInput = z.infer<typeof StockAdjustSchema>;

// ─── ACTIONS ─────────────────────────────────────────────────────────────────

export async function createProduct(input: ProductInput) {
  const { organizationId, userId } = await requireAuth();
  const data = ProductSchema.parse(input);

  const product = await prisma.product.create({
    data: { ...data, organizationId },
  });

  await audit({ organizationId, userId, action: "product.create", entityType: "Product", entityId: product.id, payload: data });
  return product;
}

export async function updateProduct(productId: string, input: Partial<ProductInput>) {
  const { organizationId, userId } = await requireAuth();
  const data = ProductSchema.partial().parse(input);

  const product = await prisma.product.update({
    where: { id: productId, organizationId },
    data,
  });

  await audit({ organizationId, userId, action: "product.update", entityType: "Product", entityId: productId, payload: data });
  return product;
}

export async function listProducts() {
  const { organizationId } = await requireAuth();
  return prisma.product.findMany({
    where: { organizationId, isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      pricePerUnit: true,
      unit: true,
      stockLevel: true,
      lowStockAlert: true,
      isActive: true,
    },
    orderBy: { name: "asc" },
  });
}

/** Devuelve solo los productos con stock <= lowStockAlert. */
export async function getLowStockProducts() {
  const { organizationId } = await requireAuth();
  const products = await prisma.product.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, name: true, unit: true, stockLevel: true, lowStockAlert: true },
  });
  // Comparación en JS porque Prisma no soporta column-to-column WHERE
  return products.filter((p) => p.stockLevel.lte(p.lowStockAlert));
}

/** Ajuste manual de stock (entrada de mercancía o corrección de inventario). */
export async function adjustStock(input: StockAdjustInput) {
  const { organizationId, userId } = await requireAuth();
  const { productId, delta, notes } = StockAdjustSchema.parse(input);

  const product = await prisma.product.update({
    where: { id: productId, organizationId },
    data: { stockLevel: { increment: delta } },
  });

  await audit({
    organizationId, userId,
    action: delta > 0 ? "product.stock_in" : "product.stock_out",
    entityType: "Product", entityId: productId,
    payload: { delta, notes, newStock: product.stockLevel },
  });
  return product;
}

export async function archiveProduct(productId: string) {
  const { organizationId, userId } = await requireAuth();
  const product = await prisma.product.update({
    where: { id: productId, organizationId },
    data: { isActive: false },
  });
  await audit({ organizationId, userId, action: "product.archive", entityType: "Product", entityId: productId, payload: null });
  return product;
}
