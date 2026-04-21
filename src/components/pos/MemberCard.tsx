"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { getMemberByRFID } from "@/lib/members/actions";

type Member = NonNullable<Awaited<ReturnType<typeof getMemberByRFID>>>;

type Props = {
  member: Member;
  status: "granted" | "denied" | "idle";
};

const STATUS_STYLES = {
  granted: "border-green-500 bg-green-50",
  denied:  "border-red-500  bg-red-50",
  idle:    "border-gray-200 bg-white",
} as const;

export function MemberCard({ member, status }: Props) {
  const balance = Number(member.walletBalance);
  const limitLeft = Number(member.monthlyLimit) - Number(member.monthlySpent);

  return (
    <Card className={`border-2 transition-colors ${STATUS_STYLES[status]}`}>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xl font-bold">{member.firstName} {member.lastName}</p>
          <Badge variant={status === "denied" ? "destructive" : "default"}>
            {status === "granted" ? "Acceso OK" : status === "denied" ? "Denegado" : member.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-white/60 p-2">
            <p className="text-gray-500">Saldo</p>
            <p className="text-lg font-semibold">{balance.toFixed(2)} €</p>
          </div>
          <div className="rounded-lg bg-white/60 p-2">
            <p className="text-gray-500">Límite restante</p>
            <p className="text-lg font-semibold">{limitLeft.toFixed(1)} g</p>
          </div>
        </div>

        {member.plan && (
          <p className="text-xs text-gray-400">
            Plan: {member.plan.name}
            {member.planExpiresAt && ` · Vence ${new Date(member.planExpiresAt).toLocaleDateString("es-ES")}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
