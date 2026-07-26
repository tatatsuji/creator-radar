import { NextRequest, NextResponse } from "next/server";

import { getVideoHistory } from "@/lib/snapshots/getVideoHistory";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const range = request.nextUrl.searchParams.get("range");

  try {
    const history = await getVideoHistory(id, range);

    return NextResponse.json(history, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "履歴データの取得に失敗しました。",
      },
      { status: 500 },
    );
  }
}
