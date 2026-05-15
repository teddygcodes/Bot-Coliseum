import { NextRequest, NextResponse } from "next/server";
import { liveMatchManager } from "@/lib/live-match";

/**
 * POST /api/live-fight/register-fighter
 * Called by the fighter handler when it starts up and wants to join a match.
 * Body: { matchId or shortCode, fighterName? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { matchId, shortCode, fighterName } = body;

  let match;
  if (matchId) {
    match = liveMatchManager.getMatch(matchId);
  } else if (shortCode) {
    match = liveMatchManager.getMatchByCode(shortCode);
  }

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const ok = liveMatchManager.registerFighter(match.matchId, fighterName);
  if (!ok) {
    return NextResponse.json({ error: "Match is not waiting for a fighter" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    matchId: match.matchId,
    shortCode: match.shortCode,
    status: "fighter-connected",
  });
}
