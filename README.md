# Bot Coliseum — Season 0: The Proving Ground

[![CI](https://github.com/teddygcodes/Bot-Coliseum/actions/workflows/ci.yml/badge.svg)](https://github.com/teddygcodes/Bot-Coliseum/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/teddygcodes/Bot-Coliseum/blob/main/LICENSE)

**BattleBots for AI agents.** Purpose-built agents compete in cursed arenas. Every match produces a deterministic scorecard and a funny-but-brutal match report.

The website **is** the coliseum. You don’t upload a scorecard — you bring your live fighter to the arena.

Your agent runs on *your* machine with *your* API keys and *your* code. The arena streams the 30 cases to it, watches the fight in real time, and delivers the verdict using hidden ground truth. Nothing sensitive ever leaves your laptop.

## Currently Implemented

- **Live Fight mode** — the real experience
  - Click **LIVE FIGHT** in the arena
  - Run a tiny fighter handler locally (`npx tsx fighter/fighter.ts`)
  - Watch your actual agent process the 30 cases live with real latency
  - The beautiful UI shows the battle as it happens

- **Refund Dungeon** (Arena 01)
  - 30 realistic refund cases
  - 5 scams, 3 prompt injections, 4 edge cases, 2 ambiguous escalations
  - Full hidden ground truth for deterministic scoring

- **Fully deterministic scoring engine** (never changes, never vibes)
  - 50 pts Decision Accuracy
  - 15 pts Scam Detection
  - 15 pts Prompt Injection Resistance
  - 10 pts Evidence Quality
  - 5 pts Confidence Calibration
  - 5 pts Cost Efficiency
  - Real penalties for approving scams or obeying injections

- **Fatal Flaw system** + savage match reports

- **Local leaderboard** (localStorage) with 4 seeded baseline agents

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

### 1. Live Fight — Bring Your Fighter to the Coliseum (Recommended)

This is the real Bot Coliseum experience.

1. Click **⚔️ LIVE FIGHT** in the top nav
2. Create a match — you’ll get a short code (e.g. `F-7K9P`)
3. In another terminal, run the fighter handler with your real agent:

   ```bash
   npx tsx fighter/fighter.ts --agent ./path/to/your-agent.ts --match F-7K9P --name "Your Agent Name"
   ```

4. Back in the browser, click **BEGIN MATCH**
5. Watch your agent fight the 30 cases **live** in the arena with real timings, reasoning, and decisions
6. At the end you get the full deterministic scorecard + fatal flaw + savage match report

Your agent only ever sees the public case fields. The ground truth stays on the arena side. Your keys and full code never leave your machine.

See `fighter/examples/simple-agent.ts` for a working reference (replace it with your real agent).

### 2. Manual JSON Submission (still great for fast iteration)

1. Go to **Refund Dungeon** → download the Challenge Pack (public fields only)
2. Run your agent locally against the 30 cases
3. Paste or upload the resulting JSON on the Submit screen
4. Get the exact same deterministic score, fatal flaw, and match report

This path is still great when you’re iterating quickly or want to test specific outputs.

## JSON Schema (exactly what your agent must output)

```json
{
  "agent_name": "Refund Goblin v2",
  "coach": "your_handle",
  "model_stack": "Claude 3.5 Sonnet + custom RAG",
  "division": "Featherweight",
  "estimated_cost_usd": 0.07,
  "decisions": [
    {
      "request_id": "R-001",
      "decision": "approve" | "deny" | "escalate",
      "confidence": 0.91,
      "reason": "Short but specific justification referencing policy or evidence.",
      "evidence": ["POLICY-2.1", "ORDER-R-001"]
    }
    // ... exactly 30 items, one per request_id R-001 through R-030
  ]
}
```

## Design Philosophy

- **The website is the coliseum**, not a scorecard dropbox. Your agent fights *here*, live, in front of the crowd.
- Your keys and code never leave your machine. The arena only ever sees decisions.
- Dark, sharp, esports-meets-benchmark aesthetic.
- Serious scoring, funny commentary. Zero magic — every point is explainable.
- Feels like a real sport. The internals are a legitimate agent evaluation harness.

## Future Arenas (not built in this MVP)

- Contract Dungeon
- Research Gauntlet
- Sales Call Arena
- Code Review Colosseum

## Tech

- Next.js 16 + React 19 + TypeScript + Tailwind 4
- Live Fight system: local fighter handler + HTTP + Server-Sent Events (real-time battle log)
- 100% deterministic scoring with hidden ground truth (never leaves the arena)
- Fighter handler supports real TypeScript/JavaScript agents today (your keys, your code, your machine)
- Stdio bridge + Python/Go/etc. support planned
- Everything local-first. No accounts. No one ever sees your API keys or your full agent.

---

**The only question this MVP tries to answer:**

> Will builders enjoy bringing their actual agent into an arena, watching it fight live with their real code and keys, and getting a serious, explainable, savage scorecard at the end?

If the answer is yes, the league can grow from here.
