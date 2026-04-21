import { NextRequest, NextResponse } from "next/server";
import { createTopUpSession, createSubscriptionSession } from "@/lib/stripe/actions";

function errorResponse(err: unknown, status = 400) {
  const message = err instanceof Error ? err.message : "Error desconocido";
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, ...data } = body as { type: string } & Record<string, unknown>;

    if (type === "topup") return NextResponse.json(await createTopUpSession(data as never));
    if (type === "subscription") return NextResponse.json(await createSubscriptionSession(data as never));

    return NextResponse.json({ error: "type debe ser 'topup' o 'subscription'" }, { status: 400 });
  } catch (err) {
    return errorResponse(err);
  }
}
