"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import type { listProducts } from "@/lib/products/actions";

type Product = Awaited<ReturnType<typeof listProducts>>[number];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [delta, setDelta] = useState("");

  useEffect(() => {
    import("@/lib/products/actions").then(({ listProducts }) =>
      listProducts().then(setProducts)
    );
  }, []);

  async function handleAdjust(productId: string) {
    const d = parseFloat(delta);
    if (isNaN(d) || d === 0) return;
    try {
      const { adjustStock } = await import("@/lib/products/actions");
      await adjustStock({ productId, delta: d });
      toast.success(`Stock ajustado: ${d > 0 ? "+" : ""}${d}`);
      setAdjusting(null);
      setDelta("");
      const { listProducts } = await import("@/lib/products/actions");
      setProducts(await listProducts());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Toaster />
      <h1 className="text-2xl font-bold">Productos</h1>
      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Producto</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Categoría</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Precio</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Stock</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Ajustar</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((p) => {
              const lowStock = Number(p.stockLevel) <= Number(p.lowStockAlert);
              return (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.category ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{Number(p.pricePerUnit).toFixed(2)} €/{p.unit}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono">{Number(p.stockLevel).toFixed(1)} {p.unit}</span>
                    {lowStock && <Badge variant="destructive" className="ml-2 text-xs">Bajo</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {adjusting === p.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <input
                          type="number"
                          step="0.1"
                          value={delta}
                          onChange={(e) => setDelta(e.target.value)}
                          className="w-20 rounded border px-2 py-1 text-sm text-right"
                          placeholder="±g"
                        />
                        <Button size="sm" onClick={() => handleAdjust(p.id)}>OK</Button>
                        <Button size="sm" variant="outline" onClick={() => setAdjusting(null)}>✕</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => { setAdjusting(p.id); setDelta(""); }}>
                        Ajustar
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
