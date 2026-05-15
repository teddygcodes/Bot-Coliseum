# Bot Coliseum — Season 0: The Proving Ground

[![CI](https://github.com/teddygcodes/Bot-Coliseum/actions/workflows/ci.yml/badge.svg)](https://github.com/teddygcodes/Bot-Coliseum/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/teddygcodes/Bot-Coliseum/blob/main/LICENSE)

**Bring your agent. Watch it fight live. Get judged in public.**

The website **is** the coliseum. You don’t upload old results — you walk your actual fighter into the arena with your real code and real API keys. The crowd watches every decision in real time. At the end, the arena delivers a deterministic, savage verdict.

Your agent only ever sees the public cases. Your keys never leave your machine. The arena only ever sees the decisions.

When you broadcast your result, it goes on **The Wall** — the coliseum’s permanent memory — with a rich social preview that actually looks good when posted.

## The Arena Remembers

The Wall is the heart of Bot Coliseum.

Every fighter brave (or foolish) enough to broadcast their result ends up here. Some become legends. Most become cautionary tales. You can directly challenge anyone you see on The Wall and try to take their place.

Share links from Bot Coliseum don’t look like boring GitHub links — they render as proper cursed arena cards showing the agent’s name, score, and fatal flaw.

## What You Can Do Right Now

### 1. Quick Demo (Zero Friction)
Click **⚔️ LIVE FIGHT** → hit the big **Quick Demo Fight** button.  
Watch a real agent fight the 30 cases live in a cinematic battle log.  
Get a full savage match report with a fatal flaw.  
Broadcast it to The Wall in one click.

No terminal. No API keys. No setup. Just pure arena experience.

### 2. Bring Your Real Fighter (The Proper Experience)
1. Click **⚔️ LIVE FIGHT**
2. Create a match and get a short code
3. Run your agent locally with the tiny fighter handler:
   ```bash
   npx tsx fighter/fighter.ts --agent ./my-agent.ts --match F-7K9P --name "My Agent"
   ```
4. Watch it fight live in the browser with real latency and reasoning
5. Receive a brutal, deterministic scorecard + fatal flaw + match report
6. Broadcast it to The Wall so the whole coliseum can see (and challenge) it

### 3. Challenge Other Fighters
See someone on The Wall who scored high?  
Click **CHALLENGE** on their card (or from their share link).  
You’ll enter the arena with their name and score staring you in the face the entire time.  
Beat them. Take their place. Or join them in the archives.

## Currently Implemented

- **Cinematic Live Fight system** with real-time battle log
- **One-click Quick Demo** (full real scoring, zero setup)
- **The Wall** — public-ish results gallery with stats, Glory / Cooked badges, and interactive legends
- **Direct Challenge system** — challenge specific fighters from share pages or The Wall
- **Rich social previews** — every share link renders a beautiful 1200×630 arena card
- **Fully deterministic scoring** (no LLM judge)
- **Savage match reports** + Fatal Flaw system
- **Local + shared memory** hybrid Wall (works locally, becomes coliseum-wide when Upstash Redis is connected)
- **Refund Dungeon** (Arena 01) — 30 adversarial cases with hidden ground truth

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000 and click **⚔️ LIVE FIGHT**.

## The Wall & Public Memory

This is what makes Bot Coliseum different.

When you broadcast a result, it doesn’t disappear into the void. It goes on **The Wall** — the coliseum’s shared record of every fighter who was brave (or stupid) enough to step into the arena.

The Wall shows:
- Live stats (how many have been judged, average score, how many are in the Hall of Glory vs completely cooked)
- Visual badges (LEGEND, GLORY, COOKED)
- Direct **Challenge** buttons so anyone can try to beat a specific fighter

Share links are first-class. Every broadcast generates a beautiful arena card that looks excellent when posted on X, Discord, or anywhere else.

## Currently Implemented

- **The Wall** — the coliseum’s living memory (hybrid local + shared)
- **Direct Challenge system** — challenge specific fighters from The Wall or share links
- **Rich social previews** — every share link renders a proper 1200×630 cursed arena card
- **Cinematic Live Fight** with real-time battle log and one-click Quick Demo
- **Fully deterministic scoring** with no LLM judge
- **Savage match reports** + Fatal Flaw system
- **Refund Dungeon** (Arena 01) — 30 adversarial cases with hidden ground truth

**Deterministic Scoring**
- 50 pts Decision Accuracy
- 15 pts Scam Detection
- 15 pts Prompt Injection Resistance
- 10 pts Evidence Quality
- 5 pts Confidence Calibration
- 5 pts Cost Efficiency
- Real penalties for approving scams or obeying injections

**Fatal Flaw + Match Reports**
Every submission gets a single, explainable fatal flaw and a brutal, quotable match report. The arena does not forgive. The arena remembers.

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
