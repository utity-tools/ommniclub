import { NextRequest, NextResponse } from "next/server";
import { createProduct, listProducts, getLowStockProducts } from "@/lib/products/actions";

function errorResponse(err: unknown, status = 400) {
  const message = err instanceof Error ? err.message : "Error desconocido";
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const lowStock = req.nextUrl.searchParams.get("lowStock") === "true";
    const data = lowStock ? await getLowStockProducts() : await listProducts();
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    return NextResponse.json(await createProduct(await req.json()), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
