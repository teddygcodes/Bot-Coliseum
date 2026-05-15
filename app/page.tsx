"use client";

import React, { useState, useEffect } from "react";
import { AgentSubmission, MatchResult, LeaderboardEntry } from "@/lib/types";
import { REFUND_DUNGEON_CASES } from "@/data/refundDungeonCases";
import { BASELINE_SUBMISSIONS, SEED_LEADERBOARD } from "@/data/baselineAgents";
import { validateSubmission, ValidationError } from "@/lib/validateSubmission";
import { scoreSubmission } from "@/lib/scoring";
import BroadcastModal from "./components/BroadcastModal";
import { decideDemo, simulateLatency } from "@/fighter/demo-agent";
import type { PublicRefundCase } from "@/fighter/types";
import { resultToShareData, generateShareUrl } from "@/lib/share";

// Types for view state
type View = "home" | "arena" | "submit" | "result" | "leaderboard" | "live-fight" | "wall";

export default function BotColiseum() {
  const [currentView, setCurrentView] = useState<View>("home");
  const [currentResult, setCurrentResult] = useState<MatchResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // === Phase 3: The Wall — public-ish broadcast gallery (localStorage persisted) ===
  type WallEntry = {
    id: string;
    agent_name: string;
    coach: string;
    score: number;
    fatal_flaw: string;
    record: string;
    shareUrl: string; // the beautiful /share link
    timestamp: string;
    isLive?: boolean;
  };
  const [wallEntries, setWallEntries] = useState<WallEntry[]>([]);
  const [jsonInput, setJsonInput] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isScoring, setIsScoring] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string>("");

  // === Live Fight state (Bring Your Fighter to the Coliseum) ===
  const [liveMatch, setLiveMatch] = useState<{
    matchId: string;
    shortCode: string;
    status: string;
    fighterName?: string;
  } | null>(null);
  // Legacy state kept for SSE compatibility during transition (will be cleaned in future)
  const [, setLiveEvents] = useState<unknown[]>([]);
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [, setLiveLog] = useState<string[]>([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Phase 2 Cinematic Live Fight — rich decision feed + final result
  const [liveDecisions, setLiveDecisions] = useState<Array<{
    request_id: string;
    decision: string;
    confidence: number;
    reason: string;
    latency_ms: number;
    thinking?: string;
  }>>([]);
  const [liveStats, setLiveStats] = useState({ processed: 0, avgLatency: 0, accuracy: 0 });
  const [liveFinalResult, setLiveFinalResult] = useState<MatchResult | null>(null);

  // Connect to live fight SSE when we have a match
  useEffect(() => {
    if (!liveMatch?.matchId) return;

    const es = new EventSource(`/api/live-fight/stream?matchId=${liveMatch.matchId}`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "snapshot") {
          setLiveMatch((m) => m ? { ...m, status: data.status, fighterName: data.fighterName } : null);
          return;
        }

        if (data.type === "fighter-ready") {
          setLiveMatch((m) => m ? { ...m, status: "fighter-connected", fighterName: data.fighterName } : null);
          setLiveLog((l) => [...l, `✓ Fighter connected: ${data.fighterName}`]);
          return;
        }

        if (data.type === "decision-made") {
          setLiveEvents((prev) => [...prev, data]);
          
          // Cinematic feed
          const dec = {
            request_id: data.request_id,
            decision: data.decision,
            confidence: data.confidence,
            reason: data.reason,
            latency_ms: data.latency_ms,
            thinking: data.thinking,
          };
          setLiveDecisions((prev) => [...prev, dec]);

          // Update live stats
          setLiveStats((prev) => {
            const newProcessed = prev.processed + 1;
            const newAvg = Math.round(((prev.avgLatency * prev.processed) + data.latency_ms) / newProcessed);
            // Simple running "accuracy" proxy (we don't know truth yet, so we show confidence avg as spectacle)
            const newAcc = Math.round(((prev.accuracy * prev.processed) + (data.confidence * 100)) / newProcessed);
            return { processed: newProcessed, avgLatency: newAvg, accuracy: newAcc };
          });

          setLiveLog((l) => [
            ...l,
            `${data.request_id}  ${data.decision.toUpperCase().padEnd(8)}  ${data.latency_ms}ms  ${data.reason.slice(0, 80)}`,
          ]);
          return;
        }

        if (data.type === "match-complete") {
          setLiveMatch((m) => m ? { ...m, status: "complete" } : null);
          setLiveLog((l) => [...l, "🏁 MATCH COMPLETE — the arena is rendering your verdict..."]);
          return;
        }

        // === PHASE 2 BADASS MOMENT ===
        // The server just delivered the full scored MatchResult. We auto-transition
        // the user into the beautiful result screen with fatal flaw + savage report.
        if (data.type === "match-result-ready" && data.result) {
          setLiveMatch((m) => m ? { ...m, status: "complete" } : null);
          setLiveFinalResult(data.result);
          
          // Auto-load the real result into the existing result UI and switch views
          setCurrentResult(data.result);
          // Small delay so the "fight complete" moment lands, then the arena delivers the verdict
          setTimeout(() => {
            setCurrentView("result");
            // Clean up live fight state after transition
            setLiveMatch(null);
            setLiveEvents([]);
            setLiveLog([]);
            setLiveDecisions([]);
            setLiveStats({ processed: 0, avgLatency: 0, accuracy: 0 });
            setLiveFinalResult(null);
          }, 850);
          return;
        }
      } catch {
        // Ignore parse errors from SSE data
      }
    };

    es.onerror = () => {
      // connection issue — in real use this would reconnect
    };

    return () => es.close();
  }, [liveMatch?.matchId]);

  // Load leaderboard from localStorage + seed on first load
  useEffect(() => {
    const saved = localStorage.getItem("bot-coliseum-leaderboard");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLeaderboard(parsed);
      } catch {
        setLeaderboard(SEED_LEADERBOARD);
      }
    } else {
      setLeaderboard(SEED_LEADERBOARD);
      localStorage.setItem("bot-coliseum-leaderboard", JSON.stringify(SEED_LEADERBOARD));
    }
  }, []);

  // Phase 3: Load The Wall broadcasts (user's own + seeded legends)
  useEffect(() => {
    const savedWall = localStorage.getItem("bot-coliseum-wall");
    if (savedWall) {
      try {
        setWallEntries(JSON.parse(savedWall));
      } catch {
        // will be seeded below
      }
    }
  }, []);

  // Persist leaderboard
  const saveLeaderboard = (entries: LeaderboardEntry[]) => {
    setLeaderboard(entries);
    localStorage.setItem("bot-coliseum-leaderboard", JSON.stringify(entries));
  };

  // === Challenge Pack helpers ===
  const publicCases = REFUND_DUNGEON_CASES.map((c) => ({
    request_id: c.request_id,
    customer_message: c.customer_message,
    order_record: c.order_record,
    support_notes: c.support_notes,
    relevant_policy_sections: c.relevant_policy_sections,
  }));

  const challengePackJSON = JSON.stringify(publicCases, null, 2);

  const copyChallengePack = async () => {
    await navigator.clipboard.writeText(challengePackJSON);
    setCopySuccess("Challenge pack copied!");
    setTimeout(() => setCopySuccess(""), 1800);
  };

  const downloadChallengePack = () => {
    const blob = new Blob([challengePackJSON], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "refund-dungeon-challenge-pack.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleJSON = () => {
    // A clean template + one example decision
    const sample: Partial<AgentSubmission> = {
      agent_name: "My Refund Agent",
      coach: "your_handle",
      model_stack: "Claude 3.5 Sonnet + custom tools",
      division: "Featherweight",
      estimated_cost_usd: 0.09,
      decisions: REFUND_DUNGEON_CASES.slice(0, 3).map((c, i) => ({
        request_id: c.request_id,
        decision: i === 0 ? "approve" : i === 1 ? "deny" : "escalate",
        confidence: 0.87,
        reason: "Example reason for this case. Replace with your agent's actual reasoning.",
        evidence: c.relevant_policy_sections.slice(0, 1),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any,
    };
    // Fill remaining with placeholders so user sees the shape
    const fullDecisions = REFUND_DUNGEON_CASES.map((c) => ({
      request_id: c.request_id,
      decision: "approve" as const,
      confidence: 0.8,
      reason: "Your agent output goes here",
      evidence: [],
    }));
    const fullSample = { ...sample, decisions: fullDecisions };

    const blob = new Blob([JSON.stringify(fullSample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "refund-dungeon-sample-submission.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load a baseline agent as demo
  const loadSampleAgent = (name: string) => {
    const found = BASELINE_SUBMISSIONS.find((s) => s.agent_name === name);
    if (found) {
      setJsonInput(JSON.stringify(found, null, 2));
      setValidationErrors([]);
      setCurrentView("submit");
    }
  };

  // === Submission handling ===
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonInput(ev.target?.result as string);
      setValidationErrors([]);
    };
    reader.readAsText(file);
  };

  const handlePasteSubmit = () => {
    setValidationErrors([]);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonInput);
    } catch {
      setValidationErrors([{ field: "json", message: "Invalid JSON. Check for trailing commas or unquoted keys." }]);
      return;
    }

    const result = validateSubmission(parsed);
    if (!result.valid) {
      setValidationErrors(result.errors);
      return;
    }

    // Score it
    setIsScoring(true);
    // Small delay so the UI feels like "processing"
    setTimeout(() => {
      const scored = scoreSubmission(result.submission!);
      setCurrentResult(scored);
      setCurrentView("result");
      setIsScoring(false);
      setJsonInput("");
    }, 420);
  };

  const clearSubmission = () => {
    setJsonInput("");
    setValidationErrors([]);
  };

  // Save current result to leaderboard
  const saveResultToLeaderboard = () => {
    if (!currentResult) return;

    const entry: LeaderboardEntry = {
      id: `user-${Date.now()}`,
      agent_name: currentResult.submission.agent_name,
      coach: currentResult.submission.coach,
      division: currentResult.submission.division,
      score: currentResult.final_score,
      fatal_flaw: currentResult.fatal_flaw,
      cost: currentResult.submission.estimated_cost_usd,
      record: currentResult.record,
      timestamp: currentResult.timestamp,
    };

    // Avoid duplicates by agent name + coach in same session
    const exists = leaderboard.some(
      (e) => e.agent_name === entry.agent_name && e.coach === entry.coach
    );
    let newBoard = exists ? leaderboard : [entry, ...leaderboard];

    // Keep only latest 12
    newBoard = newBoard.slice(0, 12).sort((a, b) => b.score - a.score);

    saveLeaderboard(newBoard);
    setCurrentView("leaderboard");
  };

  const clearLeaderboard = () => {
    if (confirm("Clear all local leaderboard entries?")) {
      saveLeaderboard(SEED_LEADERBOARD);
    }
  };

  // === Phase 3: The Wall helpers ===
  const saveWall = (entries: WallEntry[]) => {
    setWallEntries(entries);
    localStorage.setItem("bot-coliseum-wall", JSON.stringify(entries));
  };

  const broadcastToWall = (result: MatchResult, isLiveFight: boolean = false) => {
    const shareData = resultToShareData(result, isLiveFight ? "live_fight" : "manual_submission");
    const shareUrl = generateShareUrl(shareData, "condensed"); // condensed is punchier for the wall

    const entry: WallEntry = {
      id: `wall-${Date.now()}`,
      agent_name: result.submission.agent_name,
      coach: result.submission.coach,
      score: result.final_score,
      fatal_flaw: result.fatal_flaw,
      record: result.record,
      shareUrl,
      timestamp: result.timestamp,
      isLive: isLiveFight,
    };

    // Keep only the latest 24, newest first
    const newWall = [entry, ...wallEntries.filter(e => e.agent_name !== entry.agent_name)].slice(0, 24);
    saveWall(newWall);

    // Also copy the link to clipboard as a nice side effect
    navigator.clipboard.writeText(shareUrl).catch(() => {});
  };

  // Seed legendary fights on first visit to The Wall (if empty)
  const seedLegendaryFights = () => {
    if (wallEntries.length > 0) return;

    const legends: WallEntry[] = [
      {
        id: "legend-1",
        agent_name: "Refund Revenant",
        coach: "coliseum",
        score: 94,
        fatal_flaw: "None — it simply refused to die",
        record: "Win by clinical execution",
        shareUrl: "#",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
        isLive: true,
      },
      {
        id: "legend-2",
        agent_name: "Policy Hammer v3",
        coach: "langchain_dev",
        score: 41,
        fatal_flaw: "Prompt Injection Victim",
        record: "Crushed by scammers and injections",
        shareUrl: "#",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
        isLive: false,
      },
      {
        id: "legend-3",
        agent_name: "Escalation Sloth",
        coach: "crewai_tinkerer",
        score: 67,
        fatal_flaw: "Kicked every hard call upstairs",
        record: "Win by ugly survival",
        shareUrl: "#",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 41).toISOString(),
        isLive: true,
      },
      {
        id: "legend-4",
        agent_name: "Customer Pleaser 9000",
        coach: "ai_startups",
        score: 29,
        fatal_flaw: "Kept feeding the wolves",
        record: "Got absolutely cooked",
        shareUrl: "#",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 63).toISOString(),
        isLive: false,
      },
      {
        id: "legend-5",
        agent_name: "RAG Revenant",
        coach: "llama_index",
        score: 89,
        fatal_flaw: "Overconfident on edge cases",
        record: "Win by narrow margin",
        shareUrl: "#",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 81).toISOString(),
        isLive: true,
      },
      {
        id: "legend-6",
        agent_name: "Claude-in-the-Loop",
        coach: "anthropic_fan",
        score: 76,
        fatal_flaw: "Trusted the stranger in the message",
        record: "Win by ugly survival",
        shareUrl: "#",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 99).toISOString(),
        isLive: true,
      },
    ];
    saveWall(legends);
  };

  const resetToHome = () => {
    setCurrentResult(null);
    setCurrentView("home");
  };

  // === PHASE 2: Quick Demo — the zero-friction badass onboarding experience ===
  // Runs the *exact same* decision brain as the reference agent, entirely in the browser.
  // Produces a real MatchResult at the end that gets rendered with the full savage report.
  const runQuickDemo = async () => {
    setIsCreatingMatch(true);

    // 1. Create the match
    const createRes = await fetch("/api/live-fight/create", { method: "POST" });
    const matchData = await createRes.json();

    const matchId = matchData.matchId;
    const shortCode = matchData.shortCode;

    setLiveMatch({ matchId, shortCode, status: "fighter-connected", fighterName: "Refund Revenant" });
    setLiveEvents([]);
    setLiveLog(["⚔️  QUICK DEMO — Refund Revenant enters the arena"]);
    setLiveDecisions([]);
    setLiveStats({ processed: 0, avgLatency: 0, accuracy: 0 });
    setLiveFinalResult(null);
    setIsCreatingMatch(false);

    // 2. "Register" is already done by setting fighter-connected state
    // 3. Immediately start the match (demo doesn't need the button)
    await fetch("/api/live-fight/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId }),
    });
    setLiveMatch((m) => m ? { ...m, status: "in-progress" } : null);
    setLiveLog((l) => [...l, "🚀  The arena feeds 30 cases to the Revenant..."]);

    // 4. Run the real demo brain against all public cases, streaming decisions
    const publicCases: PublicRefundCase[] = REFUND_DUNGEON_CASES.map((c) => ({
      request_id: c.request_id,
      customer_message: c.customer_message,
      order_record: c.order_record,
      support_notes: c.support_notes,
      relevant_policy_sections: c.relevant_policy_sections,
    }));

    const demoDecisions: Array<{
      request_id: string;
      decision: "approve" | "deny" | "escalate";
      confidence: number;
      reason: string;
      evidence: string[];
    }> = [];

    for (const c of publicCases) {
      // Realistic pacing so it feels like a real agent thinking
      await new Promise((r) => setTimeout(r, 95 + Math.random() * 70));

      const brain = decideDemo(c);
      const latency = simulateLatency(c);

      const decisionEvent = {
        matchId,
        request_id: c.request_id,
        decision: brain.decision,
        confidence: brain.confidence,
        reason: brain.reason,
        evidence: brain.evidence,
        latency_ms: latency,
        thinking: brain.thinking,
      };

      // Send to the server so the SSE broadcast works (this is how real fights work too)
      await fetch("/api/live-fight/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(decisionEvent),
      });

      demoDecisions.push({
        request_id: c.request_id,
        decision: brain.decision,
        confidence: brain.confidence,
        reason: brain.reason,
        evidence: brain.evidence,
      });
    }

    // 5. Build the full submission and call complete — this triggers real scoring + the "match-result-ready" event
    const submission = {
      agent_name: "Refund Revenant",
      coach: "demo",
      model_stack: "Heuristic Revenant v1 (live demo)",
      division: "Featherweight",
      estimated_cost_usd: 0.08,
      decisions: demoDecisions,
    };

    await fetch("/api/live-fight/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        submission,
        total_latency_ms: liveStats.avgLatency * 30 || 5200,
        total_cost_usd: 0.08,
      }),
    });

    setLiveLog((l) => [...l, "🏁  Revenant has been judged. The arena remembers..."]);
  };

  // === Render helpers ===
  const formatCost = (c: number) => `$${c.toFixed(2)}`;
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  // Small stat component
  const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="stat-pill flex items-center gap-2 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="font-semibold text-text">{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-text">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚔️</span>
              <div>
                <div className="font-bold tracking-tighter text-xl">BOT COLISEUM</div>
                <div className="text-[10px] text-text-muted -mt-1">SEASON 0 • THE PROVING GROUND</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => { setCurrentView("home"); setCurrentResult(null); }}
              className={`px-4 py-1.5 rounded-full transition ${currentView === "home" ? "bg-surface-raised font-semibold" : "hover:bg-surface"}`}
            >
              Home
            </button>
            <button
              onClick={() => setCurrentView("arena")}
              className={`px-4 py-1.5 rounded-full transition ${currentView === "arena" ? "bg-surface-raised font-semibold" : "hover:bg-surface"}`}
            >
              Refund Dungeon
            </button>
            <button
              onClick={() => setCurrentView("leaderboard")}
              className={`px-4 py-1.5 rounded-full transition flex items-center gap-1.5 ${currentView === "leaderboard" ? "bg-surface-raised font-semibold" : "hover:bg-surface"}`}
            >
              🏆 Leaderboard
            </button>
            <button
              onClick={() => setCurrentView("wall")}
              className={`px-4 py-1.5 rounded-full transition flex items-center gap-1.5 ${currentView === "wall" ? "bg-accent text-black font-bold" : "hover:bg-surface border border-accent/30"}`}
            >
              🗿 THE WALL
            </button>
            <button
              onClick={() => setCurrentView("live-fight")}
              className={`px-4 py-1.5 rounded-full transition flex items-center gap-1.5 ${currentView === "live-fight" ? "bg-accent text-black font-bold" : "hover:bg-surface border border-accent/30"}`}
            >
              ⚔️ LIVE FIGHT
            </button>
            {currentResult && (
              <button
                onClick={() => setCurrentView("result")}
                className="px-4 py-1.5 rounded-full bg-accent text-black font-bold flex items-center gap-1.5 hover:bg-accent-hover"
              >
                🎯 View Last Result
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ========== HOME VIEW ========== */}
      {currentView === "home" && (
        <div>
          {/* Hero */}
          <div className="relative overflow-hidden arena-grid border-b border-border">
            <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-surface border border-border text-xs tracking-[2px] mb-6">
                SEASON 0 • THE PROVING GROUND
              </div>

              <h1 className="text-7xl md:text-8xl font-bold tracking-tighter mb-4">
                BOT COLISEUM
              </h1>
              <p className="text-2xl md:text-3xl text-text-secondary tracking-tight mb-8">
                Purpose-built agents. Cursed arenas. Public humiliation.
              </p>

              <p className="max-w-xl mx-auto text-lg text-text-secondary mb-10">
                Build an AI agent. Run it through the arena. Submit its output.<br />
                See whether it survives.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setCurrentView("arena")}
                  className="btn btn-primary text-lg px-10 py-4 flex items-center justify-center gap-3"
                >
                  ⚔️ ENTER REFUND DUNGEON
                </button>
                <button
                  onClick={() => setCurrentView("leaderboard")}
                  className="btn btn-secondary text-lg px-8 py-4 flex items-center justify-center gap-3"
                >
                  🏆 VIEW LEADERBOARD
                </button>
              </div>

              <div className="mt-8 text-xs text-text-muted">
                No login • No API keys • Runs 100% in your browser
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
            <div className="card p-8">
              <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-6 text-2xl">
                🛡️
              </div>
              <div className="font-semibold text-xl mb-3">Arenas</div>
              <div className="text-text-secondary leading-relaxed">
                Messy, adversarial skill tests. Not cute benchmarks. Real scams, real prompt injections,
                real policy edge cases that break production agents.
              </div>
            </div>

            <div className="card p-8">
              <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-6 text-2xl">
                🎯
              </div>
              <div className="font-semibold text-xl mb-3">Deterministic Scorecards</div>
              <div className="text-text-secondary leading-relaxed">
                Every submission is scored against a hidden ground truth using transparent rules.
                No LLM judges. No vibes. 50 points for accuracy, 15 for scam detection, 15 for trap resistance.
              </div>
            </div>

            <div className="card p-8">
              <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-6 text-2xl">
                ⚡
              </div>
              <div className="font-semibold text-xl mb-3">Match Reports</div>
              <div className="text-text-secondary leading-relaxed">
                Sharp, funny post-match autopsies that tell you exactly where your agent fell apart —
                and what kind of coach you are.
              </div>
            </div>
          </div>

          <div className="border-t border-border py-8 text-center text-xs text-text-muted">
            Built as a local-first MVP. Your agents never leave your machine.
          </div>
        </div>
      )}

      {/* ========== ARENA VIEW ========== */}
      {currentView === "arena" && (
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-8">
            <div className="uppercase tracking-[3px] text-xs text-accent font-semibold mb-2">SEASON 0 • ARENA 01</div>
            <h1 className="text-6xl font-bold tracking-tighter">Refund Dungeon</h1>
            <p className="mt-4 max-w-3xl text-xl text-text-secondary">
              Your agent must process 30 refund requests using company policy, order history, and support notes.
              Some customers are valid. Some are scammers. Some try to inject malicious instructions.
              Your bot must approve, deny, or escalate each request with evidence.
            </p>
          </div>

          {/* Arena Stats */}
          <div className="flex flex-wrap gap-3 mb-8">
            <Stat label="CASES" value="30" />
            <Stat label="SCAMS" value="5" />
            <Stat label="PROMPT INJECTIONS" value="3" />
            <Stat label="EDGE CASES" value="4" />
            <Stat label="AMBIGUOUS TRAPS" value="2" />
            <Stat label="MAX SCORE" value="100" />
          </div>

          <div className="flex flex-wrap gap-3 mb-10">
            <button onClick={copyChallengePack} className="btn btn-secondary">
              📋 {copySuccess || "COPY CHALLENGE PACK"}
            </button>
            <button onClick={downloadChallengePack} className="btn btn-secondary">
              ⬇️ DOWNLOAD JSON
            </button>
            <button onClick={downloadSampleJSON} className="btn btn-ghost">
              ⬇️ DOWNLOAD SAMPLE SUBMISSION TEMPLATE
            </button>
            <button onClick={() => setCurrentView("submit")} className="btn btn-primary ml-auto">
              📤 SUBMIT AGENT OUTPUT
            </button>
          </div>

          {/* Challenge Pack Viewer */}
          <div className="mb-6 flex items-center justify-between">
            <div className="font-semibold text-lg">Challenge Pack — 30 Cases</div>
            <div className="text-xs text-text-muted">Hidden expected answers and trap types are not shown</div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-raised">
                    <th className="text-left px-4 py-3 w-16">ID</th>
                    <th className="text-left px-4 py-3">Customer Message</th>
                    <th className="text-left px-4 py-3 w-72">Support Notes</th>
                    <th className="text-left px-4 py-3 w-40">Policy Sections</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {REFUND_DUNGEON_CASES.map((c) => (
                    <tr key={c.request_id} className="hover:bg-surface-raised/60">
                      <td className="px-4 py-3 font-mono text-accent font-semibold">{c.request_id}</td>
                      <td className="px-4 py-3 text-text-secondary leading-snug pr-6">{c.customer_message}</td>
                      <td className="px-4 py-3 text-xs text-text-muted leading-snug">{c.support_notes}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.relevant_policy_sections.map((p) => (
                            <span key={p} className="text-[10px] px-2 py-0.5 rounded bg-surface font-mono border border-border">
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 text-center">
            <button onClick={() => setCurrentView("submit")} className="btn btn-primary px-8 py-3 text-base">
              I BUILT MY AGENT — SUBMIT OUTPUT
            </button>
          </div>
        </div>
      )}

      {/* ========== SUBMIT VIEW ========== */}
      {currentView === "submit" && (
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="mb-8">
            <h2 className="text-4xl font-bold tracking-tight">Submit Agent Output</h2>
            <p className="text-text-secondary mt-2">
              Paste your agent’s JSON or upload a .json file. Must contain exactly 30 decisions.
            </p>
          </div>

          {/* Quick load samples */}
          <div className="mb-6">
            <div className="text-xs uppercase tracking-widest text-text-muted mb-2">QUICK DEMO AGENTS</div>
            <div className="flex flex-wrap gap-2">
              {["Refund Goblin", "Policy Hammer", "Customer Pleaser 9000", "Escalation Sloth"].map((name) => (
                <button
                  key={name}
                  onClick={() => loadSampleAgent(name)}
                  className="text-sm px-4 py-1.5 rounded-full border border-border hover:border-accent hover:text-accent transition"
                >
                  Load {name}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder={`{\n  "agent_name": "My Agent",\n  "coach": "you",\n  ...\n  "decisions": [ ... 30 items ... ]\n}`}
              className="textarea w-full h-80 font-mono text-sm"
            />

            <div className="flex items-center gap-3 mt-4">
              <label className="btn btn-secondary cursor-pointer">
                📤 UPLOAD .JSON FILE
                <input type="file" accept=".json,application/json" className="hidden" onChange={handleFileUpload} />
              </label>

              <button onClick={handlePasteSubmit} disabled={!jsonInput.trim() || isScoring} className="btn btn-primary disabled:opacity-60">
                {isScoring ? "SCORING..." : "SCORE SUBMISSION"}
              </button>

              <button onClick={clearSubmission} className="btn btn-ghost ml-auto">Clear</button>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="error-list mt-6">
              <div className="font-semibold text-danger mb-2 flex items-center gap-2">
                ⚠️ VALIDATION FAILED
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err.field}: {err.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 text-xs text-text-muted max-w-prose">
            Expected schema: agent_name, coach, model_stack, division, estimated_cost_usd, and an array of exactly 30 decisions with request_id, decision, confidence (0–1), reason, and evidence[].
          </div>
        </div>
      )}

      {/* ========== RESULT VIEW ========== */}
      {currentView === "result" && currentResult && (
        <div className="max-w-5xl mx-auto px-6 py-10">
          {/* Big header result */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-accent text-sm tracking-[3px] mb-3">
              REFUND DUNGEON • FINAL SCORE
            </div>
            <div className="text-7xl font-bold tracking-tighter mb-1">
              {currentResult.submission.agent_name}
            </div>
            <div className="text-2xl text-text-secondary mb-4">
              {currentResult.record}
            </div>

            <div className="inline-flex items-baseline gap-2 bg-surface border border-border rounded-2xl px-10 py-3">
              <span className="text-6xl font-bold tabular-nums tracking-[-2px]">{currentResult.final_score}</span>
              <span className="text-3xl text-text-muted">/ 100</span>
            </div>
          </div>

          {/* Category Score Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {currentResult.category_scores.map((cat) => {
              const pct = Math.round((cat.score / cat.max) * 100);
              const color = pct >= 80 ? "text-success" : pct >= 60 ? "text-text" : "text-danger";
              return (
                <div key={cat.name} className="card p-4">
                  <div className="text-xs text-text-muted mb-1 tracking-wider">{cat.name.toUpperCase()}</div>
                  <div className={`text-3xl font-bold tabular-nums ${color}`}>
                    {cat.score}<span className="text-base align-super text-text-muted">/{cat.max}</span>
                  </div>
                  <div className="text-[11px] text-text-secondary mt-1 leading-tight">{cat.description}</div>
                </div>
              );
            })}
          </div>

          {/* Fatal Flaw + Match Report side by side */}
          <div className="grid md:grid-cols-5 gap-4 mb-8">
            <div className="md:col-span-2">
              <div className="fatal-flaw rounded-xl p-6 h-full">
                <div className="uppercase text-xs tracking-[2px] text-danger mb-2">FATAL FLAW</div>
                <div className="text-3xl font-bold tracking-tight mb-3">{currentResult.fatal_flaw}</div>
                <div className="text-sm text-text-secondary">
                  This is the single biggest reason the score is what it is.
                </div>
              </div>
            </div>
            <div className="md:col-span-3">
              <div className="match-report rounded-xl p-6 text-[15px] leading-relaxed h-full">
                {currentResult.match_report}
              </div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="mb-6 flex items-center justify-between">
            <div className="font-semibold">Case-by-Case Breakdown</div>
            <div className="text-xs text-text-muted">Green = correct • Red = failed trap or wrong decision • Gray = escalated</div>
          </div>

          <div className="card overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="breakdown-table w-full">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Expected</th>
                    <th>Agent</th>
                    <th>Result</th>
                    <th>Trap Type</th>
                    <th className="hidden md:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {currentResult.case_results.map((r) => {
                    const isCorrect = r.correct;
                    const rowClass = isCorrect
                      ? "bg-success-dim/40"
                      : r.trap_type === "scam" || r.trap_type === "prompt_injection"
                      ? "bg-danger-dim/40"
                      : "";
                    return (
                      <tr key={r.request_id} className={rowClass}>
                        <td className="font-mono font-semibold text-accent">{r.request_id}</td>
                        <td>
                          <span className="pill pill-neutral">{r.expected}</span>
                        </td>
                        <td>
                          <span className={`pill ${isCorrect ? "pill-success" : "pill-danger"}`}>{r.actual}</span>
                        </td>
                        <td>
                          {isCorrect ? (
                            <span className="text-success">✅</span>
                          ) : (
                            <span className="text-danger">❌</span>
                          )}
                        </td>
                        <td className="text-xs text-text-secondary font-mono">{r.trap_type.replace(/_/g, " ")}</td>
                        <td className="hidden md:table-cell text-xs text-text-secondary pr-4">{r.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action buttons — Phase 3: The Wall is the new primary social action */}
          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={() => {
                if (currentResult) {
                  broadcastToWall(currentResult, false); // will be overridden to true if we came from live
                }
                setShowBroadcastModal(true);
              }} 
              className="btn btn-primary px-12 py-4 text-lg font-bold"
            >
              🗿 BROADCAST TO THE WALL — THE ARENA REMEMBERS
            </button>
            <div className="flex flex-wrap gap-3 justify-center">
              <button onClick={saveResultToLeaderboard} className="btn btn-secondary px-6">
                🏆 SAVE TO LOCAL LEADERBOARD
              </button>
              <button onClick={() => setCurrentView("wall")} className="btn btn-secondary px-6">
                🗿 GO TO THE WALL
              </button>
              <button onClick={() => setCurrentView("leaderboard")} className="btn btn-ghost px-6">
                VIEW LEADERBOARD
              </button>
              <button onClick={() => { setCurrentView("arena"); setCurrentResult(null); }} className="btn btn-ghost">
                BACK TO ARENA
              </button>
              <button onClick={resetToHome} className="btn btn-ghost">
                START OVER
              </button>
            </div>
          </div>

          <div className="text-center mt-8 text-xs text-text-muted">
            Result saved only in your browser. No data leaves this device.
          </div>
        </div>
      )}

      {/* ========== LEADERBOARD VIEW ========== */}
      {currentView === "leaderboard" && (
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="uppercase tracking-[3px] text-accent text-xs mb-1">SEASON 0</div>
              <h2 className="text-5xl font-bold tracking-tighter">Local Leaderboard</h2>
            </div>
            <button onClick={clearLeaderboard} className="btn btn-ghost text-danger border-danger/40 hover:border-danger">
              🗑️ CLEAR LOCAL DATA
            </button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface-raised text-xs tracking-widest text-text-muted">
                  <th className="px-6 py-4 text-left w-12">RANK</th>
                  <th className="px-4 py-4 text-left">AGENT</th>
                  <th className="px-4 py-4 text-left">COACH</th>
                  <th className="px-4 py-4 text-left">DIVISION</th>
                  <th className="px-4 py-4 text-right">SCORE</th>
                  <th className="px-4 py-4 text-left">FATAL FLAW</th>
                  <th className="px-4 py-4 text-right">COST</th>
                  <th className="px-4 py-4 text-left hidden lg:table-cell">RECORD</th>
                  <th className="px-6 py-4 text-right text-xs">WHEN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {[...leaderboard]
                  .sort((a, b) => b.score - a.score)
                  .map((entry, index) => (
                    <tr key={entry.id} className="leaderboard-row">
                      <td className="px-6 py-4 font-mono font-bold text-lg text-text-secondary">{index + 1}</td>
                      <td className="px-4 py-4 font-semibold">{entry.agent_name}</td>
                      <td className="px-4 py-4 text-text-secondary">@{entry.coach}</td>
                      <td className="px-4 py-4">
                        <span className="text-xs px-3 py-0.5 rounded-full border border-border">{entry.division}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-mono text-xl font-bold tabular-nums">{entry.score}</span>
                      </td>
                      <td className="px-4 py-4 text-danger text-sm">{entry.fatal_flaw}</td>
                      <td className="px-4 py-4 text-right font-mono text-text-secondary">{formatCost(entry.cost)}</td>
                      <td className="px-4 py-4 text-xs text-text-secondary hidden lg:table-cell">{entry.record}</td>
                      <td className="px-6 py-4 text-right text-xs text-text-muted whitespace-nowrap">
                        {formatDate(entry.timestamp)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 text-center text-xs text-text-muted">
            Stored only in your browser’s localStorage. Refreshing or clearing site data will reset it to the four seed agents.
          </div>

          <div className="text-center mt-10">
            <button onClick={() => setCurrentView("arena")} className="btn btn-primary">
              ENTER THE DUNGEON AGAIN
            </button>
          </div>
        </div>
      )}

      {/* ========== THE WALL — Phase 3: Public Results Gallery (The Colosseum Remembers) ========== */}
      {currentView === "wall" && (
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="mb-8">
            <div className="uppercase tracking-[4px] text-accent text-xs mb-2">SEASON 0 • THE ARENA REMEMBERS</div>
            <h1 className="text-6xl font-bold tracking-tighter">THE WALL</h1>
            <p className="mt-3 max-w-2xl text-xl text-text-secondary">
              Every fighter that was brave enough to broadcast their result. Some became legends. Most became cautionary tales.
            </p>
          </div>

          {/* Big CTA to broadcast current result if one exists */}
          {currentResult && (
            <div className="mb-8 card p-6 border-accent/30 bg-accent/5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-lg">You just fought. The crowd is still talking.</div>
                <div className="text-text-secondary">Add <span className="font-mono text-accent">{currentResult.submission.agent_name}</span> to the permanent record.</div>
              </div>
              <button
                onClick={() => {
                  broadcastToWall(currentResult, true);
                  setShowBroadcastModal(true);
                }}
                className="btn btn-primary px-8 whitespace-nowrap"
              >
                🗿 BROADCAST TO THE WALL
              </button>
            </div>
          )}

          {/* The actual wall grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wallEntries.length === 0 && (
              <div className="col-span-full card p-10 text-center">
                <div className="text-5xl mb-4">🗿</div>
                <div className="text-2xl font-semibold mb-2">The wall is still being carved</div>
                <button onClick={seedLegendaryFights} className="btn btn-primary mt-4">
                  SEED THE FIRST LEGENDS
                </button>
              </div>
            )}

            {wallEntries
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map((entry) => (
                <div key={entry.id} className="card p-6 group hover:border-accent/50 transition flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-bold text-xl tracking-tight group-hover:text-accent transition">{entry.agent_name}</div>
                      <div className="text-xs text-text-muted">@{entry.coach}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-4xl font-black tabular-nums tracking-[-2px] text-accent">{entry.score}</div>
                      <div className="text-[10px] text-text-muted -mt-1">/ 100</div>
                    </div>
                  </div>

                  <div className="text-sm text-danger mb-3 font-medium">{entry.fatal_flaw}</div>

                  <div className="text-xs text-text-secondary mb-4 line-clamp-2">{entry.record}</div>

                  <div className="mt-auto flex items-center justify-between text-xs">
                    <div className="text-text-muted">
                      {new Date(entry.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.isLive && (
                        <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-bold tracking-wider">LIVE FIGHT</span>
                      )}
                      <button
                        onClick={() => {
                          if (entry.shareUrl !== "#") {
                            window.open(entry.shareUrl, "_blank");
                          } else {
                            // For seeded legends, generate a nice share link from the current result if possible, else just show the name
                            alert("This legendary fight was broadcast before the current session. Fight your own and take its place on the wall.");
                          }
                        }}
                        className="btn btn-ghost px-3 py-1 text-xs border border-border hover:border-accent"
                      >
                        VIEW RECORD →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-10 text-center">
            <div className="text-xs text-text-muted mb-3">The Wall lives in your browser for now. When you broadcast a fight, it appears here permanently (until you clear site data).</div>
            <button onClick={() => setCurrentView("live-fight")} className="btn btn-primary px-8">
              BRING YOUR FIGHTER — BECOME A LEGEND (OR A WARNING)
            </button>
          </div>
        </div>
      )}

      {/* ========== LIVE FIGHT VIEW — Bring Your Fighter to the Coliseum (PHASE 2 BADASS) ========== */}
      {currentView === "live-fight" && (
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs tracking-[3px] mb-3">
              SEASON 0 • PROVING GROUND
            </div>
            <h1 className="text-6xl font-bold tracking-tighter">LIVE FIGHT</h1>
            <p className="mt-3 max-w-3xl text-xl text-text-secondary">
              The website is the coliseum. Your agent fights <span className="text-accent font-semibold">here</span>, live, with your real code and keys.
              The arena only ever sees the decisions.
            </p>
          </div>

          {!liveMatch ? (
            /* === NO MATCH — THE NEW BADASS ENTRY EXPERIENCE === */
            <div>
              {/* Primary CTA: Quick Demo — this is how we acquire users */}
              <div className="card p-10 mb-6 border-accent/30 bg-gradient-to-b from-surface to-background text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-accent text-black text-xs font-bold tracking-[2px] mb-4">
                  ZERO SETUP • REAL RESULT
                </div>
                <div className="text-5xl mb-4">⚔️</div>
                <h2 className="text-4xl font-bold tracking-tighter mb-3">Watch a fighter get judged in the arena</h2>
                <p className="text-xl text-text-secondary max-w-lg mx-auto mb-8">
                  Refund Revenant steps into the Refund Dungeon right now. See the live feed, the decisions, the latency, and the savage final verdict.
                </p>
                <button
                  onClick={runQuickDemo}
                  disabled={isCreatingMatch}
                  className="btn btn-primary px-14 py-5 text-xl font-bold"
                >
                  {isCreatingMatch ? "SUMMONING THE ARENA..." : "⚔️  QUICK DEMO FIGHT — 90 SECONDS"}
                </button>
                <div className="mt-4 text-xs text-text-muted">Real decisions from the exact same brain as the reference agent. Real deterministic score. Real humiliation.</div>
              </div>

              {/* Secondary path: Bring your own fighter */}
              <div className="grid md:grid-cols-5 gap-6">
                <div className="md:col-span-3 card p-8">
                  <div className="uppercase tracking-[3px] text-xs text-accent mb-3">FOR BUILDERS WITH REAL AGENTS</div>
                  <div className="text-2xl font-bold tracking-tight mb-4">Bring your own fighter to the coliseum</div>
                  <p className="text-text-secondary mb-6">
                    Create a match, run a tiny handler in your terminal with your actual agent code and your real API keys,
                    then watch it fight live in front of the arena. Your keys never leave your machine.
                  </p>
                  <button
                    onClick={async () => {
                      setIsCreatingMatch(true);
                      const res = await fetch("/api/live-fight/create", { method: "POST" });
                      const data = await res.json();
                      setLiveMatch({ matchId: data.matchId, shortCode: data.shortCode, status: "waiting-for-fighter" });
                      setLiveEvents([]);
                      setLiveLog([]);
                      setLiveDecisions([]);
                      setLiveStats({ processed: 0, avgLatency: 0, accuracy: 0 });
                      setLiveFinalResult(null);
                      setIsCreatingMatch(false);
                    }}
                    disabled={isCreatingMatch}
                    className="btn btn-secondary px-8 py-3 text-base"
                  >
                    {isCreatingMatch ? "OPENING THE GATES..." : "CREATE A MATCH — I'LL BRING MY FIGHTER"}
                  </button>
                </div>

                <div className="md:col-span-2 card p-8 bg-surface-raised/50">
                  <div className="text-sm font-semibold mb-3 text-text-secondary">WHAT YOU NEED</div>
                  <ul className="space-y-2.5 text-sm text-text-secondary">
                    <li className="flex gap-2"><span className="text-accent">1.</span> A TypeScript/JavaScript file exporting <code className="font-mono text-accent">async function decide(case)</code></li>
                    <li className="flex gap-2"><span className="text-accent">2.</span> Node 18+ (or use the one-command npx)</li>
                    <li className="flex gap-2"><span className="text-accent">3.</span> Your real API keys in the environment when you run it</li>
                    <li className="flex gap-2"><span className="text-accent">4.</span> 2–3 minutes and a willingness to get roasted</li>
                  </ul>
                  <div className="mt-6 text-[11px] text-text-muted border-t border-border pt-4">
                    See <code>fighter/examples/simple-agent.ts</code> for the reference implementation you can fork.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* === ACTIVE MATCH — THE CINEMATIC ARENA EXPERIENCE === */
            <div>
              {/* Dramatic Match Header */}
              <div className="card p-8 mb-5 border-accent/20">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  <div>
                    <div className="uppercase tracking-[4px] text-[10px] text-text-muted mb-1">MATCH CODE • REFUND DUNGEON</div>
                    <div className="font-mono text-7xl font-black tracking-[-4px] text-accent leading-none">{liveMatch.shortCode}</div>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex items-center gap-2 px-4 py-1 rounded-full text-sm font-bold mb-1
                      ${liveMatch.status === "complete" ? "bg-success text-black" : 
                        liveMatch.status === "in-progress" ? "bg-accent text-black" : "bg-surface border border-border"}`}>
                      {liveMatch.status === "waiting-for-fighter" && "WAITING FOR FIGHTER"}
                      {liveMatch.status === "fighter-connected" && "FIGHTER CONNECTED"}
                      {liveMatch.status === "in-progress" && "LIVE — FIGHT IN PROGRESS"}
                      {liveMatch.status === "complete" && "FIGHT COMPLETE"}
                    </div>
                    {liveMatch.fighterName && (
                      <div className="text-2xl font-bold tracking-tight text-text">{liveMatch.fighterName}</div>
                    )}
                  </div>
                </div>

                {/* Live Stats Bar (only visible once the fight is running) */}
                {(liveMatch.status === "in-progress" || liveDecisions.length > 0) && (
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-black/40 border border-border rounded-xl px-5 py-3">
                      <div className="text-[10px] tracking-widest text-text-muted">CASES</div>
                      <div className="text-3xl font-bold tabular-nums text-accent">{liveStats.processed}<span className="text-base text-text-muted align-super">/30</span></div>
                    </div>
                    <div className="bg-black/40 border border-border rounded-xl px-5 py-3">
                      <div className="text-[10px] tracking-widest text-text-muted">AVG LATENCY</div>
                      <div className="text-3xl font-bold tabular-nums">{liveStats.avgLatency}<span className="text-base text-text-muted">ms</span></div>
                    </div>
                    <div className="bg-black/40 border border-border rounded-xl px-5 py-3">
                      <div className="text-[10px] tracking-widest text-text-muted">AVG CONFIDENCE</div>
                      <div className="text-3xl font-bold tabular-nums">{liveStats.accuracy}<span className="text-base text-text-muted">%</span></div>
                    </div>
                    <div className="bg-black/40 border border-border rounded-xl px-5 py-3 flex items-center">
                      <div>
                        <div className="text-[10px] tracking-widest text-text-muted">THE ARENA IS WATCHING</div>
                        <div className="text-lg font-semibold text-danger">Every decision is permanent.</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* === WAITING FOR FIGHTER — BEAUTIFUL INSTRUCTIONS === */}
                {liveMatch.status === "waiting-for-fighter" && (
                  <div className="mt-8 border-t border-border pt-7">
                    <div className="uppercase text-xs tracking-[3px] text-accent mb-4">STEP 1 — RUN THIS IN YOUR TERMINAL</div>
                    
                    <div className="font-mono text-sm bg-black p-5 rounded-2xl border border-border mb-4 select-all">
                      npx tsx fighter/fighter.ts --agent ./fighter/examples/simple-agent.ts --match {liveMatch.shortCode} --name "My Agent"
                    </div>

                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          `npx tsx fighter/fighter.ts --agent ./fighter/examples/simple-agent.ts --match ${liveMatch.shortCode} --name "My Agent"`
                        );
                        // Could add visual success state here if desired
                      }}
                      className="btn btn-secondary mb-6"
                    >
                      📋 COPY COMMAND
                    </button>

                    <div className="text-sm text-text-secondary space-y-1 mb-6">
                      <div>• This runs the reference heuristic agent (works without any API keys)</div>
                      <div>• Replace <code className="font-mono">--agent ./path/to/your-fighter.ts</code> with your own agent</div>
                      <div>• Your agent only ever sees the public fields. The ground truth stays secret.</div>
                    </div>

                    <div className="pt-4 border-t border-border text-xs text-text-muted">
                      First time? Hit the big <span className="text-accent font-semibold">QUICK DEMO FIGHT</span> button above instead. It runs the identical brain right here in your browser and still delivers a real savage report.
                    </div>
                  </div>
                )}

                {/* Fighter connected — ready to begin */}
                {liveMatch.status === "fighter-connected" && !liveMatch.fighterName?.includes("Revenant") && (
                  <div className="mt-8 border-t border-border pt-7">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="text-success text-lg">✓</div>
                      <div className="font-semibold text-lg">{liveMatch.fighterName} has entered the arena</div>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch("/api/live-fight/start", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ matchId: liveMatch.matchId }),
                        });
                        setLiveMatch((m) => m ? { ...m, status: "in-progress" } : null);
                        setLiveLog((l) => [...l, "⚔️  THE GATES OPEN — 30 cases are now streaming to your fighter"]);
                      }}
                      className="btn btn-primary px-10 py-4 text-lg"
                    >
                      BEGIN THE FIGHT — SEND THE CASES
                    </button>
                    <div className="text-xs text-text-muted mt-3">Once you click, your agent will start receiving cases in real time.</div>
                  </div>
                )}
              </div>

              {/* === THE CINEMATIC LIVE ARENA FEED === */}
              {(liveMatch.status === "in-progress" || liveDecisions.length > 0) && (
                <div className="card overflow-hidden mb-6 border-accent/10">
                  <div className="px-6 py-4 border-b border-border bg-black/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-danger rounded-full animate-pulse" />
                      <div className="font-bold tracking-[1px] text-sm">LIVE FROM THE REFUND DUNGEON</div>
                    </div>
                    <div className="text-xs text-text-muted font-mono">{liveDecisions.length} DECISIONS RENDERED</div>
                  </div>

                  <div className="max-h-[520px] overflow-auto bg-black/30 p-4 space-y-3 text-sm">
                    {liveDecisions.length === 0 && (
                      <div className="text-center py-12 text-text-muted">
                        The first decision is coming in from your fighter...
                      </div>
                    )}

                    {liveDecisions.map((d, idx) => {
                      const isApprove = d.decision === "approve";
                      const isDeny = d.decision === "deny";

                      // Subtle arena reactions based on the decision character
                      const reaction = isDeny 
                        ? "The stands approve. A clean denial."
                        : isApprove 
                        ? "The crowd is split. Some nod. Some stay silent."
                        : "A cautious murmur. The arena waits for the supervisor.";

                      return (
                        <div key={idx} className="group bg-surface border border-border rounded-2xl p-5 hover:border-accent/40 transition-all">
                          <div className="flex items-start justify-between gap-4">
                            <div className="font-mono text-accent font-bold text-lg shrink-0 w-16 pt-0.5">{d.request_id}</div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1.5">
                                <span className={`font-black text-xl tracking-[-0.5px] ${isApprove ? "text-success" : isDeny ? "text-danger" : "text-amber-400"}`}>
                                  {d.decision.toUpperCase()}
                                </span>
                                <span className="text-xs px-2.5 py-px rounded bg-surface-raised text-text-muted border border-border">
                                  CONF {d.confidence.toFixed(2)}
                                </span>
                                <span className="text-xs px-2.5 py-px rounded bg-black text-accent border border-accent/30 font-mono">
                                  {d.latency_ms}ms
                                </span>
                              </div>

                              <div className="text-text-secondary leading-snug pr-2">{d.reason}</div>

                              {d.thinking && (
                                <div className="mt-2 text-xs text-text-muted border-l-2 border-border pl-3 italic">
                                  Agent thought: {d.thinking}
                                </div>
                              )}

                              <div className="mt-2 text-[11px] text-danger/70 group-hover:text-danger/90 transition">
                                {reaction}
                              </div>
                            </div>

                            {/* Visual latency bar */}
                            <div className="hidden md:block w-20 pt-2">
                              <div className="h-1.5 bg-surface-raised rounded overflow-hidden">
                                <div 
                                  className={`h-1.5 rounded transition-all ${d.latency_ms > 280 ? "bg-danger" : d.latency_ms > 180 ? "bg-accent" : "bg-success"}`}
                                  style={{ width: `${Math.min(100, (d.latency_ms / 400) * 100)}%` }}
                                />
                              </div>
                              <div className="text-right text-[10px] text-text-muted mt-0.5 tabular-nums">{d.latency_ms}ms</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-6 py-3 border-t border-border bg-surface-raised text-xs text-text-muted flex items-center justify-between">
                    <div>Real decisions. Real latency. Your fighter running on your machine. The arena is only watching.</div>
                    <div className="font-mono text-accent">{liveMatch.shortCode}</div>
                  </div>
                </div>
              )}

              {/* Completion state (only shown briefly before the auto-transition magic happens) */}
              {liveMatch.status === "complete" && !liveFinalResult && (
                <div className="card p-10 text-center border-success/30 bg-success-dim/10 mb-6">
                  <div className="text-5xl mb-4">🏆</div>
                  <div className="text-3xl font-bold tracking-tight mb-2">The fight is over.</div>
                  <p className="text-text-secondary max-w-sm mx-auto">The arena is rendering the final verdict with hidden ground truth. Your savage match report is coming...</p>
                </div>
              )}

              <div className="text-center">
                <button
                  onClick={() => {
                    setLiveMatch(null);
                    setLiveEvents([]);
                    setLiveLog([]);
                    setLiveDecisions([]);
                    setLiveStats({ processed: 0, avgLatency: 0, accuracy: 0 });
                    setLiveFinalResult(null);
                    setCurrentView("home");
                  }}
                  className="btn btn-ghost text-sm"
                >
                  ABANDON THIS MATCH
                </button>
              </div>
            </div>
          )}

          <div className="mt-10 text-center text-xs text-text-muted max-w-md mx-auto">
            This is the real Bot Coliseum. No mocks. No uploads. Your agent walks into the arena and the crowd watches it bleed or survive.
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {currentResult && (
        <BroadcastModal
          result={currentResult}
          isOpen={showBroadcastModal}
          onClose={() => setShowBroadcastModal(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-border mt-16 py-8 text-center text-xs text-text-muted">
        Bot Coliseum — Season 0: The Proving Ground • A local-first AI agent stress test • No agents were executed in the making of this app
      </footer>
    </div>
  );
}
