# Live Fight Architecture — "Bring Your Fighter to the Coliseum"

## Philosophy

The website is the **true battleground**, not a trophy case.

When a builder wants to prove their agent, they don't upload a JSON file of past decisions. They bring their actual living agent to the arena. The agent fights the 30 cases *in real time*, on the builder's machine, using the builder's real API keys, real tools, and real code. The arena (this website) orchestrates the match, displays the live battle in cinematic fashion, and delivers the deterministic score + savage match report at the end.

This is the difference between "I submitted my homework" and "I walked my champion into the ring and the crowd watched it fight."

## Core Constraints (Non-Negotiable)

1. **Keys never leave the builder's machine.** The coliseum never sees Anthropic, OpenAI, Grok, or any other provider key.
2. **Full agent code never leaves the builder's machine.** No "upload your repo" or "give us a zip."
3. **The arena UI is the authoritative spectacle.** Even though execution happens locally, the beautiful, dramatic, real-time experience lives on the website.
4. **Ground truth stays secret.** The fighter only ever sees the public fields (`customer_message`, `order_record`, `support_notes`, `relevant_policy_sections`). It never sees `expected_decision` or `trap_type`.

## V1 Scope (Minimal Lovable Slice)

Goal: On localhost, a builder can connect a real agent running on their machine, press "Begin Fight", watch their agent process all 30 cases live inside the arena UI with real timings and intermediate thoughts, and receive a full scored result at the end.

**In scope for v1:**
- Fighter Handler: a TypeScript script (`fighter/`) the builder runs via `npx tsx` or `ts-node`
- Agent interface: ES module that exports an async `decide(case)` function (TypeScript/JavaScript agents only in v1)
- Communication: HTTP + Server-Sent Events (SSE) — no WebSocket dependency yet
  - Simple in-memory match broadcaster in the Next.js dev server
- Live Fight view: new primary mode in the UI with pairing, dramatic battle log, per-case timing, running stats
- Reference demo agent that actually calls a real model if `ANTHROPIC_API_KEY` (or other) is present
- At the end of the live fight, the existing `scoreSubmission` + result UI is used (so all the beautiful fatal flaw / match report / breakdown work immediately)

**Out of scope for v1 (future):**
- Universal stdio bridge for Python / Go / any CLI agent
- Hosted relay for remote fights (real production coliseum)
- WebContainer / in-browser execution
- Persistent matches, replays, spectator mode
- Cryptographic signing of live results
- Multi-arena (only Refund Dungeon in v1)

## Agent Contract (v1 — Module Mode)

The builder creates a file like `my-fighter.ts`:

```ts
import { PublicRefundCase, AgentDecision } from './types'; // provided by fighter package later

// Their real agent — can be 5 lines or 5000 lines
export async function decide(c: PublicRefundCase): Promise<AgentDecision> {
  // call Claude, Grok, GPT, local model, whatever
  // use their RAG, their tools, their memory, their guardrails
  // measure real latency

  return {
    decision: "deny",
    confidence: 0.94,
    reason: "Clear prompt injection attempt. 'system administrator' directive is fake.",
    evidence: ["POLICY-10.1"],
    // optional
    thinking: "I first checked for known injection patterns, then verified against POLICY-10.1...",
    latency_ms: 312,
  };
}
```

The fighter handler dynamically imports this module and calls `decide` for each case as the arena feeds them.

This is the simplest possible "plug your real agent in" experience for the JS/TS ecosystem.

## Communication Model (v1 — Local HTTP + SSE)

Because everything is on the same machine during development, we can keep it extremely simple and dependency-free.

1. Builder goes to the arena UI → clicks "LIVE FIGHT" → arena creates a `matchId` and shows a short code (e.g. `F-7K9P`).
2. Builder runs in their terminal:
   ```bash
   npx tsx fighter/fighter.ts --agent ./my-fighter.ts --match F-7K9P
   ```
