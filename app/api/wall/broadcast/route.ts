import { NextRequest, NextResponse } from "next/server";
import { addToSharedWall } from "@/lib/wall";
import type { SharedWallBroadcast } from "@/lib/types";

/**
 * POST /api/wall/broadcast
 *
 * Accepts a new broadcast and appends it to the shared coliseum memory.
 * Anyone can call this — no auth (Season 0 philosophy).
 *
 * Body:
 * {
 *   encoded: string,     // from encodeMatchData(...)
 *   isLive?: boolean,
 *   timestamp: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.encoded || !body.timestamp) {
      return NextResponse.json({ error: "encoded and timestamp are required" }, { status: 400 });
    }

    const entry: SharedWallBroadcast = {
      id: `shared-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      encoded: body.encoded,
      isLive: !!body.isLive,
      timestamp: body.timestamp,
    };

    await addToSharedWall(entry);

    return NextResponse.json({ ok: true, id: entry.id });
  } catch (error) {
    console.error("[/api/wall/broadcast] Error:", error);
    return NextResponse.json({ error: "Failed to broadcast to the coliseum" }, { status: 500 });
  }
}
