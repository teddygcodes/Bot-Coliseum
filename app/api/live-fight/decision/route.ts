import { NextRequest, NextResponse } from "next/server";
import { liveMatchManager } from "@/lib/live-match";

/**
 * POST /api/live-fight/decision
 * Called by the fighter handler every time the builder's agent produces a decision.
 * This drives the live battle log in the arena UI.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { matchId, request_id, decision, confidence, reason, evidence, latency_ms, thinking, cost_usd } = body;

  if (!matchId || !request_id) {
    return NextResponse.json({ error: "matchId and request_id required" }, { status: 400 });
  }

  const match = liveMatchManager.getMatch(matchId);
  if (!match || match.status !== "in-progress") {
    return NextResponse.json({ error: "Match not in progress" }, { status: 409 });
  }

  liveMatchManager.emitEvent(matchId, {
    type: "decision-made",
    matchId,
    request_id,
    decision,
    confidence,
    reason,
    evidence: evidence || [],
    latency_ms: latency_ms ?? 0,
    thinking,
    cost_usd,
  });

  return NextResponse.json({ ok: true });
}
