import { getMember } from "@/lib/members/actions";
import { listTransactions } from "@/lib/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [member, { items: txs }] = await Promise.all([
    getMember(id),
    listTransactions(1, 10),
  ]);

  const memberTxs = txs.filter((t) =>
    t.member && `${t.member.firstName} ${t.member.lastName}` === `${member.firstName} ${member.lastName}`
  );

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/members" className="text-sm text-zinc-500 hover:underline">← Socios</Link>
        <h1 className="text-2xl font-bold">{member.firstName} {member.lastName}</h1>
        <Badge variant={member.status === "ACTIVE" ? "default" : "secondary"}>{member.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-zinc-500">Saldo wallet</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{Number(member.walletBalance).toFixed(2)} €</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-zinc-500">Gastado este mes</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{Number(member.monthlySpent).toFixed(2)} €</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Información</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Row label="Documento" value={`${member.documentType}: ${member.documentNumber}`} />
          <Row label="Email" value={member.email ?? "—"} />
          <Row label="Teléfono" value={member.phone ?? "—"} />
          <Row label="RFID" value={member.rfidTag ?? "—"} />
          <Row label="Plan" value={member.plan?.name ?? "Sin plan"} />
          <Row label="Expira plan" value={member.planExpiresAt ? new Date(member.planExpiresAt).toLocaleDateString("es") : "—"} />
        </CardContent>
      </Card>

      {memberTxs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Últimas transacciones</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {memberTxs.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2 text-zinc-500">{new Date(t.createdAt).toLocaleString("es")}</td>
                    <td className="px-4 py-2">{t.type}</td>
                    <td className="px-4 py-2">{t.product?.name ?? t.notes ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{Number(t.totalAmount).toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
