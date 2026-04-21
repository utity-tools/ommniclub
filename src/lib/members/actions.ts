"use server";

import { z } from "zod";
import { MemberStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

const MemberCreateSchema = z.object({
  documentNumber: z.string().min(5).max(20),
  documentType: z.enum(["DNI", "NIE", "PASSPORT"]).default("DNI"),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  rfidTag: z.string().optional(),
  planId: z.string().optional(),
});

const MemberUpdateSchema = MemberCreateSchema.partial().omit({ documentNumber: true });

export type MemberCreateInput = z.infer<typeof MemberCreateSchema>;
export type MemberUpdateInput = z.infer<typeof MemberUpdateSchema>;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Aplica soft-delete RGPD: borra PII, mantiene el registro para integridad del ledger. */
async function anonymizeMember(memberId: string, organizationId: string) {
  return prisma.member.update({
    where: { id: memberId, organizationId },
    data: {
      documentNumber: "[ELIMINADO]",
      firstName: "[ELIMINADO]",
      lastName: "[ELIMINADO]",
      email: null,
      phone: null,
      rfidTag: null,
      status: MemberStatus.DELETED,
      deletedAt: new Date(),
    },
  });
}

// ─── ACTIONS ─────────────────────────────────────────────────────────────────

export async function createMember(input: MemberCreateInput) {
  const { organizationId, userId } = await requireAuth();
  const data = MemberCreateSchema.parse(input);

  const member = await prisma.member.create({
    data: {
      ...data,
      organizationId,
      documentNumber: encrypt(data.documentNumber),
    },
  });

  await audit({
    organizationId,
    userId,
    action: "member.create",
    entityType: "Member",
    entityId: member.id,
    payload: { firstName: data.firstName, lastName: data.lastName },
  });

  return member;
}

export async function updateMember(memberId: string, input: MemberUpdateInput) {
  const { organizationId, userId } = await requireAuth();
  const data = MemberUpdateSchema.parse(input);

  const member = await prisma.member.update({
    where: { id: memberId, organizationId },
    data,
  });

  await audit({ organizationId, userId, action: "member.update", entityType: "Member", entityId: memberId, payload: data });
  return member;
}

export async function getMember(memberId: string) {
  const { organizationId } = await requireAuth();
  const member = await prisma.member.findUnique({
    where: { id: memberId, organizationId },
    include: { plan: true },
  });
  if (!member) throw new Error("Socio no encontrado");
  return {
    ...member,
    documentNumber: member.deletedAt ? "[ELIMINADO]" : decrypt(member.documentNumber),
  };
}

export async function getMemberByRFID(rfidTag: string) {
  const { organizationId } = await requireAuth();
  return prisma.member.findFirst({
    where: { rfidTag, organizationId, status: MemberStatus.ACTIVE },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      walletBalance: true,
      monthlyLimit: true,
      monthlySpent: true,
      spentResetAt: true,
      status: true,
      plan: { select: { name: true, durationDays: true } },
      planExpiresAt: true,
    },
  });
}

export async function listMembers(page = 1, pageSize = 20) {
  const { organizationId } = await requireAuth();
  const [members, total] = await prisma.$transaction([
    prisma.member.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        walletBalance: true,
        rfidTag: true,
        planExpiresAt: true,
        plan: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.member.count({ where: { organizationId, deletedAt: null } }),
  ]);
  return { members, total, page, pageSize };
}

export async function deleteMember(memberId: string) {
  const { organizationId, userId } = await requireAuth();
  const member = await anonymizeMember(memberId, organizationId);
  await audit({ organizationId, userId, action: "member.delete", entityType: "Member", entityId: memberId, payload: null });
  return member;
}
