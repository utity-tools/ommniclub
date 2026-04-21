import { getDashboardStats } from "@/lib/dashboard/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const cards = [
    { title: "Socios activos", value: stats.activeMembers },
    { title: "Ingresos hoy", value: `${stats.todayRevenue.toFixed(2)} €` },
    { title: "Productos stock bajo", value: stats.lowStockProducts },
    { title: "Saldo total wallets", value: `${stats.walletTotal.toFixed(2)} €` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Panel de control</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-zinc-500">{c.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
