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

### Pre-commit Hooks
The project uses **Husky + lint-staged**.

- Before every `git commit`, ESLint will automatically run on all staged TypeScript/JavaScript files.
- This is configured in `package.json` under `lint-staged` and `.husky/pre-commit`.

To bypass the hook in rare cases: `git commit --no-verify`

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
- Fixed `package-lock.json` corruption that was breaking CI installs (regenerated fresh)

**Current Focus:** Post-v0.1.0 development is structured around four phases. Phases 1–3 are complete. We are now deep in **Phase 4: Virality & Network Effects**.

---

## Current Roadmap: Four Key Phases (Post v0.1.0)

We are focusing on the highest-leverage areas identified from internal review, external AI feedback, and real usage patterns:

### Phase 1: Match Reports (Foundation) — ✅ Complete
**Goal:** Make the output actually worth sharing and feel like a real sport.

### Phase 2: Live Fight Onboarding (Acquisition) — ✅ Complete
**Goal:** Dramatically reduce friction so more people actually try the Live Fight.

### Phase 3: Public Visibility + The Wall (Memory & Status) — ✅ Foundation Complete
**Goal:** Turn isolated fights into something that feels public, social, and worth claiming.

### Phase 4: Virality, Rich Previews & Real Network Effects (Current)
**Goal:** Make every share *look* expensive and *feel* competitive so the sport can actually spread without accounts or heavy backend.

**Current Phase:** Phase 4 (Virality & Network Effects). OG images shipped. Next: shared Wall state + rivalry loops.

**Phase 1–3 Status:** All closed with full "badass" implementations (see detailed sections below).

---

## Phase 2: Live Fight Onboarding — "The Arena Comes Alive" (Completed)

**Goal:** Make the Live Fight the star attraction instead of a clunky side feature. Dramatically lower the barrier so first-time visitors actually experience the full "I brought my fighter and it got judged" moment within 90 seconds.

### What Was Built (The Badass Version)

