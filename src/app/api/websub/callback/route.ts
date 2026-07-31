import { NextRequest, NextResponse } from "next/server";

import { handleWebsubCallbackGet } from "@/lib/websub/handleWebsubCallbackGet";
import { handleWebsubCallbackPost } from "@/lib/websub/handleWebsubCallbackPost";

export async function GET(request: NextRequest) {
  const result = await handleWebsubCallbackGet(request.nextUrl.searchParams);

  return new NextResponse(result.body, {
    status: result.status,
    headers: result.contentType ? { "Content-Type": result.contentType } : undefined,
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const result = await handleWebsubCallbackPost({
    rawBody,
    signatureHeader: request.headers.get("x-hub-signature"),
  });

  return NextResponse.json(result.body, { status: result.status });
}
