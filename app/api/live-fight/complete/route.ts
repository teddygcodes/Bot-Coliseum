import { NextRequest, NextResponse } from "next/server";
import { liveMatchManager } from "@/lib/live-match";
import { LiveAgentSubmission } from "@/fighter/types";
import { scoreSubmission } from "@/lib/scoring";

/**
 * POST /api/live-fight/complete
 * Called by the fighter handler when the agent's run is finished.
 * We receive the full submission, score it with the hidden ground truth,
 * and broadcast the final result so the UI can transition to the cinematic scorecard.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { matchId, submission, total_latency_ms, total_cost_usd } = body as {
    matchId: string;
    submission: LiveAgentSubmission;
    total_latency_ms?: number;
    total_cost_usd?: number;
  };

  if (!matchId || !submission) {
    return NextResponse.json({ error: "matchId and submission required" }, { status: 400 });
  }

  const match = liveMatchManager.getMatch(matchId);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // Convert the live submission into the shape the existing scorer expects
  const scored = scoreSubmission({
    agent_name: submission.agent_name,
    coach: submission.coach,
    model_stack: submission.model_stack,
    division: submission.division,
    estimated_cost_usd: submission.estimated_cost_usd,
    decisions: submission.decisions,
  });

  // Broadcast the completion event (the UI will listen for this and show the result)
  liveMatchManager.emitEvent(matchId, {
    type: "match-complete",
    matchId,
    submission,
    total_latency_ms: total_latency_ms ?? 0,
    total_cost_usd,
  });

  return NextResponse.json({
    ok: true,
    score: scored.final_score,
    fatal_flaw: scored.fatal_flaw,
    record: scored.record,
    // The full scored result can be fetched by the UI via the snapshot or a separate call
  });
}
