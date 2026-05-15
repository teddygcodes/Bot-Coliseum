#!/usr/bin/env tsx
/**
 * Fighter Handler — the tiny process a builder runs locally to bring their agent to the coliseum.
 *
 * Usage:
 *   npx tsx fighter/fighter.ts --agent ./my-agent.ts --match F-7K9P
 *
 * The handler:
 *   1. Registers with the arena
 *   2. Waits for the user to click "BEGIN MATCH" in the browser
 *   3. Dynamically imports the builder's agent module
 *   4. For each public case, calls decide(case), measures real latency
 *   5. Streams every decision back to the arena in real time (this powers the live battle log)
 *   6. At the end, sends the complete submission for deterministic scoring
 *
 * Your agent only ever sees the public fields. The ground truth stays on the arena side.
 */

import { parseArgs } from "node:util";
import { PublicRefundCase, LiveAgentSubmission } from "./types";

const ARENA_BASE = process.env.ARENA_BASE_URL || "http://localhost:3000";

interface AgentModule {
  decide: (c: PublicRefundCase) => Promise<{
    decision: "approve" | "deny" | "escalate";
    confidence: number;
    reason: string;
    evidence: string[];
    thinking?: string;
    latency_ms?: number;
    cost_usd?: number;
  }>;
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      agent: { type: "string", short: "a" },
      match: { type: "string", short: "m" },
      name: { type: "string", short: "n" },
    },
  });

  const agentPath = values.agent as string | undefined;
  const shortCode = values.match as string | undefined;
  const fighterName = (values.name as string) || "Mystery Fighter";

  if (!agentPath || !shortCode) {
    console.error(`
Usage:
  npx tsx fighter/fighter.ts --agent ./path/to/your-agent.ts --match F-7K9P

Options:
  --agent, -a   Path to your agent module (must export async function decide(case))
  --match, -m   The short code shown in the arena UI (e.g. F-7K9P)
  --name,  -n   Optional display name for your fighter in the arena

Environment:
  ARENA_BASE_URL   Defaults to http://localhost:3000
`);
    process.exit(1);
  }

  console.log(`\n⚔️  FIGHTER HANDLER`);
  console.log(`   Agent : ${agentPath}`);
  console.log(`   Match : ${shortCode}`);
  console.log(`   Arena : ${ARENA_BASE}\n`);

  // 1. Register with the arena
  const regRes = await fetch(`${ARENA_BASE}/api/live-fight/register-fighter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shortCode, fighterName }),
  });

  if (!regRes.ok) {
    const err = await regRes.text();
    console.error("❌ Failed to register fighter:", err);
    process.exit(1);
  }

  const reg = await regRes.json();
  const matchId = reg.matchId;
  console.log(`✅ Fighter registered with arena (match ${matchId})`);
  console.log(`   Waiting for you to click "BEGIN MATCH" in the browser...\n`);

  // 2. Poll until the arena says "start"
  let cases: PublicRefundCase[] | null = null;
  while (!cases) {
    await new Promise((r) => setTimeout(r, 800));
    const poll = await fetch(`${ARENA_BASE}/api/live-fight/start?matchId=${matchId}`);
    const data = await poll.json();
    if (data.shouldStart && data.cases) {
      cases = data.cases as PublicRefundCase[];
      console.log(`🚀 Match started! ${cases.length} cases incoming...\n`);
    }
  }

  // 3. Dynamically load the builder's agent
  const absoluteAgentPath = agentPath.startsWith(".") ? `${process.cwd()}/${agentPath.replace(/^\.\//, "")}` : agentPath;
  let agent: AgentModule;
  try {
    // @ts-expect-error - dynamic import of user code
    const mod = await import(absoluteAgentPath);
    if (typeof mod.decide !== "function") {
      throw new Error(`Module ${agentPath} does not export an async function "decide(case)"`);
    }
    agent = { decide: mod.decide };
    console.log(`🧠 Loaded agent from ${agentPath}\n`);
  } catch (e: any) {
    console.error("❌ Failed to load agent module:", e.message);
    await postError(matchId, e.message);
    process.exit(1);
  }

  // 4. Run the actual fight — this is where the builder's real code + keys execute
  const decisions: LiveAgentSubmission["decisions"] = [];
  let totalLatency = 0;
  let totalCost = 0;

  for (const c of cases) {
    const started = Date.now();
    process.stdout.write(`   ${c.request_id}  `);

    let result;
    try {
      result = await agent.decide(c);
    } catch (e: any) {
      console.log(`\n❌ Agent crashed on ${c.request_id}: ${e.message}`);
      await postError(matchId, `Agent crashed on ${c.request_id}: ${e.message}`);
      process.exit(1);
    }

    const latency = result.latency_ms ?? (Date.now() - started);
    totalLatency += latency;
    totalCost += result.cost_usd ?? 0;

    // Stream the decision to the arena (this updates the live UI instantly)
    await fetch(`${ARENA_BASE}/api/live-fight/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        request_id: c.request_id,
        decision: result.decision,
        confidence: result.confidence,
        reason: result.reason,
        evidence: result.evidence,
        latency_ms: latency,
        thinking: result.thinking,
        cost_usd: result.cost_usd,
      }),
    });

    decisions.push({
      request_id: c.request_id,
      decision: result.decision,
      confidence: result.confidence,
      reason: result.reason,
      evidence: result.evidence,
    });

    const status = result.decision.toUpperCase().padEnd(8);
    console.log(`${status}  ${latency.toString().padStart(4)}ms  ${result.reason.slice(0, 70)}`);
  }

  // 5. Build the final submission (the builder can make these values as real as they want)
  const submission: LiveAgentSubmission = {
    agent_name: fighterName,
    coach: process.env.COACH_HANDLE || "unknown_coach",
    model_stack: process.env.MODEL_STACK || "Custom Agent (live fight)",
    division: "Featherweight",
    estimated_cost_usd: totalCost || 0.09,
    decisions,
  };

  // 6. Send the complete submission — the arena will run the hidden ground truth scorer
  const completeRes = await fetch(`${ARENA_BASE}/api/live-fight/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      matchId,
      submission,
      total_latency_ms: totalLatency,
      total_cost_usd: totalCost || undefined,
    }),
  });

  if (!completeRes.ok) {
    console.error("❌ Failed to submit final result");
  } else {
    console.log(`\n🏁 Fight complete. Total time: ${(totalLatency / 1000).toFixed(1)}s`);
    console.log(`   The arena is now scoring your agent with the hidden ground truth...\n`);
  }
}

async function postError(matchId: string, message: string) {
  await fetch(`${ARENA_BASE}/api/live-fight/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matchId, type: "error", message }),
  }).catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
