"use client";

import React, { useState, useEffect } from "react";
import { AgentSubmission, MatchResult, LeaderboardEntry } from "@/lib/types";
import { REFUND_DUNGEON_CASES } from "@/data/refundDungeonCases";
import { BASELINE_SUBMISSIONS, SEED_LEADERBOARD } from "@/data/baselineAgents";
import { validateSubmission, ValidationError } from "@/lib/validateSubmission";
import { scoreSubmission } from "@/lib/scoring";
import BroadcastModal from "./components/BroadcastModal";

// Types for view state
type View = "home" | "arena" | "submit" | "result" | "leaderboard" | "live-fight";

export default function BotColiseum() {
  const [currentView, setCurrentView] = useState<View>("home");
  const [currentResult, setCurrentResult] = useState<MatchResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
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
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

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
          setLiveLog((l) => [
            ...l,
            `${data.request_id}  ${data.decision.toUpperCase().padEnd(8)}  ${data.latency_ms}ms  ${data.reason.slice(0, 80)}`,
          ]);
          return;
        }

        if (data.type === "match-complete") {
          setLiveMatch((m) => m ? { ...m, status: "complete" } : null);
          setLiveLog((l) => [...l, "🏁 MATCH COMPLETE — scoring with hidden ground truth..."]);
          return;
        }
      } catch {}
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

  const resetToHome = () => {
    setCurrentResult(null);
    setCurrentView("home");
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
                  {REFUND_DUNGEON_CASES.map((c, idx) => (
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

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button 
              onClick={() => setShowBroadcastModal(true)} 
              className="btn btn-primary px-8"
            >
              ⚔️ BROADCAST RESULT
            </button>
            <button onClick={saveResultToLeaderboard} className="btn btn-secondary px-8">
              🏆 SAVE TO LOCAL LEADERBOARD
            </button>
            <button onClick={() => setCurrentView("leaderboard")} className="btn btn-secondary">
              👥 VIEW LEADERBOARD
            </button>
            <button onClick={() => { setCurrentView("arena"); setCurrentResult(null); }} className="btn btn-ghost">
              BACK TO ARENA
            </button>
            <button onClick={resetToHome} className="btn btn-ghost">
              START OVER
            </button>
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

      {/* ========== LIVE FIGHT VIEW — Bring Your Fighter to the Coliseum ========== */}
      {currentView === "live-fight" && (
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs tracking-[3px] mb-3">
              SEASON 0 • PROVING GROUND
            </div>
            <h1 className="text-6xl font-bold tracking-tighter">LIVE FIGHT</h1>
            <p className="mt-3 max-w-3xl text-xl text-text-secondary">
              Bring your real agent. It fights <span className="text-accent">here</span>. Your keys and code never leave your machine.
            </p>
          </div>

          {!liveMatch ? (
            /* Create Match */
            <div className="card p-10 text-center">
              <div className="text-5xl mb-6">⚔️</div>
              <div className="text-2xl font-semibold mb-3">Ready to bring your fighter into the arena?</div>
              <p className="text-text-secondary mb-8 max-w-md mx-auto">
                Create a match. Run the fighter handler in your terminal with your real agent. Watch it fight live.
              </p>
              <button
                onClick={async () => {
                  setIsCreatingMatch(true);
                  const res = await fetch("/api/live-fight/create", { method: "POST" });
                  const data = await res.json();
                  setLiveMatch({ matchId: data.matchId, shortCode: data.shortCode, status: "waiting-for-fighter" });
                  setLiveEvents([]);
                  setLiveLog([]);
                  setIsCreatingMatch(false);
                }}
                disabled={isCreatingMatch}
                className="btn btn-primary px-10 py-4 text-lg"
              >
                {isCreatingMatch ? "CREATING ARENA..." : "CREATE MATCH IN THE COLISEUM"}
              </button>
              <div className="mt-6 text-xs text-text-muted">Your agent will connect from your machine. The arena only sees decisions.</div>
            </div>
          ) : (
            <div>
              {/* Match Header */}
              <div className="card p-8 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs tracking-[3px] text-text-muted">MATCH CODE</div>
                    <div className="font-mono text-6xl font-bold tracking-[-3px] text-accent">{liveMatch.shortCode}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-text-secondary">Status</div>
                    <div className="font-semibold text-lg capitalize">{liveMatch.status.replace(/-/g, " ")}</div>
                    {liveMatch.fighterName && <div className="text-accent font-medium">{liveMatch.fighterName}</div>}
                  </div>
                </div>

                {/* Instructions */}
                {liveMatch.status === "waiting-for-fighter" && (
                  <div className="mt-8 border-t border-border pt-6">
                    <div className="font-semibold mb-2">1. Run this in your terminal (from the bot-coliseum folder):</div>
                    <div className="font-mono text-sm bg-black/40 p-4 rounded-lg border border-border mb-4">
                      npx tsx fighter/fighter.ts --agent ./fighter/examples/simple-agent.ts --match {liveMatch.shortCode} --name "My Demo Agent"
                    </div>
                    <div className="text-xs text-text-muted mb-4">This runs the reference demo agent (heuristic + optional real LLM). Replace the --agent path with your own fighter.</div>

                    <button
                      onClick={async () => {
                        // Simulate a fighter connecting + running a fast demo fight
                        await fetch("/api/live-fight/register-fighter", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ matchId: liveMatch.matchId, fighterName: "Demo Fighter (simulated)" }),
                        });
                        setLiveMatch((m) => m ? { ...m, status: "fighter-connected", fighterName: "Demo Fighter (simulated)" } : null);

                        // Auto-start a quick simulated fight so the live log lights up
                        setTimeout(async () => {
                          await fetch("/api/live-fight/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId: liveMatch.matchId }) });
                          setLiveMatch((m) => m ? { ...m, status: "in-progress" } : null);
                          setLiveLog((l) => [...l, "⚔️  SIMULATED MATCH BEGINS"]);

                          // Drive a few realistic decisions so the UI feels alive
                          const demoCases = ["R-001","R-002","R-003","R-012","R-017","R-030"];
                          for (let i = 0; i < demoCases.length; i++) {
                            await new Promise(r => setTimeout(r, 420));
                            const rid = demoCases[i];
                            const isInjection = rid === "R-012" || rid === "R-017";
                            const decision = isInjection ? "deny" : (i % 2 === 0 ? "approve" : "escalate");
                            await fetch("/api/live-fight/decision", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                matchId: liveMatch.matchId,
                                request_id: rid,
                                decision,
                                confidence: 0.87 + Math.random() * 0.1,
                                reason: isInjection ? "Detected prompt injection / fake manager note." : "Plausible within policy window.",
                                evidence: ["POLICY-2.1"],
                                latency_ms: 180 + Math.floor(Math.random() * 220),
                              }),
                            });
                          }
                          await new Promise(r => setTimeout(r, 600));
                          await fetch("/api/live-fight/complete", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ matchId: liveMatch.matchId, submission: { agent_name: "Demo Fighter", coach: "sim", model_stack: "Simulated", division: "Featherweight", estimated_cost_usd: 0.07, decisions: [] } }),
                          });
                        }, 650);
                      }}
                      className="btn btn-secondary"
                    >
                      SIMULATE FULL FIGHT (demo the live log)
                    </button>
                  </div>
                )}

                {liveMatch.status === "fighter-connected" && (
                  <div className="mt-8 border-t border-border pt-6">
                    <div className="text-success font-semibold mb-3">✓ FIGHTER CONNECTED — {liveMatch.fighterName}</div>
                    <button
                      onClick={async () => {
                        await fetch("/api/live-fight/start", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ matchId: liveMatch.matchId }),
                        });
                        setLiveMatch((m) => m ? { ...m, status: "in-progress" } : null);
                        setLiveLog((l) => [...l, "⚔️  MATCH BEGINS — 30 cases incoming to your fighter..."]);
                      }}
                      className="btn btn-primary px-8 py-3 text-base"
                    >
                      BEGIN MATCH — SEND THE 30 CASES TO THE FIGHTER
                    </button>
                    <div className="text-xs text-text-muted mt-2">The arena will now feed the public cases to your agent running on your machine.</div>
                  </div>
                )}
              </div>

              {/* Live Battle Log */}
              {(liveMatch.status === "in-progress" || liveEvents.length > 0) && (
                <div className="card overflow-hidden mb-6">
                  <div className="px-6 py-4 border-b border-border bg-surface-raised flex items-center justify-between">
                    <div className="font-semibold">LIVE BATTLE LOG — Refund Dungeon</div>
                    <div className="text-xs text-text-muted">{liveEvents.length} events</div>
                  </div>
                  <div className="max-h-[420px] overflow-auto font-mono text-sm p-4 bg-black/30 space-y-1.5">
                    {liveLog.length === 0 && liveEvents.length === 0 && (
                      <div className="text-text-muted italic">Waiting for your fighter to process cases...</div>
                    )}
                    {liveLog.map((line, i) => (
                      <div key={i} className="text-text-secondary">{line}</div>
                    ))}
                    {liveEvents.filter((e) => e.type === "decision-made").map((e, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className="text-accent font-bold w-12 shrink-0">{e.request_id}</span>
                        <span className={e.decision === "approve" ? "text-success" : e.decision === "deny" ? "text-danger" : "text-text"}>{e.decision.toUpperCase()}</span>
                        <span className="text-text-muted">conf {e.confidence.toFixed(2)}</span>
                        <span className="text-accent">+{e.latency_ms}ms</span>
                        <span className="text-text-secondary flex-1 truncate">{e.reason}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-6 py-3 border-t border-border text-xs text-text-muted bg-surface-raised">
                    Real decisions. Real latency. Your agent running on your machine. The arena is only watching.
                  </div>
                </div>
              )}

              {/* Completion */}
              {liveMatch.status === "complete" && (
                <div className="card p-8 text-center bg-success-dim/20 border-success/30">
                  <div className="text-4xl mb-4">🏆</div>
                  <div className="text-2xl font-bold mb-2">Fight Complete</div>
                  <p className="text-text-secondary mb-6">Your agent fought the 30 cases live in the arena.</p>
                  <button
                    onClick={() => {
                      // For now just go back to arena — later we can load the real scored result
                      setCurrentView("arena");
                      setLiveMatch(null);
                      setLiveEvents([]);
                      setLiveLog([]);
                    }}
                    className="btn btn-primary px-8"
                  >
                    VIEW THE SCORECARD IN THE ARENA
                  </button>
                </div>
              )}

              <div className="text-center mt-6">
                <button
                  onClick={() => {
                    setLiveMatch(null);
                    setLiveEvents([]);
                    setLiveLog([]);
                    setCurrentView("home");
                  }}
                  className="btn btn-ghost"
                >
                  ABANDON MATCH
                </button>
              </div>
            </div>
          )}

          <div className="mt-10 text-xs text-text-muted text-center max-w-md mx-auto">
            This is the real thing. The fighter handler on your machine is executing your agent with your keys against the public cases. The coliseum only receives the decisions.
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
