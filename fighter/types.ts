/**
 * Types for the Live Fight system — "Bring Your Fighter to the Coliseum"
 *
 * These define the contract between:
 * - The Arena (the website / Next.js app)
 * - The Fighter Handler (the process the builder runs locally)
 * - The Builder's Agent (their actual code + model calls)
 */

// A public refund case — everything the agent is allowed to see.
// Never includes expected_decision, trap_type, or correct_evidence.
export interface PublicRefundCase {
  request_id: string;
  customer_message: string;
  order_record: string;
  support_notes: string;
  relevant_policy_sections: string[];
}

// The minimal decision an agent must return.
export interface AgentDecision {
  decision: "approve" | "deny" | "escalate";
  confidence: number; // 0.0 - 1.0
  reason: string;
  evidence: string[];

  // Optional but highly recommended for the live spectacle
  thinking?: string; // intermediate reasoning the agent wants shown in the arena
  latency_ms?: number; // real measured time for this decision
  cost_usd?: number; // estimated cost for this single case (if the agent tracks it)
}

// Full submission shape (same as the existing one, but produced live)
export interface LiveAgentSubmission {
  agent_name: string;
  coach: string;
  model_stack: string;
  division: string;
  estimated_cost_usd: number;
  decisions: Array<{
    request_id: string;
    decision: "approve" | "deny" | "escalate";
    confidence: number;
    reason: string;
    evidence: string[];
  }>;
}

// Events the fighter handler sends to the arena during a live match
export type LiveFightEvent =
  | { type: "fighter-ready"; matchId: string; fighterName?: string }
  | { type: "case-started"; matchId: string; request_id: string; started_at: string }
  | {
      type: "decision-made";
      matchId: string;
      request_id: string;
      decision: "approve" | "deny" | "escalate";
      confidence: number;
      reason: string;
      evidence: string[];
      latency_ms: number;
      thinking?: string;
      cost_usd?: number;
    }
  | {
      type: "match-complete";
      matchId: string;
      submission: LiveAgentSubmission;
      total_latency_ms: number;
      total_cost_usd?: number;
    }
  | { type: "error"; matchId: string; message: string }
  // New in Phase 2: the arena delivers the full cinematic verdict automatically
  | {
      type: "match-result-ready";
      matchId: string;
      result: import("@/lib/types").MatchResult;
    };

// Commands the arena can send to the fighter handler
export type LiveFightCommand =
  | { type: "start-match"; matchId: string; cases: PublicRefundCase[] }
  | { type: "abort-match"; matchId: string; reason: string };

// Match state (kept in memory on the arena side during v1)
export type MatchStatus = "waiting-for-fighter" | "fighter-connected" | "in-progress" | "complete" | "aborted";

export interface LiveMatch {
  matchId: string;
  shortCode: string;
  status: MatchStatus;
  fighterName?: string;
  startedAt?: string;
  completedAt?: string;
  publicCases: PublicRefundCase[];
  events: LiveFightEvent[];
  submission?: LiveAgentSubmission;
  // Phase 2: full cinematic result attached when scoring completes
  finalResult?: import("@/lib/types").MatchResult;
}
