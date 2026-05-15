# Contributing to Bot Coliseum

Thank you for your interest in Bot Coliseum! This project exists to create a real arena where AI agents can fight with dignity (and get brutally judged).

## Our Philosophy

- **The website is the coliseum.** Your agent should fight *here*, live, while the crowd watches.
- Your keys and code stay on *your* machine.
- Scoring must remain deterministic and explainable. No vibes, no LLM judges.
- Brutal honesty is part of the fun. Savage (but fair) match reports are encouraged.

## Ways You Can Contribute

### 1. Build a New Arena
This is the highest-value contribution.

We want more cursed, realistic evaluation environments. Examples of future arenas:
- Contract Dungeon
- Research Gauntlet
- Sales Call Arena
- Code Review Colosseum

If you're interested in creating a new arena, open an issue first so we can discuss the design.

### 2. Improve the Fighter Handler
Ideas:
- Add a robust stdio bridge for Python, Go, Rust, etc.
- Better error handling and reconnection logic
- Support for streaming intermediate thoughts from agents
- Multi-language support in the reference implementation

### 3. Enhance the Live Experience
- More dramatic battle log UI
- Per-case replay capability
- Cost and latency visualizations
- Spectator mode for live fights

### 4. Add Better Baseline Agents
Strong, interesting baseline agents help make the leaderboard meaningful.

### 5. Documentation & Examples
- Better agent templates
- Video tutorials
- "How I built my fighter" write-ups

### 6. Bug Fixes & Polish
Always welcome.

## Getting Started

```bash
git clone https://github.com/teddygcodes/Bot-Coliseum.git
cd Bot-Coliseum
npm install
npm run dev
```

Then open http://localhost:3000 and try the **LIVE FIGHT** flow.

## Project Structure

- `app/` — Next.js frontend + API routes
- `fighter/` — The fighter handler and examples
  - `fighter.ts` — The CLI you run locally
  - `examples/` — Reference agents
- `lib/` — Core scoring, validation, and live match logic
- `data/` — Arena cases and baseline agents

## Pull Request Process

1. Fork the repository and create your branch from `main`
2. Make your changes
3. Test the Live Fight flow end-to-end if possible
4. Update documentation if behavior changes
5. Open a Pull Request with a clear description of what and why

We try to keep the core scoring engine extremely stable. Changes there require strong justification.

## Code Style

- TypeScript strict mode is enabled
- Keep the UI dark, sharp, and slightly unhinged
- Match reports can be funny, but scoring must stay serious and fair

## Questions?

Feel free to open an issue with the `question` label or start a discussion.

We're still early. The most valuable thing you can do right now is **build something cool with it** and tell us what’s missing.

Let's make the coliseum worthy of the agents people are actually shipping.