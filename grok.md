# grok.md — Bot Coliseum Project Memory

> This file exists so future versions of me (or other agents) can quickly understand the real state of the project, the important decisions, and what actually matters right now.

---

## Project Vision

**Core Idea:** The website is the coliseum. Builders bring their actual agents to fight live in the arena using their real code and real API keys. The arena never sees their keys or full agent logic.

**Positioning:** This is not another eval platform. It is a sport for AI agents — with coaches, fighters, fatal flaws, and savage match reports.

**Key Differentiator:** Security + Spectacle. Most agent benchmarks require either:
- Uploading your agent + keys to someone else's server, or
- Running everything locally with no audience

Bot Coliseum tries to solve both at once through the **Live Fight** model (local fighter handler + real-time streaming to the browser).

---

## Current State (as of v0.1.0)

**Shipped:**
- Refund Dungeon (30 cases)
- Deterministic scoring engine (no LLM judge)
- Fatal Flaw system + match reports
- Live Fight mode (fighter handler + SSE streaming)
- Manual JSON submission path
- Local leaderboard (localStorage)
- Reference agent + fighter handler
- `LIVE_FIGHT_ARCHITECTURE.md`

**Version:** v0.1.0 released on GitHub (May 2026)

**Tone:** "Purpose-built agents. Cursed arenas. Public humiliation." — This voice is considered correct.

---

## Key Architectural Decisions

### 1. Live Fight Model (Local Execution + Arena Spectacle)
**Decision:** Agents run on the builder's machine. The website only receives decisions + metadata via a lightweight handler.

**Why:**
- Solves the trust problem (enterprise builders will not upload keys)
- Preserves the "I brought my fighter to the coliseum" feeling
- Still allows real-time drama in the browser

**Tradeoff:** Higher UX friction (terminal + browser switching).

### 2. Dual Path System
- **Live Fight** (primary, aspirational experience)
- **Manual JSON** (fast iteration / lower friction path)

This was intentional. It lets different types of users engage at different levels of theater.

### 3. One Arena for MVP
Only Refund Dungeon exists. New arenas (Contract Dungeon, etc.) are explicitly deprioritized until the first arena proves demand.

### 4. Deterministic Scoring
Scoring must be fully explainable and replayable. No LLM-as-judge. This is non-negotiable for the "sport" framing to have credibility.

---

## Major Open Problems (from 4 AI Reviews + Internal)

These are the issues that came up repeatedly:

| Problem | Severity | Notes |
|---------|----------|-------|
| **No shareable match artifacts** | Critical | Without public match URLs or a way to publish fights, there is no audience and no virality. The "sport" currently has empty stands. |
| **Live Fight UX friction** | High | The current flow (copy code → run terminal command → switch tabs) is too clunky for first-time users. |
| **No shared/public leaderboard** | High | localStorage leaderboard means zero network effects. No rivalries can form. |
| **Match reports not deterministic** | Medium | `Math.random()` on coaching notes means the same submission can produce different reports. |
| **Evidence scoring too shallow** | Medium | Currently rewards `evidence.length >= 1` rather than correct evidence. |
| **Python support missing** | Medium | The fighter handler is TypeScript-only. This cuts off a large portion of the agent builder audience. |
| **Dataset lifetime / cheating risk** | Medium | 30 public cases + hidden ground truth in the bundle is not sustainable long-term. |

---

## Current Blockers

These are the immediate things blocking progress or a strong launch right now (as of late May 2026):

1. **No way to publish or share a completed match publicly**
   - This is the single biggest gap. Without shareable results, the sports metaphor has no audience.

2. **Live Fight onboarding friction is too high for first-time users**
   - The terminal + browser context switch + copy-paste short code is a significant barrier.

3. **Match reports are not deterministic**
   - Random coaching notes break replayability and credibility.

4. **No public visibility layer at all**
   - Everything lives in one person’s browser. There is currently zero network effect.

5. **Lack of a strong demo asset**
   - No high-quality Loom or recorded example of someone successfully running a live fight from start to finish.

---

## Recent Decisions Log

| Date       | Decision | Rationale / Context |
|------------|----------|-----------------------|
| May 2026   | Created `grok.md` as central project memory | To maintain consistent context across AI sessions and track key decisions, roadmap, and tradeoffs. |
| May 2026   | Released v0.1.0 on GitHub | First public version including Live Fight system. |
| May 2026   | Decided to maintain `grok.md` going forward | User explicitly requested ongoing updates to this file as the source of truth. |
| Post-Review | Prioritized fixing shareable results + Live Fight friction over adding new features | Based on feedback from 4 AI system reviews (Claude + 3 others). Visibility and onboarding were the strongest recurring concerns. |

---

## Near-Term Priorities (Next 1–2 Weeks)

**Goal:** Get 10–20 real external submissions and some unprompted shares.

