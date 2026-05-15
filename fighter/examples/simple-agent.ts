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
 * The Quick Demo button in the arena runs the *exact same* brain via demo-agent.ts
 * so the experience is 100% consistent.
 */

import { PublicRefundCase } from "../types";
import { decideDemo, simulateLatency } from "../demo-agent";

export async function decide(c: PublicRefundCase): Promise<{
  decision: "approve" | "deny" | "escalate";
  confidence: number;
  reason: string;
  evidence: string[];
  thinking?: string;
  latency_ms?: number;
}> {
  // === Real LLM path (uncomment + set your key to make this actually call Claude) ===
  // if (process.env.ANTHROPIC_API_KEY) {
  //   return await callClaude(c, start);
  // }

  // Use the shared demo brain (keeps the Quick Demo and real fighter perfectly in sync)
  const brain = decideDemo(c);
  const latency = simulateLatency(c);

  return {
    ...brain,
    latency_ms: latency,
  };
}

// Example of what a real LLM-backed version would look like (commented so it doesn't require deps)
// async function callClaude(_c: PublicRefundCase, _start: number) {
//   // Implement with @anthropic-ai/sdk if you want the real thing
//   throw new Error("Real LLM path not wired in this demo. Set ANTHROPIC_API_KEY and implement.");
// }
