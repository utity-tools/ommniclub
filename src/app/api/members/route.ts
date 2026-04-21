import { NextRequest, NextResponse } from "next/server";
import { createMember, listMembers } from "@/lib/members/actions";

function errorResponse(err: unknown, status = 400) {
  const message = err instanceof Error ? err.message : "Error desconocido";
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
    return NextResponse.json(await listMembers(page, pageSize));
  } catch (err) {
    return errorResponse(err, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json(await createMember(body), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
