"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MemberStatus, TransactionType } from "@prisma/client";

export async function getDashboardStats() {
  const { organizationId } = await requireAuth();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [activeMembers, todayRevenue, lowStockCount, walletTotal] = await Promise.all([
    prisma.member.count({
      where: { organizationId, status: MemberStatus.ACTIVE },
    }),
    prisma.transaction.aggregate({
      where: {
        organizationId,
        type: { in: [TransactionType.DISPENSE, TransactionType.WALLET_TOPUP, TransactionType.WALLET_CASH] },
        createdAt: { gte: today },
      },
      _sum: { totalAmount: true },
    }),
    prisma.product.count({
      where: { organizationId, isActive: true },
    }),
    prisma.member.aggregate({
      where: { organizationId, status: MemberStatus.ACTIVE },
      _sum: { walletBalance: true },
    }),
  ]);

  const products = await prisma.product.findMany({
    where: { organizationId, isActive: true },
    select: { stockLevel: true, lowStockAlert: true },
  });
  const lowStock = products.filter((p) => p.stockLevel.lte(p.lowStockAlert)).length;

  return {
    activeMembers,
    todayRevenue: Number(todayRevenue._sum.totalAmount ?? 0),
    lowStockProducts: lowStock,
    totalProducts: lowStockCount,
    walletTotal: Number(walletTotal._sum.walletBalance ?? 0),
  };
}

export async function listTransactions(page = 1, pageSize = 30) {
  const { organizationId } = await requireAuth();
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        type: true,
        totalAmount: true,
        quantity: true,
        createdAt: true,
        notes: true,
        member: { select: { firstName: true, lastName: true } },
        product: { select: { name: true, unit: true } },
      },
    }),
    prisma.transaction.count({ where: { organizationId } }),
  ]);

  return { items, total, pages: Math.ceil(total / pageSize) };
}