### Must Do (High Priority)
1. **Solve visibility / sharing**
   - Add ability to publish a match (even if it's just a shareable URL or easy copy-to-X flow)
   - Consider a very lightweight public results gallery

2. **Improve Live Fight onboarding**
   - Record a high-quality 60-second Loom demo
   - Make the first successful live fight dramatically easier

3. **Make match reports deterministic + high quality**
   - Remove `Math.random()` from `generateMatchReport`
   - Audit all 4 baseline match reports for quality

4. **Fix evidence scoring**
   - Reward correct evidence, not just any evidence

### Should Do
- Add a clear "Season 0 Practice" disclaimer about the current dataset
- Improve the live battle log UI (make it more cinematic)
- Start thinking about a minimal Python stdio bridge

### Do Not Do (Yet)
- New arenas
- Accounts / auth
- Hosted agent execution
- Real-time multi-agent matches
- Discord community management
- Monetization

---

## Launch & Promotion Plan (Current Thinking)

**Primary Goal for First Push:**
Get 10–20 real external submissions + at least a few unprompted public shares of match reports within 10–14 days of promotion.

### Pre-Launch Checklist (Must Have)

- [ ] High-quality 60-second Loom video showing a full Live Fight (from creating a match to seeing the final scorecard + report)
- [ ] Deterministic match reports (remove `Math.random()`)
- [ ] Easy way to publish/share a completed match (even if basic at first)
- [ ] Improved Live Fight instructions + one-command reference agent
- [ ] Clear "Season 0 – Practice Mode" disclaimer about the current dataset
- [ ] Fixed evidence scoring logic

### Promotion Channels (Initial Wave)

- r/LocalLLaMA
- r/AI_Agents
- LangChain / CrewAI / LlamaIndex Discords
- Agent Twitter / X circles (target builders who post about their agents)
- Personal network + relevant AI newsletters

### Launch Assets Needed

- Strong hero Loom video (most important)
- Good README + getting started experience
- 1–2 handcrafted, high-quality example match reports (possibly manually written for launch)
- Clear call-to-action: “Bring your agent and get roasted”

### Success Criteria for This Launch

- **Green:** 15+ unique submissions + multiple public screenshots/shares of reports
- **Yellow:** Decent submissions but almost no public sharing → sport framing needs work
- **Red:** Very few people complete a full fight → onboarding friction is killing it

### Post-Launch Decision Framework

- If we hit Green → Double down on visibility layer + Python support + Season 1 planning
- If we hit Yellow → Focus on making match reports dramatically better and easier to share
- If we hit Red → Re-evaluate either the Live Fight UX or the fundamental value prop before building more

---

## What Not To Build (Scope Guardrails)

- Do **not** add more arenas until Refund Dungeon has proven demand
- Do **not** add accounts or profiles yet (handle-based attribution is enough)
- Do **not** chase "real-time multi-agent battles"
- Do **not** over-engineer the backend for the sake of coolness
- The Live Fight feature is currently the most tempting source of scope creep

---

## Development Workflow

### Running Locally
```bash
npm install
npm run dev
```

### Running Tests
```bash
npm test              # Watch mode
npm run test:ui       # Visual test UI
npm run test:coverage # With coverage report
```

**CI:** GitHub Actions automatically runs the full test suite, type checking, linting, and build on every push and pull request (see `.github/workflows/ci.yml`).

**Current Test Coverage (as of May 2026):**
- `lib/scoring.ts` — Core deterministic scoring logic (highly granular tests)
- `lib/validateSubmission.ts` — Input validation (structure + per-decision rules)
- `lib/share.ts` — Encoding/decoding + markdown/tweet generation

Tests are organized with nested `describe` blocks so that any failure immediately indicates which specific rule or behavior is broken.

### Testing Live Fight
1. Start the dev server
2. Create a match in the UI → get short code
3. Run the fighter handler:
   ```bash
   npx tsx fighter/fighter.ts --agent ./fighter/examples/simple-agent.ts --match F-XXXX --name "Test Agent"
   ```

### Adding a New Arena (Future)
- Create new case data in `data/`
- Build corresponding scoring logic
- Keep the public/hidden split clean
- Add corresponding tests in `tests/`

---

## Success Metrics (What "Working" Looks Like)

**Green Lights (keep building):**
- 15+ unique external submissions in first 10–14 days
- Multiple people posting unprompted match report screenshots
- At least a few builders submitting v2 of their agent after iterating

**Yellow Lights:**
- Submissions come in, but almost no one shares publicly → sport framing may not be landing

**Red Lights:**
- Almost no one completes a full fight → onboarding or value prop is broken

---

## Philosophy Notes

- The sport framing is **not** just flavor text. It is the main product.
- If the match reports aren't good, the whole thing is just an eval platform with better marketing.
- Builders have ego. The "Fatal Flaw" + public humiliation angle can be motivating if done right.
- Security (keys never leave machine) is a feature, not a constraint.

---

## Last Updated

May 2026 (after v0.1.0 launch + review of 4 AI system critiques)

**Current Status:** Post-launch. 
- Test suite added (Vitest) — 26 passing tests with good diagnostic coverage
- GitHub Actions CI configured (runs on every push/PR: type-check, lint, build, tests)

Focus is now on improving shareability (Broadcast Result) and Live Fight onboarding.