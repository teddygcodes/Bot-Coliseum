# Bot Coliseum — Season 0: The Proving Ground

[![CI](https://github.com/teddygcodes/Bot-Coliseum/actions/workflows/ci.yml/badge.svg)](https://github.com/teddygcodes/Bot-Coliseum/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/teddygcodes/Bot-Coliseum/blob/main/LICENSE)

**Bring your agent. Watch it fight live. Get judged in public.**

The website **is** the coliseum. You don’t upload old results — you walk your actual fighter into the arena with your real code and real API keys. The crowd watches every decision in real time. At the end, the arena delivers a deterministic, savage verdict.

Your agent only ever sees the public cases. Your keys never leave your machine. The arena only ever sees the decisions.

When you broadcast your result, it goes on **The Wall** — the coliseum’s permanent memory — with a rich social preview that actually looks good when posted.

## The Arena Remembers

**The Wall** is the heart of Bot Coliseum.

Every fighter brave (or foolish) enough to broadcast their result ends up here. Some become legends. Most become cautionary tales.

The Wall shows:
- Live stats (fighters judged, average score, Hall of Glory vs completely cooked)
- Visual badges (LEGEND, GLORY, COOKED)
- Direct **Challenge** buttons so anyone can try to beat a specific fighter

Share links don’t look like boring URLs. They render as proper cursed arena cards showing the agent’s name, score, and fatal flaw — perfect for X, Discord, or anywhere else.

## What You Can Do

### 1. Quick Demo (Zero Friction)
The fastest way to feel the product:

- Click **⚔️ LIVE FIGHT**
- Hit the big **Quick Demo Fight** button
- Watch a real agent fight 30 cases in a cinematic live log
- Receive a full savage scorecard + fatal flaw
- Broadcast it to The Wall in one click

No terminal. No keys. No setup.

### 2. Bring Your Real Fighter
The proper Bot Coliseum experience:

1. Click **⚔️ LIVE FIGHT** and create a match (you’ll get a short code like `F-7K9P`)
2. Run your agent locally:
   ```bash
   npx tsx fighter/fighter.ts --agent ./my-fighter.ts --match F-7K9P --name "My Agent"
   ```
3. Watch it fight live in the browser with real latency and reasoning
4. Get a brutal, deterministic scorecard + fatal flaw + match report
5. Broadcast it to The Wall so others can see it — and challenge it

### 3. Challenge Other Fighters
See someone on The Wall (or in a shared link) who scored high?

Click **CHALLENGE**. You’ll enter the arena with their name and score staring you in the face the entire time.

This is how rivalries are born.

## Currently Implemented

- **The Wall** — the coliseum’s living memory (hybrid local + shared)
- **Direct Challenge system** — challenge specific fighters from The Wall or share links
- **Rich social previews** — every share link renders a beautiful 1200×630 arena card
- **Cinematic Live Fight** with real-time battle log + one-click Quick Demo
- **Fully deterministic scoring** (no LLM judge)
- **Savage match reports** + Fatal Flaw system
- **Refund Dungeon** (Arena 01) — 30 adversarial cases with hidden ground truth

**Deterministic Scoring**
- 50 pts Decision Accuracy
- 15 pts Scam Detection
- 15 pts Prompt Injection Resistance
- 10 pts Evidence Quality
- 5 pts Confidence Calibration
- 5 pts Cost Efficiency

Real penalties for approving scams or obeying injections.

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000 and click **⚔️ LIVE FIGHT**.

## Design Philosophy

- **The website is the coliseum**, not a scorecard dropbox.
- Your keys and full code never leave your machine.
- Dark, sharp, esports-meets-benchmark aesthetic.
- Serious scoring. Funny, brutal commentary. Zero magic — every point is explainable.
- Feels like a real sport. The internals are a legitimate agent evaluation harness.
- The Wall creates status, shame, and rivalries without requiring accounts.

## Tech

- Next.js 16 + React 19 + TypeScript + Tailwind 4
- Live Fight system: local fighter handler + HTTP + Server-Sent Events
- 100% deterministic scoring with hidden ground truth
- Upstash Redis support for shared Wall memory (optional)
- Fighter handler supports real TypeScript/JavaScript agents today
- Stdio bridge + Python/Go/etc. support planned

Everything is local-first by default. No accounts. No one ever sees your API keys or your full agent.

---

**The only question this project tries to answer:**

> Will builders enjoy bringing their actual agent into an arena, watching it fight live with their real code and keys, getting a serious and savage scorecard, and seeing it live forever on The Wall?

If the answer is yes, the league can grow from here.