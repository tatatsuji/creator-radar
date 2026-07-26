import { NextRequest, NextResponse } from "next/server";

import { getVideoDeltas } from "@/lib/snapshots/getVideoDeltas";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const deltas = await getVideoDeltas(id);

    if (!deltas) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json(deltas, {
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
            : "増加数データの取得に失敗しました。",
      },
      { status: 500 },
    );
  }
}
