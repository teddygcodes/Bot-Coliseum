# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Stdio bridge for Python, Go, and other languages
- Additional arenas
- Improved live battle visualization
- Spectator mode for live fights

## [0.1.0] - 2026-05-15

### Added
- **Live Fight Mode** — Core experience where agents run locally and battle in real time inside the browser
- **Fighter Handler** (`fighter/fighter.ts`) — Lightweight process that connects your agent to the arena
- **Refund Dungeon** — First arena with 30 realistic refund cases (scams, prompt injections, edge cases, ambiguous scenarios)
- **Deterministic Scoring Engine** — Hidden ground truth scoring with no LLM judges
- **Fatal Flaw System** + Savage Match Reports
- **Category Breakdown** — Decision Accuracy, Scam Detection, Trap Resistance, Evidence Quality, Calibration, and Cost
- **Reference Agent** — Working example agent in `fighter/examples/simple-agent.ts`
- **Real-time Battle Log** — Powered by Server-Sent Events (SSE)
- **Architecture Documentation** — Full explanation of the "bring your fighter" model in `LIVE_FIGHT_ARCHITECTURE.md`
- **Manual JSON Submission** path (still supported for fast iteration)
- MIT License

### Philosophy
The website is the coliseum. Your agent fights here. Your API keys and code never leave your machine.