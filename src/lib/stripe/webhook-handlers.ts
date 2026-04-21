import type Stripe from "stripe";
import { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type HandlerResult = { handled: boolean; message: string };

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function extractMeta(session: Stripe.Checkout.Session) {
  const m = session.metadata ?? {};
  return {
    type: m.type,
    memberId: m.memberId,
    organizationId: m.organizationId,
    planId: m.planId,
    amountCents: m.amountCents ? parseInt(m.amountCents, 10) : null,
  };
}

// ─── HANDLERS POR EVENTO ─────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<HandlerResult> {
  const { type, memberId, organizationId, planId, amountCents } = extractMeta(session);

  if (!memberId || !organizationId) {
    return { handled: false, message: "Metadata incompleta — ignorado" };
  }

  if (type === "wallet_topup" && amountCents) {
    const amountEuros = amountCents / 100;

    // topUpWallet requiere auth — llamamos a prisma directamente desde el webhook
    await prisma.$transaction(async (tx) => {
      const member = await tx.member.findUniqueOrThrow({ where: { id: memberId, organizationId } });
      const balanceBefore = member.walletBalance;

      await tx.member.update({
        where: { id: memberId },
        data: { walletBalance: { increment: amountEuros } },
      });

      await tx.transaction.create({
        data: {
          organizationId,
          memberId,
          type: TransactionType.WALLET_TOPUP,
          totalAmount: amountEuros,
          balanceBefore,
          balanceAfter: balanceBefore.add(amountEuros),
          stripePaymentIntentId: typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
          notes: "Recarga vía Stripe Checkout",
        },
      });
    });

    await audit({
      organizationId,
      action: "stripe.wallet_topup",
      entityType: "Transaction",
      payload: { memberId, amountEuros, sessionId: session.id },
    });

    return { handled: true, message: `Wallet recargado: ${amountEuros}€ para ${memberId}` };
  }

  if (type === "subscription" && planId) {
    const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
      where: { id: planId, organizationId },
      select: { durationDays: true, monthlyLimit: true, price: true },
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

    await prisma.$transaction(async (tx) => {
      const member = await tx.member.findUniqueOrThrow({ where: { id: memberId, organizationId } });

      await tx.member.update({
        where: { id: memberId },
        data: { planId, planExpiresAt: expiresAt, monthlyLimit: plan.monthlyLimit },
      });

      await tx.transaction.create({
        data: {
          organizationId,
          memberId,
          type: TransactionType.SUBSCRIPTION,
          totalAmount: plan.price,
          balanceBefore: member.walletBalance,
          balanceAfter: member.walletBalance,
          stripePaymentIntentId: typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
          notes: `Suscripción plan ${planId}`,
        },
      });
    });

    await audit({
      organizationId,
      action: "stripe.subscription_activated",
      entityType: "Member",
      entityId: memberId,
      payload: { planId, expiresAt },
    });

    return { handled: true, message: `Suscripción activada para ${memberId}` };
  }

  return { handled: false, message: `Tipo de sesión desconocido: ${type}` };
}

// ─── ROUTER DE EVENTOS ────────────────────────────────────────────────────────

const EVENT_HANDLERS: Partial<Record<Stripe.Event.Type, (event: Stripe.Event) => Promise<HandlerResult>>> = {
  "checkout.session.completed": (e) =>
    handleCheckoutCompleted(e.data.object as Stripe.Checkout.Session),
};

export async function routeStripeEvent(event: Stripe.Event): Promise<HandlerResult> {
  const handler = EVENT_HANDLERS[event.type];
  if (!handler) return { handled: false, message: `Evento no manejado: ${event.type}` };
  return handler(event);
}
