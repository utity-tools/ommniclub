"use client";

import { useCallback, useState } from "react";
import { RFIDStatusIndicator } from "@/components/rfid/RFIDStatusIndicator";
import { NumericKeypad } from "@/components/pos/NumericKeypad";
import { MemberCard } from "@/components/pos/MemberCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import type { getMemberByRFID } from "@/lib/members/actions";
import type { listProducts } from "@/lib/products/actions";

type Member = NonNullable<Awaited<ReturnType<typeof getMemberByRFID>>>;
type Product = Awaited<ReturnType<typeof listProducts>>[number];
type CheckinStatus = "idle" | "granted" | "denied";

// ─── FAST CHECKOUT STATE MACHINE ──────────────────────────────────────────────
// idle → member scanned → product selected → quantity entered → dispensed → idle

type POSState =
  | { step: "idle" }
  | { step: "member_loaded"; member: Member; status: CheckinStatus }
  | { step: "product_selected"; member: Member; product: Product }
  | { step: "dispensing"; member: Member; product: Product; quantity: number };

export default function POSPage() {
  const [pos, setPOS] = useState<POSState>({ step: "idle" });
  const [products, setProducts] = useState<Product[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Cargar productos al montar (Server Action)
  const loadProducts = useCallback(async () => {
    const { listProducts } = await import("@/lib/products/actions");
    setProducts(await listProducts());
  }, []);

  useState(() => { loadProducts(); });

  const handleRFIDRead = useCallback(async ({ normalized }: { normalized: string }) => {
    const { getMemberByRFID } = await import("@/lib/members/actions");
    const member = await getMemberByRFID(normalized);

    if (!member) {
      setPOS({ step: "idle" });
      toast.error("Socio no encontrado");
      return;
    }

    const isValid = member.status === "ACTIVE" && Number(member.walletBalance) > 0;
    setPOS({
      step: "member_loaded",
      member,
      status: isValid ? "granted" : "denied",
    });
  }, []);

  const handleDispense = useCallback(async (quantity: number) => {
    if (pos.step !== "product_selected") return;
    setIsProcessing(true);
    setPOS({ step: "dispensing", member: pos.member, product: pos.product, quantity });

    try {
      const { processDispensation } = await import("@/lib/wallet/actions");
      await processDispensation({ memberId: pos.member.id, productId: pos.product.id, quantity });
      toast.success(`${pos.product.name} · ${quantity}${pos.product.unit}`);
      setPOS({ step: "idle" });
    } catch (err) {
      const { DispensationError } = await import("@/lib/wallet/errors");
      if (err instanceof DispensationError) {
        const messages: Record<string, string> = {
          INSUFFICIENT_FUNDS: "Saldo insuficiente",
          OUT_OF_STOCK: "Sin stock",
          LIMIT_EXCEEDED: "Límite mensual alcanzado",
          MEMBER_BLOCKED: "Socio bloqueado",
          MEMBER_EXPIRED: "Membresía expirada",
        };
        toast.error(messages[err.code] ?? err.message);
      } else {
        toast.error(err instanceof Error ? err.message : "Error en la operación");
      }
      setPOS({ step: "member_loaded", member: pos.member, status: "denied" });
    } finally {
      setIsProcessing(false);
    }
  }, [pos]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex flex-col gap-4 max-w-2xl mx-auto">
      <Toaster />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">POS · Fast Checkout</h1>
        <RFIDStatusIndicator
          mode="keyboard"
          onRead={handleRFIDRead}
          onError={(e) => toast.error(e.message)}
        />
      </div>

      {/* Member area */}
      {pos.step !== "idle" && (
        <MemberCard member={pos.member} status={pos.step === "member_loaded" ? pos.status : "granted"} />
      )}

      {pos.step === "idle" && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const tag = (e.currentTarget.elements.namedItem("tag") as HTMLInputElement).value.trim();
            if (tag) handleRFIDRead({ normalized: tag });
            e.currentTarget.reset();
          }}
        >
          <input
            name="tag"
            placeholder="RFID manual (ej: DEMO0001)"
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            Buscar
          </button>
        </form>
      )}

      {pos.step === "idle" && (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center h-32 text-gray-400">
            Esperando lectura RFID…
          </CardContent>
        </Card>
      )}

      {/* Product grid */}
      {(pos.step === "member_loaded" && pos.status === "granted") && (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => {
            const lowStock = Number(p.stockLevel) <= Number(p.lowStockAlert);
            return (
              <button
                key={p.id}
                onClick={() => setPOS({ step: "product_selected", member: pos.member, product: p })}
                className="rounded-xl border bg-white p-3 text-left shadow-sm hover:border-blue-400 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <p className="font-semibold">{p.name}</p>
                  {lowStock && <Badge variant="destructive" className="text-xs">Bajo</Badge>}
                </div>
                <p className="text-sm text-gray-500 mt-1">{p.pricePerUnit.toString()} €/{p.unit}</p>
                <p className="text-xs text-gray-400">{Number(p.stockLevel).toFixed(1)} {p.unit} en stock</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Numeric keypad */}
      {pos.step === "product_selected" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {pos.product.name} · {pos.product.pricePerUnit.toString()} €/g
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NumericKeypad onConfirm={handleDispense} disabled={isProcessing} />
          </CardContent>
        </Card>
      )}

      {pos.step === "dispensing" && (
        <Card>
          <CardContent className="flex items-center justify-center h-32 text-blue-600 font-semibold animate-pulse">
            Procesando {pos.quantity}{pos.product.unit} de {pos.product.name}…
          </CardContent>
        </Card>
      )}
    </div>
  );
}
