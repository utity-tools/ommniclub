import Stripe from "stripe";

function getStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY no configurado");
  return key;
}

// Singleton — una sola instancia por proceso
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  _stripe ??= new Stripe(getStripeKey(), { apiVersion: "2026-03-25.dahlia" });
  return _stripe;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET no configurado");
  return secret;
}
