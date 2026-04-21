import Link from "next/link";
import { listMembers } from "@/lib/members/actions";
import { Badge } from "@/components/ui/badge";

export default async function MembersPage() {
  const { members } = await listMembers(1, 50);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Socios</h1>
        <Link
          href="/dashboard/members/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          + Nuevo socio
        </Link>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Email</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Estado</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Saldo</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3 font-medium">{m.firstName} {m.lastName}</td>
                <td className="px-4 py-3 text-zinc-500">{m.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={m.status === "ACTIVE" ? "default" : "secondary"}>
                    {m.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right font-mono">{Number(m.walletBalance).toFixed(2)} €</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/dashboard/members/${m.id}`} className="text-blue-600 hover:underline text-xs">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  No hay socios registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
