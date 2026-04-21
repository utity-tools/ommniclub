import { vi } from "vitest";

// Mock Prisma para tests unitarios (los de integración usan DB real)
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { create: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    member: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    transaction: { create: vi.fn() },
    product: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
  getPrismaForOrg: vi.fn(),
}));

// Mock Clerk para tests
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  clerkMiddleware: vi.fn((handler: unknown) => handler),
  createRouteMatcher: vi.fn(() => () => false),
}));
