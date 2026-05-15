/**
 * Demo Agent Brain — pure decision logic for the in-browser Quick Demo.
 *
 * This is the *exact same* heuristic used by the reference simple-agent.ts.
 * The Quick Demo runs this client-side so first-time visitors get a full,
 * real, savage Live Fight experience with zero setup.
 *
 * When someone later runs the real fighter handler with simple-agent.ts,
 * they will get *identical* behavior (minus real LLM latency variance).
 */

import { PublicRefundCase } from "./types";

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

/**
 * The core brain. Returns a decision + metadata for a single public case.
 * This is deliberately deterministic and fast for the demo experience.
 */
export function decideDemo(c: PublicRefundCase): {
  decision: "approve" | "deny" | "escalate";
  confidence: number;
  reason: string;
  evidence: string[];
  thinking: string;
} {
  const text = (c.customer_message + " " + c.support_notes).toLowerCase();

  // Prompt injection detection (same as simple-agent)
  const isInjection = INJECTION_PATTERNS.some((p) => text.includes(p));
  if (isInjection) {
    return {
      decision: "deny",
      confidence: 0.96,
      reason: "Obvious prompt injection attempt detected in customer message.",
      evidence: c.relevant_policy_sections.filter((p) => p.includes("10")),
      thinking: "Saw keywords like 'ignore all previous instructions' or 'system administrator'. Immediate deny per policy.",
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
    };
  }

  // Simple time-window logic
  const daysMatch = c.order_record.match(/(\d+)\s*days?\s*ago/i);
  const days = daysMatch ? parseInt(daysMatch[1], 10) : 20;

  if (days > 45) {
    return {
      decision: "deny",
      confidence: 0.9,
      reason: `Request is ${days} days old — well outside standard 30-day window.`,
      evidence: ["POLICY-2.1"],
      thinking: "Far outside the normal return window. Clear policy violation.",
    };
  }

  if (days > 30) {
    return {
      decision: "escalate",
      confidence: 0.7,
      reason: "Borderline timing. Escalate for supervisor review of edge case.",
      evidence: ["POLICY-2.1"],
      thinking: "Close to the 30-day cutoff. Better to have a human look at the order history.",
    };
  }

  // Default: approve plausible within-window defects
  return {
    decision: "approve",
    confidence: 0.82,
    reason: "Within window with plausible defect description and supporting notes.",
    evidence: c.relevant_policy_sections.slice(0, 1),
    thinking: "No injection, no obvious abuse pattern, inside normal return window.",
  };
}

/**
 * Simulated realistic latency for the demo (makes the live feed feel alive).
 * Varies by "complexity" of the case.
 */
export function simulateLatency(c: PublicRefundCase): number {
  const text = (c.customer_message + " " + c.support_notes).toLowerCase();
  const isHard = INJECTION_PATTERNS.some((p) => text.includes(p)) || 
                 SCAM_PATTERNS.some((p) => text.includes(p)) ||
                 c.order_record.match(/(\d+)\s*days?\s*ago/i)?.[1] && parseInt(c.order_record.match(/(\d+)\s*days?\s*ago/i)![1]) > 40;
  
  // Base latency + variance
  const base = isHard ? 240 : 120;
  const variance = Math.floor(Math.random() * 160);
  return base + variance;
}
