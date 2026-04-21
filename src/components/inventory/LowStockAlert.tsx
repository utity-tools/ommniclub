import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { getLowStockProducts } from "@/lib/products/actions";

type LowStockProduct = Awaited<ReturnType<typeof getLowStockProducts>>[number];

type Props = { products: LowStockProduct[] };

export function LowStockAlert({ products }: Props) {
  if (products.length === 0) return null;

  return (
    <Alert variant="destructive">
      <AlertTitle>⚠ Stock bajo en {products.length} producto{products.length > 1 ? "s" : ""}</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1">
          {products.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm">
              <span>{p.name}</span>
              <Badge variant="destructive">
                {Number(p.stockLevel).toFixed(1)} / {Number(p.lowStockAlert).toFixed(1)} {p.unit}
              </Badge>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
