import { NextRequest, NextResponse } from "next/server";
import { dispense, topUpWallet, getWalletHistory } from "@/lib/wallet/actions";

function errorResponse(err: unknown, status = 400) {
  const message = err instanceof Error ? err.message : "Error desconocido";
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const memberId = searchParams.get("memberId");
    if (!memberId) return NextResponse.json({ error: "memberId requerido" }, { status: 400 });
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    return NextResponse.json(await getWalletHistory(memberId, page));
  } catch (err) {
    return errorResponse(err, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === "dispense") return NextResponse.json(await dispense(body));
    if (action === "topup") return NextResponse.json(await topUpWallet(body));

    return NextResponse.json({ error: "action debe ser 'dispense' o 'topup'" }, { status: 400 });
  } catch (err) {
    return errorResponse(err);
  }
}
