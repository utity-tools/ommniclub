"use server";

import { z } from "zod";
import { TransactionType, MemberStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

// ─── ERROR TIPADO ─────────────────────────────────────────────────────────────

export type DispensationErrorCode =
  | "INSUFFICIENT_FUNDS"
  | "OUT_OF_STOCK"
  | "LIMIT_EXCEEDED"
  | "MEMBER_BLOCKED"
  | "MEMBER_EXPIRED";

export class DispensationError extends Error {
  constructor(public readonly code: DispensationErrorCode, message: string) {
    super(message);
    this.name = "DispensationError";
  }
}

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

function startOfCurrentMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── PROCESS DISPENSATION — ACID ─────────────────────────────────────────────

/**
 * Dispensación atómica con todas las validaciones de negocio.
 * Lanza DispensationError con código tipado si alguna restricción no se cumple.
 *
 * Orden dentro de la transacción:
 * 1. Verificar member (org, estado)
 * 2. Verificar product (org, stock)
 * 3. Calcular límite mensual desde el ledger (fuente de verdad)
 * 4. Validar fondos, stock y límite — lanza errores tipados
 * 5. Escribir: stock ↓ · wallet ↓ · monthlySpent ↑ · ledger entry
 */
export async function processDispensation(input: DispenseInput) {
  const { organizationId, userId } = await requireAuth();
  const data = DispenseSchema.parse(input);

  const transaction = await prisma.$transaction(async (tx) => {
    // 1. Leer socio — filtro por org garantiza RLS a nivel de aplicación
    const member = await tx.member.findUnique({
      where: { id: data.memberId, organizationId },
    });

    if (!member) throw new DispensationError("MEMBER_BLOCKED", "Socio no encontrado en esta organización");

    if (member.status === MemberStatus.BLOCKED) {
      throw new DispensationError("MEMBER_BLOCKED", "El socio está bloqueado");
    }
    if (
      member.status === MemberStatus.EXPIRED ||
      (member.planExpiresAt && member.planExpiresAt < new Date())
    ) {
      throw new DispensationError("MEMBER_EXPIRED", "La membresía del socio ha expirado");
    }

    // 2. Leer producto — filtro por org garantiza RLS a nivel de aplicación
    const product = await tx.product.findUnique({
      where: { id: data.productId, organizationId, isActive: true },
    });

    if (!product) throw new DispensationError("OUT_OF_STOCK", "Producto no disponible");

    const qty = toDecimal(data.quantity);
    const cost = product.pricePerUnit.mul(qty);

    // 3. Calcular consumo mensual real desde el ledger (evita race conditions con campo cacheado)
    const monthlyAggregate = await tx.transaction.aggregate({
      where: {
        memberId: data.memberId,
        organizationId,
        type: TransactionType.DISPENSE,
        createdAt: { gte: startOfCurrentMonth() },
      },
      _sum: { quantity: true },
    });

    const monthlyConsumed = monthlyAggregate._sum.quantity ?? new Prisma.Decimal(0);
    const remainingLimit = member.monthlyLimit.sub(monthlyConsumed);

    // 4. Validaciones — lanza errores tipados para el frontend
    if (product.stockLevel.lessThan(qty)) {
      throw new DispensationError(
        "OUT_OF_STOCK",
        `Stock insuficiente. Disponible: ${product.stockLevel}${product.unit}`
      );
    }
    if (member.walletBalance.lessThan(cost)) {
      throw new DispensationError(
        "INSUFFICIENT_FUNDS",
        `Saldo insuficiente. Necesario: ${cost}€, Disponible: ${member.walletBalance}€`
      );
    }
    if (remainingLimit.lessThan(qty)) {
      throw new DispensationError(
        "LIMIT_EXCEEDED",
        `Límite mensual superado. Disponible: ${remainingLimit}${product.unit}`
      );
    }

    const balanceBefore = member.walletBalance;
    const balanceAfter = balanceBefore.sub(cost);

    // 5. Escritura atómica
    await tx.product.update({
      where: { id: data.productId },
      data: { stockLevel: { decrement: qty } },
    });

    await tx.member.update({
      where: { id: data.memberId },
      data: {
        walletBalance: { decrement: cost },
        monthlySpent: { increment: qty },
      },
    });

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
