"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "./client";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

const TopUpSessionSchema = z.object({
  memberId: z.string().cuid(),
  amount: z.number().int().min(100).max(50000), // centavos — min 1€, max 500€
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const SubscriptionSessionSchema = z.object({
  planId: z.string().cuid(),
  memberId: z.string().cuid(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function getOrCreateStripeCustomer(memberId: string, organizationId: string): Promise<string> {
  const member = await prisma.member.findUniqueOrThrow({
    where: { id: memberId, organizationId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const stripe = getStripe();

  // Buscar cliente existente por metadata
  const existing = await stripe.customers.search({
    query: `metadata['memberId']:'${memberId}'`,
    limit: 1,
  });

  if (existing.data.length > 0) return existing.data[0].id;

  const customer = await stripe.customers.create({
    name: `${member.firstName} ${member.lastName}`,
    email: member.email ?? undefined,
    metadata: { memberId, organizationId },
  });

  return customer.id;
}

// ─── ACTIONS ─────────────────────────────────────────────────────────────────

/**
 * Crea una Stripe Checkout Session para recarga de monedero.
 * El webhook `checkout.session.completed` ejecuta el top-up real.
 */
export async function createTopUpSession(input: z.infer<typeof TopUpSessionSchema>) {
  const { organizationId } = await requireAuth();
  const data = TopUpSessionSchema.parse(input);

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { stripeAccountId: true, applicationFeePercent: true },
  });

  const customerId = await getOrCreateStripeCustomer(data.memberId, organizationId);

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: { name: "Recarga de monedero OmniClub" },
        unit_amount: data.amount,
      },
      quantity: 1,
    }],
    payment_intent_data: org.stripeAccountId
      ? {
          application_fee_amount: Math.round(
            data.amount * Number(org.applicationFeePercent) / 100
          ),
          transfer_data: { destination: org.stripeAccountId },
        }
      : undefined,
    metadata: {
      type: "wallet_topup",
      memberId: data.memberId,
      organizationId,
      amountCents: String(data.amount),
    },
    success_url: data.successUrl,
    cancel_url: data.cancelUrl,
  });

  return { sessionId: session.id, url: session.url };
}

/**
 * Crea una Checkout Session para suscripción del socio al club.
 */
export async function createSubscriptionSession(input: z.infer<typeof SubscriptionSessionSchema>) {
  const { organizationId } = await requireAuth();
  const data = SubscriptionSessionSchema.parse(input);

  const [org, plan] = await prisma.$transaction([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { stripeAccountId: true, applicationFeePercent: true },
    }),
    prisma.subscriptionPlan.findUniqueOrThrow({
      where: { id: data.planId, organizationId },
      select: { stripePriceId: true, name: true, price: true },
    }),
  ]);

  if (!plan.stripePriceId) throw new Error("El plan no tiene precio de Stripe configurado");

  const customerId = await getOrCreateStripeCustomer(data.memberId, organizationId);
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    subscription_data: org.stripeAccountId
      ? {
          application_fee_percent: Number(org.applicationFeePercent),
          transfer_data: { destination: org.stripeAccountId },
        }
      : undefined,
    metadata: {
      type: "subscription",
      memberId: data.memberId,
      planId: data.planId,
      organizationId,
    },
    success_url: data.successUrl,
    cancel_url: data.cancelUrl,
  });

  return { sessionId: session.id, url: session.url };
}
