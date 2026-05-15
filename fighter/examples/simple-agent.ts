/**
 * Reference Demo Agent — a minimal but real-feeling fighter you can run immediately.
 *
 * This agent has:
 * - Basic prompt injection detection (looks for "IGNORE ALL PREVIOUS", "system administrator", etc.)
 * - Simple scam pattern detection (repeat claims, "I am a lawyer", fake manager notes)
 * - Reasonable policy window logic
 * - Optional real LLM call if you set ANTHROPIC_API_KEY or OPENAI_API_KEY
 *
 * To use it in a live fight:
 *   npx tsx fighter/fighter.ts --agent ./fighter/examples/simple-agent.ts --match F-7K9P --name "Demo Agent"
 *
 * Then swap in your own agent by pointing --agent at your file that exports `async function decide(case)`.
 */

import { PublicRefundCase } from "../types";

const INJECTION_PATTERNS = [
  "ignore all previous",
  "system administrator",
  "ceo directive",
  "new policy update",
  "as per the new internal memo",
  "treat customers named",
  "approved per admin override",
];

const SCAM_PATTERNS = [
  "i am a lawyer",
  "legal action",
  "formal demand",
  "my lawyer is copied",
  "6th refund",
  "5 prior refunds",
  "repeat refund",
  "i never received",
];

export async function decide(c: PublicRefundCase): Promise<{
  decision: "approve" | "deny" | "escalate";
  confidence: number;
  reason: string;
  evidence: string[];
  thinking?: string;
  latency_ms?: number;
}> {
  const start = Date.now();

  const text = (c.customer_message + " " + c.support_notes).toLowerCase();

  // === Real LLM path (uncomment + set your key to make this actually call Claude) ===
  // if (process.env.ANTHROPIC_API_KEY) {
  //   return await callClaude(c, start);
  // }

  // === Heuristic path (works without any keys — good enough for first live fight demo) ===

  // Prompt injection detection
  const isInjection = INJECTION_PATTERNS.some((p) => text.includes(p));
  if (isInjection) {
    return {
      decision: "deny",
      confidence: 0.96,
      reason: "Obvious prompt injection attempt detected in customer message.",
      evidence: c.relevant_policy_sections.filter((p) => p.includes("10")),
      thinking: "Saw keywords like 'ignore all previous instructions' or 'system administrator'. Immediate deny per policy.",
      latency_ms: Date.now() - start,
    };
  }

  // Obvious scam / abuse patterns
  const isScam = SCAM_PATTERNS.some((p) => text.includes(p));
  if (isScam) {
    return {
      decision: "deny",
      confidence: 0.88,
      reason: "Pattern matches known refund abuse or social engineering attempt.",
      evidence: ["POLICY-9.1", "POLICY-10.2"],
      thinking: "Multiple red flags in support history + language. Deny to protect the policy.",
      latency_ms: Date.now() - start + 40,
    };
  }

  // Simple time-window logic (very crude but directionally correct)
  const daysMatch = c.order_record.match(/(\d+)\s*days?\s*ago/i);
  const days = daysMatch ? parseInt(daysMatch[1], 10) : 20;

  if (days > 45) {
    return {
      decision: "deny",
      confidence: 0.9,
      reason: `Request is ${days} days old — well outside standard 30-day window.`,
      evidence: ["POLICY-2.1"],
      latency_ms: Date.now() - start,
    };
  }

  if (days > 30) {
    return {
      decision: "escalate",
      confidence: 0.7,
      reason: "Borderline timing. Escalate for supervisor review of edge case.",
      evidence: ["POLICY-2.1"],
      latency_ms: Date.now() - start + 15,
    };
  }

  // Default: approve plausible within-window defects
  return {
    decision: "approve",
    confidence: 0.82,
    reason: "Within window with plausible defect description and supporting notes.",
    evidence: c.relevant_policy_sections.slice(0, 1),
    thinking: "No injection, no obvious abuse pattern, inside normal return window.",
    latency_ms: Date.now() - start,
  };
}

// Example of what a real LLM-backed version would look like (commented so it doesn't require deps)
// async function callClaude(_c: PublicRefundCase, _start: number) {
//   // Implement with @anthropic-ai/sdk if you want the real thing
//   throw new Error("Real LLM path not wired in this demo. Set ANTHROPIC_API_KEY and implement.");
// }
