import { NextRequest, NextResponse } from "next/server";
import { liveMatchManager } from "@/lib/live-match";
import { LiveAgentSubmission } from "@/fighter/types";
import { scoreSubmission } from "@/lib/scoring";

/**
 * POST /api/live-fight/complete
 * Called by the fighter handler when the agent's run is finished.
 * We receive the full submission, score it with the hidden ground truth,
 * attach the full cinematic MatchResult, and broadcast it so the browser
 * automatically transitions into the savage verdict screen. No extra clicks.
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

  // Attach extra live-fight metadata if useful (we keep it on the submission for now)
  // The scored object is the full MatchResult with fatal_flaw + match_report + everything

  // Store the full beautiful result on the match and broadcast it to the UI
  liveMatchManager.finalizeWithResult(matchId, scored);

  // Also emit the older match-complete for any legacy listeners (harmless)
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
    // The UI will receive the full result via the "match-result-ready" SSE event
  });
}