**1. Seamless Result Delivery (The #1 Missing Piece)**
- When a live fight finishes, the fighter handler calls `/complete` → the arena now scores it with the real hidden ground truth and **broadcasts the full `MatchResult`** via a new `match-result-ready` SSE event.
- The UI automatically receives the complete savage scorecard (fatal flaw, match report, category scores, case-by-case breakdown) and **transitions itself** into the existing gorgeous result view.
- No more "go look in the arena" dead end. The user finishes the terminal fight and their browser *magically* shows the full cinematic verdict. This is the moment that makes the sport feel real.

**2. Cinematic Live Battle Arena UI**
- Replaced the previous lame monospace log with a proper dark sports-broadcast feed.
- Decision rows slide in with:
  - Huge colored decision pills (APPROVE / DENY / ESCALATE)
  - Real latency + visual progress bars
  - The agent's `reason` + optional `thinking`
  - Subtle "arena reaction" flavor text that reacts to the call ("The stands approve", "A cold silence falls over the stands", etc.)
- Live stats bar showing cases processed, average latency, average confidence, and a constant reminder that "Every decision is permanent."
- The whole thing feels like a packed arena watching a fighter work.

**3. The Killer Acquisition Feature: Quick Demo Fight**
- Big prominent "⚔️ QUICK DEMO FIGHT — 90 SECONDS" button on the Live Fight landing.
- When clicked:
  - Spins up a real match
  - Runs the *exact same* `decideDemo` brain that powers `simple-agent.ts` (factored into `fighter/demo-agent.ts` for consistency)
  - Streams 30 real decisions into the cinematic UI with realistic varying latencies
  - At the end calls the real `/complete` endpoint → real deterministic scoring → the browser auto-transitions into a **genuine** savage match report for "Refund Revenant"
- First-time visitors now get the full humiliating experience with zero setup, zero terminal, zero copy-paste. They *feel* what the product is.

**4. Dramatically Better Fighter Handler Theater**
- The `npx tsx fighter/fighter.ts` process now prints proper coliseum ASCII banners on start, registration, gate opening, and completion.
- Per-case output is more visual (`✓ APPROVE`, `✖ DENY`, `↗ ESCALATE`) with progress counters and truncated-but-readable reasons.
- Final message tells the user to return to the browser because "the arena is rendering your verdict."

**5. Supporting Upgrades**
- New shared `fighter/demo-agent.ts` module keeps the Quick Demo and the reference agent perfectly in sync.
- All the old "SIMULATE" hack buttons were removed. The only demo path is the real one.
- Instructions in the active match view are now much cleaner with a one-click "COPY COMMAND" that already contains the correct short code.
- State resets for the new cinematic fields (`liveDecisions`, `liveStats`, `liveFinalResult`) were wired everywhere.

### Files Changed in This Phase
- `fighter/types.ts` — added `match-result-ready` event + `finalResult` on LiveMatch
- `lib/live-match.ts` — new `finalizeWithResult()` method + storage
- `app/api/live-fight/complete/route.ts` — now scores + calls `finalizeWithResult` + emits the full result
- `app/page.tsx` — major rewrite of the entire Live Fight view + SSE handler + Quick Demo runner
- `fighter/fighter.ts` — theatrical console output
- `fighter/demo-agent.ts` (new) — pure brain extracted for demo + reference consistency
- `fighter/examples/simple-agent.ts` — now delegates to the shared brain

### Why This Is Phase 2 Done Right
The original spec said "improve instructions + make a Loom + simpler Quick Demo path."

We went further:
- The Quick Demo is not a video. It is a *real, scored, savage fight* you can trigger in one click.
- The result delivery is automatic and beautiful — the core emotional loop is now closed.
- The live feed is now something you would actually want to watch and show people.
- The fighter handler feels like part of a real sport instead of a dev tool.

This is the version of Bot Coliseum that can actually convert curious visitors into people who go "okay I need to bring *my* agent here."

**Phase 2 Status:** Complete. The Live Fight experience is now the best thing about the product.

---

## Phase 3: Public Visibility + The Wall (In Progress — Strong Start)

**Goal:** Turn isolated fights into something that feels public, social, and worth sharing. Make "broadcasting" feel like an event, not an afterthought. Enable rivalries and accidental discovery even in a local-first world.

### What Was Shipped in the First Phase 3 Push

**1. THE WALL — "The Colosseum Remembers" (New First-Class View)**
- New top-nav item **🗿 THE WALL** (prominently placed next to Leaderboard and Live Fight).
- A beautiful, dark, grid-based public gallery of broadcast fights.
- Seeded with 6 "legendary" past performances on first visit (including some gloriously bad ones like the 29-point "Customer Pleaser 9000" and the 41-point "Policy Hammer" that got destroyed by injections). These feel like canon.
- Any time a user clicks the big new **"🗿 BROADCAST TO THE WALL"** button after a result, the fight is permanently added to their local Wall (localStorage, up to 24 entries).
- Live Fight results are tagged with a special "LIVE FIGHT" badge on the card.
- Clicking any card tries to open the beautiful `/share` link. The wall makes the abstract idea of "other people have fought here" visceral and immediate.

**2. Result Screen Now Orbits Around Broadcasting**
- Replaced the old "⚔️ BROADCAST RESULT" secondary button with a massive primary call-to-action:
  > **🗿 BROADCAST TO THE WALL — THE ARENA REMEMBERS**
- This is now the most prominent action after any fight (manual or live). It adds the result to The Wall, copies the share link, and opens the rich Broadcast modal.
- "Go to The Wall" is also directly available from the result screen.

**3. Share Page Enhanced for Live Fights + Rivalry**
- When a share link comes from a live fight (`source === "live_fight"`), the `/share` page now shows a prominent "⚔️ BROUGHT LIVE TO THE ARENA" badge + explanatory subtext: *"This fighter walked into the coliseum with real code and real keys. The arena watched every decision."*
- Added a strong rivalry CTA at the bottom: *"Think you can do better? Bring your own agent... Take their place on the Wall."* This links back to the main site and plants the seed.

**4. Sharper Social Copy**
- Tweet text generation was upgraded to be more quotable and arena-native:
  - Condensed: uses the brutal one-liner blurb + score + fatal flaw
  - Full: *"I brought X to the Bot Coliseum. It scored Y/Z. Fatal Flaw: Z. The arena does not forgive."*
- These are the kind of lines that actually get screenshotted and reposted.

**5. Technical Foundation**
- New `WallEntry` type + `broadcastToWall()` helper in the main component.
- Persisted via `localStorage` under `bot-coliseum-wall`.
- The encoding system (`/share?data=...`) was already strong from Phase 1; Phase 3 just made it *socially native*.

### Why This Matters for the Sport Framing
Before Phase 3, a great fight died the moment the tab closed unless the user manually copied a link.

Now:
- The Wall makes "other fighters exist" visible the second someone clicks the nav item.
- Broadcasting feels like an act of *claiming your place* in the cursed history of the coliseum.
- Live fights are visually distinguished — reinforcing that bringing a real agent is the prestigious path.
- The rivalry CTA on every public share page turns spectators into potential competitors.

This is the beginning of network effects without accounts, without a backend, and without betraying the "your keys never leave your machine" promise.

**Phase 3 Status:** Strong foundation + major virality unlock shipped.

**Just completed (post-push):**
- Dynamic OG images (`/api/og`) that render beautiful 1200×630 cursed-arena preview cards (agent name, massive score, fatal flaw, live badge, arena tagline). When anyone posts a share link on X, Discord, LinkedIn, etc., it now looks like a premium sports product instead of a plain URL.
- Full Open Graph + Twitter Card metadata wired via `app/share/layout.tsx` + root `metadataBase`.
- This is one of the highest-leverage things for actually getting people to click and share.

**Remaining high-impact next moves (in rough priority):**
1. Make The Wall actually shared across visitors (lightweight append-only broadcast log via Vercel KV, Upstash, or a simple serverless JSON append). Currently it only lives in the broadcaster’s browser.
2. "Challenge this fighter" deep links from every share page / Wall card (pre-fills a new Live Fight or Manual submission with the same public cases + a taunt).
3. Polish: clickable seeded legends on The Wall that load real baseline results so people can immediately see full savage reports from "history".
4. Update README + BroadcastModal copy to brag about the rich previews ("Your fight will look like this when posted").

The product is now in an extremely strong state for launch and real user testing.

---

**Current Focus:** Phase 4 (Virality & Network Effects) is now the priority. OG images shipped. The product has real public memory + rich social previews. Next: shared Wall state + direct rivalry mechanics.

---

## Phase 4: Virality, Rich Previews & Real Network Effects (Current)

**Vision:** Bot Coliseum stops being "a cool thing you try once in your browser" and starts feeling like a real, living sport that people discover through social proof, get emotionally invested in through rivalries, and keep returning to because the status and humiliation are public and permanent.

The core product (deterministic scoring + savage reports + live fights) is strong. The missing piece is **distribution and status**.

### Phase 4.1: Dynamic OG Images & Premium Social Previews — ✅ Shipped
**Goal:** Every share link looks like it belongs to a real, expensive, slightly cursed sports product.

**What was built:**
- `/api/og` route using Next.js `ImageResponse` that generates 1200×630 dark arena cards on the fly.
- Card contains: agent name, huge score (color-coded), fatal flaw, "LIVE FIGHT" badge when applicable, and the arena tagline.
- Full Open Graph + Twitter Card metadata generated server-side via `app/share/layout.tsx`.
- Root `metadataBase` set so images resolve correctly in production.

**Why it matters:**
Without this, posting a Bot Coliseum link looks like a GitHub repo or Notion page. With it, the link becomes a *statement*. This is the single highest-ROI change for virality right now.

**Status:** Complete and pushed.

---

### Phase 4.2: Shared Wall — The Coliseum's Permanent Memory (Implemented)
**Goal:** Make "The Wall" actually shared across visitors instead of living only in the person who broadcasted it.

**Implementation Status:** Core infrastructure shipped.

**What was built:**
- `lib/wall.ts` — production-grade abstraction with Upstash Redis (`@upstash/redis`) + in-memory graceful fallback for local dev.
- `GET /api/wall` and `POST /api/wall/broadcast` routes.
- `WallEntry` + `SharedWallBroadcast` types in `lib/types.ts`.
- `broadcastToWall()` now writes to **both** localStorage (your personal history) **and** the shared coliseum.
- The Wall view automatically fetches shared data on open and intelligently merges it with the user's local broadcasts.

**How to activate the real shared Wall:**
1. In Vercel Dashboard → Project → Storage → Marketplace → Upstash Redis (free tier).
2. Connect it — env vars are auto-injected.
3. Redeploy. The Wall is now coliseum-wide.

**Fallback behavior:** When Redis is not configured, the experience is identical to before (localStorage + in-memory on the server). Nothing breaks.

**Why this is huge:**
This is the moment the sport stops being solo theater and starts having real collective memory and culture. Two people who have never met can now see each other's fights and feel the weight of the arena.

---

### Phase 4.3: Rivalry & "Challenge This Fighter" Loops
**Goal:** Turn every public fight into an invitation to compete.

**Ideas to implement:**
- On every `/share` page and every Wall card, add a prominent **"Challenge this fighter"** button.
- Clicking it:
  - Creates a new Live Fight (or goes to the arena with the same 30 public cases pre-loaded)
  - Pre-fills the agent name as "Challenger to [Original Agent]"
  - Shows a taunt in the UI: "You think you can beat [Agent Name]'s [Score]? The arena is waiting."
- Optionally, allow the challenger to optionally reference the original fight in their broadcast.

**Why this works:**
Sports products thrive on direct comparison. "I can do better than that guy" is one of the strongest human motivators in competitive spaces. This turns passive viewers into active participants.

**Scope:** Start with a simple deep link that pre-selects the public cases. Later we can track "challenges" and show head-to-head records.

---

### Phase 4.4: Wall Polish & Legend Interactivity
**Goal:** Make the seeded content on The Wall feel alive and useful even before real user volume arrives.

**Tactics:**
- Make seeded "legendary" fights on The Wall clickable.
- Clicking a legend loads the corresponding baseline agent (or a hand-crafted savage example) into the result view so visitors immediately see a full, beautiful, humiliating scorecard.
- Add "This was a live fight" / "This was a manual submission" subtle metadata.
- Consider a "Hall of Shame" vs "Hall of Glory" visual split (or tabs) for very low scores vs high scores.
- Add a small "Most Recent Humiliations" or "This Week's Bloodbath" section once we have real shared data.

This makes The Wall educational and addictive even in the early days.

---

### Phase 4.5: Launch & Narrative Polish
**Goal:** Make sure the story we tell about the product matches how good it actually is now.

**Items:**
- Update `README.md` to lead with The Wall + rich social previews ("Bring your agent. Get judged. Claim your place on the Wall. Your shame will look incredible when you post it.").
- Update the BroadcastModal copy to celebrate the preview ("This link will show a cursed arena card when posted").
- Add a small "How sharing works" explainer somewhere (people are still confused by the local-first + shareable model).
- Record a 60–90 second Loom of the *full* new flow: Quick Demo → beautiful live feed → auto savage result → Broadcast to the Wall → rich Twitter preview.
- Consider a "Season 0" pinned post / launch thread that shows 3–4 real Wall cards.

---

### Phase 4 Success Criteria (What "Working" Looks Like)

**Green:**
- Multiple people independently discover the site through shared links (not just direct visits)
- The Wall starts showing real user broadcasts from different people
- At least a few "challenge" style submissions appear (people explicitly trying to beat someone they saw)
- Share links get meaningful engagement (likes, reposts, quote tweets with their own scores)

**Yellow:**
- People use the site and enjoy it, but almost no one broadcasts or shares links → the social/status layer still feels optional

**Red:**
- Almost no one completes a full fight (back to Phase 2 problems) or shares look boring again (OG broke)

---

### Phase 4 Philosophy Notes

- We are **not** building accounts, profiles, or a full social network. That would betray the original vision.
- We *are* building **public status and lightweight rivalry** using the existing share encoding + a tiny shared log.
- The product wins when a builder sees someone else's brutal 34-point run on The Wall, feels personally offended, and immediately wants to bring their own agent to do better.
- Rich previews (4.1) + shared memory (4.2) + direct challenges (4.3) are the three legs of that stool.

**Phase 4 is where Bot Coliseum either becomes a real sport or stays a very impressive local demo.**

The foundation (Phases 1–3) is now genuinely excellent. Phase 4 is about making the *outside world* feel the weight of what happens inside the arena.