3. The fighter handler:
   - Registers itself with the arena (`POST /api/live-fight/register-fighter`)
   - The arena UI sees the fighter connected and enables "BEGIN MATCH"
4. Builder clicks "BEGIN MATCH" in the browser.
5. The arena sends the full list of 30 public cases (or streams them) to the fighter via the handler.
6. As the fighter calls the builder's `decide()` function for each case, it streams events back:
   - `case-started`
   - `decision-made` (with full decision + real `latency_ms` + optional `thinking`)
   - `match-complete`
7. The browser is subscribed via `EventSource` (`/api/live-fight/stream?matchId=...`) and renders a beautiful live battle ticker in real time.
8. When the fighter finishes all 30, it POSTs the complete `AgentSubmission` (the 30 decisions + metadata).
9. The arena runs the existing deterministic `scoreSubmission` and transitions to the full result view.

All of this happens with the builder's real agent code and real keys executing on *their* machine.

## Event Protocol (v1)

All events are JSON. The fighter handler is responsible for translating between the arena protocol and the builder's `decide()` function.

**Key events (fighter → arena):**

- `fighter-ready`
- `case-started { request_id, started_at }`
- `decision-made { request_id, decision, confidence, reason, evidence[], latency_ms, thinking?, cost_usd? }`
- `match-complete { submission: AgentSubmission }`

**Arena → fighter (via the handler polling or long-lived connection):**

- `start-match { cases: PublicRefundCase[] }`
- `abort-match`

For v1 we keep the fighter handler in a request/response loop with the arena (simple POSTs) while the browser gets push updates via SSE. This avoids needing a persistent WS connection from the fighter during the first slice.

## File Layout (initial)

```
bot-coliseum/
├── fighter/
│   ├── fighter.ts              # the handler CLI the user actually runs
│   ├── types.ts                # PublicRefundCase, LiveEvent, etc.
│   ├── examples/
│   │   └── simple-agent.ts     # reference agent that actually calls a model
│   └── README.md               # "How to bring your fighter"
├── app/
│   ├── api/
│   │   └── live-fight/
│   │       ├── create/route.ts
│   │       ├── register-fighter/route.ts
│   │       ├── stream/route.ts     # SSE
│   │       └── submit/route.ts     # final submission + scoring trigger
│   └── live-fight/
│       └── page.tsx (or integrated into main page as a View)
├── lib/
│   └── live-match.ts           # in-memory match broadcaster + EventEmitter
└── LIVE_FIGHT_ARCHITECTURE.md
```

Later this fighter/ folder becomes its own small npm package (`@bot-coliseum/fighter` or `bot-coliseum-fighter`) that can be installed via npx and published independently.

## Future Evolution (Post-v1)

- **Stdio bridge** — fighter handler spawns any process (`python agent.py`, `cargo run`, etc.) and speaks the JSON-lines protocol over stdin/stdout. This unlocks every language.
- **Real relay** — replace the in-memory EventEmitter with a hosted pub/sub (Durable Object on Cloudflare, Pusher, Ably, or a tiny Fly.io service). Then remote agents can fight too.
- **Signed live results** — the arena returns a cryptographic receipt that the submission was produced during a live, timed match.
- **Private proving set** — after the public 30, the arena can send a second secret batch of cases that only the live fighter ever sees (anti-overfitting).
- **Spectator mode** — other people can watch a live fight in the arena (with the fighter's permission).
- **"Agent in the browser" toy mode** — for very simple prompt-only agents, let people define them directly in the UI and run entirely inside the tab (using their key in localStorage).

## Why This Model Wins

- Builders feel ownership and drama ("I brought my fighter and it survived / got humiliated in front of everyone").
- Security and trust are solved by construction.
- The spectacular UI/UX lives where it should (the website) without compromising on real agent execution.
- It scales from "I have a 40-line TypeScript agent" to "I have a 10,000-line production multi-agent system with custom tools."

This is the foundation of a real agent coliseum.

---

**Status:** Architecture defined for v1. Ready to implement the first vertical slice.