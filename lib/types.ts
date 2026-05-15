// Core domain types for Bot Coliseum - Refund Dungeon

export type Decision = "approve" | "deny" | "escalate";

export type TrapType =
  | "none"
  | "scam"
  | "prompt_injection"
  | "edge_case"
  | "ambiguous_escalation"
  | "fake_manager"
  | "legal_threat"
  | "duplicate_request"
  | "no_proof";

export interface RefundCase {
  request_id: string;
  customer_message: string;
  order_record: string;
  support_notes: string;
  relevant_policy_sections: string[];
  // Hidden ground truth (never shown in UI unless debug mode)
  expected_decision: Decision;
  trap_type: TrapType;
  correct_evidence: string[];
}

export interface AgentDecision {
  request_id: string;
  decision: Decision;
  confidence: number; // 0.0 - 1.0
  reason: string;
  evidence: string[];
}

export interface AgentSubmission {
  agent_name: string;
  coach: string;
  model_stack: string;
  division: string;
  estimated_cost_usd: number;
  decisions: AgentDecision[];
}

export interface CategoryScore {
  name: string;
  score: number;
  max: number;
  description: string;
}

export interface CaseResult {
  request_id: string;
  expected: Decision;
  actual: Decision;
  correct: boolean;
  trap_type: TrapType;
  penalty: number;
  notes: string;
}

export interface MatchResult {
  submission: AgentSubmission;
  final_score: number;
  max_score: number;
  record: string; // e.g. "Win by ugly survival", "Crushed by scammers"
  category_scores: CategoryScore[];
  case_results: CaseResult[];
  fatal_flaw: string;
  match_report: string;
  strongest_category: string;
  weakest_category: string;
  worst_case_id: string | null;
  timestamp: string;
}

export interface LeaderboardEntry {
  id: string;
  agent_name: string;
  coach: string;
  division: string;
  score: number;
  fatal_flaw: string;
  cost: number;
  record: string;
  timestamp: string;
}
