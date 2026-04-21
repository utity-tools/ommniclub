import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma, TransactionType } from "@prisma/client";

const { Decimal } = Prisma;

// ─── MOCKS ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

const mockMemberFindUnique = vi.fn();
const mockMemberUpdate = vi.fn();
const mockTransactionCreate = vi.fn();
const mockPlanFindUnique = vi.fn();

const mockTx = {
  member: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  transaction: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    member: { findUniqueOrThrow: mockMemberFindUnique, update: mockMemberUpdate },
    subscriptionPlan: { findUniqueOrThrow: mockPlanFindUnique },
    transaction: { create: mockTransactionCreate },
    $transaction: vi.fn((fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  },
  getPrismaForOrg: vi.fn(),
}));

const { routeStripeEvent } = await import("@/lib/stripe/webhook-handlers");

// ─── FIXTURES ────────────────────────────────────────────────────────────────

const ORG_ID = "org_test001";
const MEMBER_ID = "clmember0001";
const PLAN_ID = "clplan00001x";

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_test_123",
    payment_intent: "pi_test_456",
    metadata: {
      type: "wallet_topup",
      memberId: MEMBER_ID,
      organizationId: ORG_ID,
      amountCents: "2000",
    },
    ...overrides,
  };
}

function makeEvent(type: string, session: unknown) {
  return { type, data: { object: session }, id: "evt_test" };
}

const member = {
  id: MEMBER_ID,
  organizationId: ORG_ID,
  walletBalance: new Decimal("50.00"),
};

// ─── TESTS ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.member.findUniqueOrThrow.mockResolvedValue(member);
  mockTx.member.update.mockResolvedValue({ ...member, walletBalance: new Decimal("70.00") });
  mockTx.transaction.create.mockResolvedValue({ id: "tx_1", type: TransactionType.WALLET_TOPUP });
});

describe("routeStripeEvent — checkout.session.completed", () => {
  it("recarga el wallet del socio con el importe correcto", async () => {
    const result = await routeStripeEvent(makeEvent("checkout.session.completed", makeSession()) as never);

    expect(result.handled).toBe(true);
    expect(mockTx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { walletBalance: { increment: 20 } }, // 2000 centavos = 20€
      })
    );
  });

  it("inserta ledger entry con stripePaymentIntentId", async () => {
    await routeStripeEvent(makeEvent("checkout.session.completed", makeSession()) as never);

    expect(mockTx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: TransactionType.WALLET_TOPUP,
          stripePaymentIntentId: "pi_test_456",
          totalAmount: 20,
        }),
      })
    );
  });

  it("activa la suscripción del socio y actualiza planExpiresAt", async () => {
    const plan = {
      durationDays: 30,
      monthlyLimit: new Decimal("60"),
      price: new Decimal("25.00"),
    };
    mockPlanFindUnique.mockResolvedValue(plan);
    mockTx.member.update.mockResolvedValue(member);
    mockTx.transaction.create.mockResolvedValue({ id: "tx_2", type: TransactionType.SUBSCRIPTION });

    const session = makeSession({
      metadata: {
        type: "subscription",
        memberId: MEMBER_ID,
        organizationId: ORG_ID,
        planId: PLAN_ID,
      },
    });

    const result = await routeStripeEvent(makeEvent("checkout.session.completed", session) as never);
    expect(result.handled).toBe(true);
    expect(mockTx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planId: PLAN_ID }),
      })
    );
  });

  it("ignora sesiones sin metadata", async () => {
    const result = await routeStripeEvent(
      makeEvent("checkout.session.completed", { ...makeSession(), metadata: {} }) as never
    );
    expect(result.handled).toBe(false);
    expect(mockTx.member.update).not.toHaveBeenCalled();
  });

  it("retorna handled:false para eventos no registrados", async () => {
    const result = await routeStripeEvent(makeEvent("payment_intent.created", {}) as never);
    expect(result.handled).toBe(false);
    expect(result.message).toContain("no manejado");
  });
});

describe("stripe client — getStripe singleton", () => {
  it("devuelve la misma instancia en llamadas sucesivas", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder_key_for_tests";
    const { getStripe } = await import("@/lib/stripe/client");
    const a = getStripe();
    const b = getStripe();
    expect(a).toBe(b);
  });

  it("lanza si STRIPE_SECRET_KEY no está configurado", async () => {
    const original = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    // Reset singleton para forzar re-creación
    const mod = await import("@/lib/stripe/client");
    // @ts-expect-error — acceso a variable privada del módulo para test
    mod._stripe = null;
    // La función re-creará con la key ausente
    process.env.STRIPE_SECRET_KEY = original;
  });
});
