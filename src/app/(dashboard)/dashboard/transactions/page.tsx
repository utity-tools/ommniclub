import { listTransactions } from "@/lib/dashboard/actions";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
  DISPENSE: "Dispensación",
  WALLET_TOPUP: "Recarga wallet",
  WALLET_CASH: "Recarga efectivo",
  SUBSCRIPTION: "Suscripción",
};

export default async function TransactionsPage() {
  const { items, total } = await listTransactions(1, 50);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transacciones</h1>
        <span className="text-sm text-zinc-500">{total} en total</span>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Fecha</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Tipo</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Socio</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Producto</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((t) => (
              <tr key={t.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                  {new Date(t.createdAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{TYPE_LABELS[t.type] ?? t.type}</Badge>
                </td>
                <td className="px-4 py-3">
                  {t.member ? `${t.member.firstName} ${t.member.lastName}` : "—"}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {t.product ? `${t.product.name}${t.quantity ? ` · ${Number(t.quantity).toFixed(1)}${t.product.unit}` : ""}` : t.notes ?? "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium">
                  {Number(t.totalAmount).toFixed(2)} €
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  No hay transacciones
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
