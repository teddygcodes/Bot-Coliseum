import { NextRequest, NextResponse } from "next/server";
import { liveMatchManager } from "@/lib/live-match";

/**
 * POST /api/live-fight/start
 * Called by the browser when the user clicks "BEGIN MATCH".
 * This tells any waiting fighter handler that it should start processing cases.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { matchId } = body;

  if (!matchId) {
    return NextResponse.json({ error: "matchId required" }, { status: 400 });
  }

  const match = liveMatchManager.getMatch(matchId);
  if (!match || match.status !== "fighter-connected") {
    return NextResponse.json({ error: "No fighter connected or match not ready" }, { status: 409 });
  }

  // Mark that the fight has been authorized to start
  // The fighter handler will discover this on its next poll
  (match as any)._startAuthorized = true;

  // For the browser-driven simulate/demo path, also transition the status immediately
  if (match.status === "fighter-connected") {
    match.status = "in-progress";
    match.startedAt = new Date().toISOString();
  }

  return NextResponse.json({ ok: true, status: "starting" });
}

/**
 * GET /api/live-fight/start?matchId=...
 * Polled by the fighter handler after it registers.
 * Returns { shouldStart: boolean, cases?: PublicRefundCase[] }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");

  if (!matchId) {
    return NextResponse.json({ error: "matchId required" }, { status: 400 });
  }

  const match = liveMatchManager.getMatch(matchId);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const shouldStart = !!(match as any)._startAuthorized && match.status === "fighter-connected";

  if (shouldStart) {
    // Hand the public cases to the fighter
    (match as any)._startAuthorized = false; // consume the signal
    match.status = "in-progress";
    match.startedAt = new Date().toISOString();

    return NextResponse.json({
      shouldStart: true,
      cases: match.publicCases,
    });
  }

  return NextResponse.json({ shouldStart: false });
}
