import { NextResponse } from "next/server";
import { liveMatchManager } from "@/lib/live-match";

/**
 * POST /api/live-fight/create
 * Creates a new live match and returns the matchId + shortCode for pairing.
 */
export async function POST() {
  const match = liveMatchManager.createMatch();

  return NextResponse.json({
    matchId: match.matchId,
    shortCode: match.shortCode,
    status: match.status,
  });
}
