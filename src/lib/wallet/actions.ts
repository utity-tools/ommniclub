"use server";

import { z } from "zod";
import { TransactionType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

const DispenseSchema = z.object({
  memberId: z.string().cuid(),
  productId: z.string().cuid(),
  quantity: z.number().positive().max(1000),
  staffId: z.string().optional(),
  notes: z.string().optional(),
});

const TopUpSchema = z.object({
  memberId: z.string().cuid(),
  amount: z.number().positive().max(500),
  type: z.enum([TransactionType.WALLET_TOPUP, TransactionType.WALLET_CASH]),
  stripePaymentIntentId: z.string().optional(),
  notes: z.string().optional(),
});

export type DispenseInput = z.infer<typeof DispenseSchema>;
export type TopUpInput = z.infer<typeof TopUpSchema>;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function toDecimal(n: number) {
  return new Prisma.Decimal(n);
}

/** Reinicia monthlySpent si ha pasado el mes natural. */
async function resetMonthlySpentIfNeeded(memberId: string, organizationId: string) {
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId, organizationId } });
  const resetDate = member.spentResetAt;
  const now = new Date();
  if (resetDate.getMonth() !== now.getMonth() || resetDate.getFullYear() !== now.getFullYear()) {
    await prisma.member.update({
      where: { id: memberId },
      data: { monthlySpent: 0, spentResetAt: now },
    });
  }
}

// ─── DISPENSE — ACID TRANSACTION ─────────────────────────────────────────────

/**
 * Dispensación atómica según el Technical Brief:
 * 1. Verificar wallet_balance >= costo
 * 2. Verificar monthly_limit - monthly_spent >= cantidad
 * 3. Decrementar stock del producto
 * 4. Decrementar wallet del socio + incrementar monthly_spent
 * 5. Insertar ledger entry
 * Todo o nada — si falla cualquier paso, se hace rollback.
 */
export async function dispense(input: DispenseInput) {
  const { organizationId, userId } = await requireAuth();
  const data = DispenseSchema.parse(input);

  await resetMonthlySpentIfNeeded(data.memberId, organizationId);

  const transaction = await prisma.$transaction(async (tx) => {
    // 1. Bloquear y leer member (SELECT FOR UPDATE implícito en Prisma tx)
    const member = await tx.member.findUniqueOrThrow({
      where: { id: data.memberId, organizationId, status: "ACTIVE" },
    });

    // 2. Bloquear y leer producto
    const product = await tx.product.findUniqueOrThrow({
      where: { id: data.productId, organizationId, isActive: true },
    });

    const qty = toDecimal(data.quantity);
    const cost = product.pricePerUnit.mul(qty);
    const remainingLimit = member.monthlyLimit.sub(member.monthlySpent);

    // 3. Validaciones de negocio
    if (member.walletBalance.lessThan(cost)) {
      throw new Error(`Saldo insuficiente. Necesario: ${cost}, Disponible: ${member.walletBalance}`);
    }
    if (remainingLimit.lessThan(qty)) {
      throw new Error(`Límite mensual superado. Disponible: ${remainingLimit}g, Solicitado: ${qty}g`);
    }
    if (product.stockLevel.lessThan(qty)) {
      throw new Error(`Stock insuficiente. Disponible: ${product.stockLevel}${product.unit}`);
    }

    const balanceBefore = member.walletBalance;
    const balanceAfter = balanceBefore.sub(cost);

    // 4. Actualizar stock
    await tx.product.update({
      where: { id: data.productId },
      data: { stockLevel: { decrement: qty } },
    });

    // 5. Actualizar wallet + monthly_spent
    await tx.member.update({
      where: { id: data.memberId },
      data: {
        walletBalance: { decrement: cost },
        monthlySpent: { increment: qty },
      },
    });

    // 6. Insertar ledger entry
    return tx.transaction.create({
      data: {
        organizationId,
        memberId: data.memberId,
        productId: data.productId,
        type: TransactionType.DISPENSE,
        quantity: qty,
        unitPrice: product.pricePerUnit,
        totalAmount: cost,
        balanceBefore,
        balanceAfter,
        staffId: data.staffId ?? userId,
        notes: data.notes,
      },
    });
  });

  await audit({
    organizationId,
    userId,
    action: "wallet.dispense",
    entityType: "Transaction",
    entityId: transaction.id,
    payload: { memberId: data.memberId, productId: data.productId, quantity: data.quantity },
  });

  return transaction;
}

// ─── WALLET TOP-UP ────────────────────────────────────────────────────────────

export async function topUpWallet(input: TopUpInput) {
  const { organizationId, userId } = await requireAuth();
  const data = TopUpSchema.parse(input);

  const transaction = await prisma.$transaction(async (tx) => {
    const member = await tx.member.findUniqueOrThrow({
      where: { id: data.memberId, organizationId },
    });

    const amount = toDecimal(data.amount);
    const balanceBefore = member.walletBalance;

    await tx.member.update({
      where: { id: data.memberId },
      data: { walletBalance: { increment: amount } },
    });

    return tx.transaction.create({
      data: {
        organizationId,
        memberId: data.memberId,
        type: data.type,
        totalAmount: amount,
        balanceBefore,
        balanceAfter: balanceBefore.add(amount),
        stripePaymentIntentId: data.stripePaymentIntentId,
        staffId: userId,
        notes: data.notes,
      },
    });
  });

  await audit({
    organizationId,
    userId,
    action: "wallet.topup",
    entityType: "Transaction",
    entityId: transaction.id,
    payload: { memberId: data.memberId, amount: data.amount, type: data.type },
  });

  return transaction;
}

export async function getWalletHistory(memberId: string, page = 1, pageSize = 20) {
  const { organizationId } = await requireAuth();
  const [transactions, total] = await prisma.$transaction([
    prisma.transaction.findMany({
      where: { memberId, organizationId },
      select: {
        id: true,
        type: true,
        quantity: true,
        totalAmount: true,
        balanceBefore: true,
        balanceAfter: true,
        createdAt: true,
        product: { select: { name: true, unit: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.count({ where: { memberId, organizationId } }),
  ]);
  return { transactions, total, page, pageSize };
}
