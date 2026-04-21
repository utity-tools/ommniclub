import { prisma } from "@/lib/prisma";

type AuditParams = {
  organizationId: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  payload: unknown;
  ipAddress?: string;
  userAgent?: string;
};

/** Inserta un registro inmutable en audit_events. Nunca lanza — fallo silencioso para no bloquear la operación principal. */
export async function audit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        payload: params.payload ? JSON.parse(JSON.stringify(params.payload)) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch {
    // Audit no debe bloquear operaciones de negocio
  }
}
