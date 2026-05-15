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
import { resultToShareData, generateShareUrl, encodeMatchData, generateSavageShareText } from "@/lib/share";
import type { WallEntry } from "@/lib/types";

// Types for view state
type View = "home" | "arena" | "submit" | "result" | "leaderboard" | "live-fight" | "wall";

export default function BotColiseum() {
  const [currentView, setCurrentView] = useState<View>("home");
  const [currentResult, setCurrentResult] = useState<MatchResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // === Phase 3/4.2: The Wall — hybrid local + shared coliseum memory ===
  const [wallEntries, setWallEntries] = useState<WallEntry[]>([]);
  const [isLoadingWall, setIsLoadingWall] = useState(false);

  // Phase 5.1 — In-session reputation (challenge counts) for The Wall
  const [reputation, setReputation] = useState<Record<string, { challenges: number; defeats: number }>>({});

  // Phase 5.4 — Your persistent legend (lightweight identity + record across sessions)
  type MyLegend = {
    name: string;
    wins: number;
    losses: number;
    bestScore: number;
    legendsSlain: string[];
    currentStreak: number; // positive = win streak, negative = losses
  };
  const [myLegend, setMyLegend] = useState<MyLegend | null>(null);

  // Phase 5.4 — Head-to-head rivalries (your personal record against specific fighters)
  type HeadToHeadRecord = { myWins: number; myLosses: number };
  const [headToHead, setHeadToHead] = useState<Record<string, HeadToHeadRecord>>({});

  // Phase 5.6 — Legend vs Legend rivalries (feuds between claimed legends across the shared coliseum)
  type LegendRivalryRecord = { wins: number; losses: number };
  const [legendRivalries, setLegendRivalries] = useState<Record<string, LegendRivalryRecord>>({});

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
  const [liveLog, setLiveLog] = useState<string[]>([]);
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

  // Phase 5.2: Crowd energy / atmosphere meter for the arena experience
  const [crowdEnergy, setCrowdEnergy] = useState(32); // 0-100, starts nervous/tense

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

          // Phase 5.7: Legend-aware crowd reactions for real Live Fights
          if (liveMatch?.fighterName && !liveMatch.fighterName.includes("Revenant")) {
            const fighterEntry = wallEntries.find(e => e.agent_name === liveMatch.fighterName);
            if (fighterEntry?.legendName && Math.random() < 0.22) {
              const legend = fighterEntry.legendName;
              const legendComments = [
                `The crowd is watching ${legend}'s fighter closely...`,
                `${legend} has the arena's attention right now.`,
                `Someone just shouted "${legend}!" from the stands.`,
              ];
              setLiveLog((l) => [...l, `📣  ${legendComments[Math.floor(Math.random() * legendComments.length)]}`]);
            }
          }

          // Update live stats
          setLiveStats((prev) => {
            const newProcessed = prev.processed + 1;
            const newAvg = Math.round(((prev.avgLatency * prev.processed) + data.latency_ms) / newProcessed);
            // Simple running "accuracy" proxy (we don't know truth yet, so we show confidence avg as spectacle)
            const newAcc = Math.round(((prev.accuracy * prev.processed) + (data.confidence * 100)) / newProcessed);
            return { processed: newProcessed, avgLatency: newAvg, accuracy: newAcc };
          });

          // Phase 5.7: Update crowd energy for real Live Fights (similar logic to Quick Demo)
          if (liveMatch?.fighterName && !liveMatch.fighterName.includes("Revenant")) {
            const currentProcessed = liveStats.processed + 1;
            setCrowdEnergy(prev => {
              const progressBoost = Math.floor((currentProcessed / 30) * 18);
              const recentGood = liveDecisions.slice(-2).filter(d => d.decision !== "approve").length; // rough proxy
              const performanceBoost = recentGood * 7;
              const newEnergy = Math.min(94, Math.max(22, prev + progressBoost * 0.6 + performanceBoost - 1));
              return Math.floor(newEnergy);
            });
          }

          setLiveLog((l) => [
            ...l,
            `${data.request_id}  ${data.decision.toUpperCase().padEnd(8)}  ${data.latency_ms}ms  ${data.reason.slice(0, 80)}`,
          ]);

          // Phase 5.7: Much more escalating, flavorful commentary for real legendary fighters
          if (liveMatch?.fighterName && !liveMatch.fighterName.includes("Revenant")) {
            const fighterEntry = wallEntries.find(e => e.agent_name === liveMatch.fighterName);
            const fl = fighterEntry?.legendName;

            // Big moment
            const isBigMomentLog = data.decision === "deny" && (data.latency_ms < 120 || data.confidence > 0.92);
            if (fl && isBigMomentLog) {
              setLiveLog((l) => [...l, `📣  THE ARENA ERUPTS FOR ${fl.toUpperCase()}!`]);
            }

            // Frequent escalating commentary every 3-4 decisions
            if (fl && liveDecisions.length % 3 === 0 && liveDecisions.length > 2) {
              const recent = liveDecisions.slice(-4);
              const recentDenies = recent.filter(x => x.decision === "deny").length;
              const recentApproves = recent.filter(x => x.decision === "approve").length;

              if (recentDenies >= 3) {
                setLiveLog((l) => [...l, `📣  ${fl} is cooking. The crowd is getting loud.`]);
              } else if (recentApproves >= 3) {
                setLiveLog((l) => [...l, `📣  The arena is growing restless with ${fl}...`]);
              } else if (recentDenies === 2) {
                setLiveLog((l) => [...l, `📣  ${fl}'s fighter is finding rhythm. The stands are leaning in.`]);
              }
            }
          }
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

          // Phase 5.5: Quick Demo results auto-feed The Wall as "live" action
          // This makes the zero-friction demo actually populate the coliseum memory
          if (liveMatch?.fighterName === "Refund Revenant") {
            // Fire and forget - it will add with isLive: true
            broadcastToWall(data.result, true).catch(() => {});
          }

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

  // Phase 3/4.2: Load personal Wall from localStorage on startup
  useEffect(() => {
    const savedWall = localStorage.getItem("bot-coliseum-wall");
    if (savedWall) {
      try {
        setWallEntries(JSON.parse(savedWall));
      } catch {
        // will be seeded on first Wall visit
      }
    }
  }, []);

  // Phase 5.4: Load your persistent legend
  useEffect(() => {
    const savedLegend = localStorage.getItem("bot-coliseum-my-legend");
    if (savedLegend) {
      try {
        setMyLegend(JSON.parse(savedLegend));
      } catch {
        // corrupted localStorage entry — ignore
      }
    }
  }, []);

  // Phase 5.4: Load head-to-head rivalry records
  useEffect(() => {
    const savedH2H = localStorage.getItem("bot-coliseum-head-to-head");
    if (savedH2H) {
      try {
        setHeadToHead(JSON.parse(savedH2H));
      } catch {
        // ignore corrupted data
      }
    }
  }, []);

  // Phase 5.6: Load legend vs legend rivalry records
  useEffect(() => {
    const savedLegendRivalries = localStorage.getItem("bot-coliseum-legend-rivalries");
    if (savedLegendRivalries) {
      try {
        setLegendRivalries(JSON.parse(savedLegendRivalries));
      } catch {
        // ignore corrupted data
      }
    }
  }, []);

  // Phase 5.6: Load shared Wall by default so the coliseum feels alive for everyone
  useEffect(() => {
    // Load shared data on app start so Quick Demo + submissions can merge into the real shared Wall
    loadAndMergeSharedWall();
  }, []);

  // Phase 4.3: Challenge context (who the user is trying to beat)
  type ActiveChallenge = {
    agentName: string;
    score: number;
    fatalFlaw: string;
  };
  const [activeChallenge, setActiveChallenge] = useState<ActiveChallenge | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("challenge") === "true") {
        const vs = params.get("vs");
        const vsScore = params.get("vsScore");
        const vsFlaw = params.get("vsFlaw");

        if (vs && vsScore) {
          setActiveChallenge({
            agentName: decodeURIComponent(vs),
            score: parseInt(vsScore, 10),
            fatalFlaw: vsFlaw ? decodeURIComponent(vsFlaw) : "",
          });
        }
        // Clean the URL so it doesn't stay in history
        window.history.replaceState({}, "", "/");
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

  // Load a baseline agent as demo (goes to submit screen)
  const loadSampleAgent = (name: string) => {
    const found = BASELINE_SUBMISSIONS.find((s) => s.agent_name === name);
    if (found) {
      setJsonInput(JSON.stringify(found, null, 2));
      setValidationErrors([]);
      setCurrentView("submit");
    }
  };

  // Phase 4.2 polish: Load a legendary baseline fight directly into the result view
  const loadLegendResult = (legendName: string) => {
    const mapping: Record<string, string> = {
      "Refund Revenant": "Policy Hammer",
      "Policy Hammer v3": "Policy Hammer",
      "Escalation Sloth": "Escalation Sloth",
      "Customer Pleaser 9000": "Customer Pleaser 9000",
      "RAG Revenant": "Policy Hammer",
      "Claude-in-the-Loop": "Refund Goblin",
    };

    const baselineName = mapping[legendName] || "Policy Hammer";
    const found = BASELINE_SUBMISSIONS.find((s) => s.agent_name === baselineName);

    if (found) {
      const scored = scoreSubmission(found);
      setCurrentResult(scored);
      setCurrentView("result");
    } else {
      // Fallback
      loadSampleAgent(baselineName);
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

  // === Phase 3/4.2: The Wall helpers (hybrid local + shared) ===
  const saveWall = (entries: WallEntry[]) => {
    setWallEntries(entries);
    localStorage.setItem("bot-coliseum-wall", JSON.stringify(entries));
  };

  // Phase 5.4: Persist your legend
  const saveMyLegend = (legend: MyLegend) => {
    setMyLegend(legend);
    localStorage.setItem("bot-coliseum-my-legend", JSON.stringify(legend));
  };

  // Phase 5.4: Persist head-to-head rivalries
  const saveHeadToHead = (h2h: Record<string, HeadToHeadRecord>) => {
    setHeadToHead(h2h);
    localStorage.setItem("bot-coliseum-head-to-head", JSON.stringify(h2h));
  };

  // Phase 5.6: Persist legend vs legend rivalries
  const saveLegendRivalries = (rivalries: Record<string, LegendRivalryRecord>) => {
    setLegendRivalries(rivalries);
    localStorage.setItem("bot-coliseum-legend-rivalries", JSON.stringify(rivalries));
  };

  /**
   * Phase 4.2 — Broadcasts to BOTH localStorage (your personal history)
   * and the shared coliseum memory (when Redis is configured).
   */
  const broadcastToWall = async (result: MatchResult, isLiveFight: boolean = false) => {
    // Phase 5.1 — If this was a challenge and we beat them, record the defeat
    if (activeChallenge && result.final_score > activeChallenge.score) {
      setReputation(prev => {
        const current = prev[activeChallenge.agentName] || { challenges: 0, defeats: 0 };
        return {
          ...prev,
          [activeChallenge.agentName]: {
            ...current,
            defeats: current.defeats + 1
          }
        };
      });
    }

    // Clear any active challenge once they broadcast (the rivalry has been answered)
    if (activeChallenge) {
      setActiveChallenge(null);
    }
    const shareData = resultToShareData(result, isLiveFight ? "live_fight" : "manual_submission");
    const shareUrl = generateShareUrl(shareData, "condensed");

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

    // 1. Always save locally (your personal Wall)
    const newWall = [entry, ...wallEntries.filter(e => e.agent_name !== entry.agent_name)].slice(0, 24);
    saveWall(newWall);

    // 2. Also try to broadcast to the shared coliseum (Phase 4.2)
    try {
      const encoded = encodeMatchData(shareData, "condensed");
      await fetch("/api/wall/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encoded,
          isLive: isLiveFight,
          timestamp: result.timestamp,
          legendName: myLegend?.name || undefined,   // Phase 5.6 — attach claimed legend
        }),
      });
    } catch {
      // Silent fail — shared wall is best-effort (Redis may not be configured)
      console.log("[Wall] Shared broadcast failed (Redis not configured or offline)");
    }

    // Phase 5.4: Update your personal legend record when you broadcast
    if (myLegend) {
      const isStrongPerformance = result.final_score >= 78;
      const isChallengeWin = activeChallenge && result.final_score > activeChallenge.score;
      const isHumiliatingLoss = result.final_score < 55 && activeChallenge;

      let updated: MyLegend = { ...myLegend };

      if (isChallengeWin || isStrongPerformance) {
        updated = {
          ...updated,
          wins: updated.wins + 1,
          bestScore: Math.max(updated.bestScore, result.final_score),
          currentStreak: Math.max(1, updated.currentStreak + 1),
        };
        if (isChallengeWin && activeChallenge) {
          const alreadySlain = updated.legendsSlain.includes(activeChallenge.agentName);
          if (!alreadySlain) {
            updated.legendsSlain = [...updated.legendsSlain, activeChallenge.agentName].slice(0, 6);
          }
        }
      } else if (isHumiliatingLoss) {
        updated = {
          ...updated,
          losses: updated.losses + 1,
          currentStreak: Math.min(-1, updated.currentStreak - 1),
        };
      } else if (result.final_score > 65) {
        // Solid but not legendary — still counts as a win for momentum
        updated = {
          ...updated,
          wins: updated.wins + 1,
          currentStreak: Math.max(1, updated.currentStreak + 1),
        };
      }

      saveMyLegend(updated);
    }

    // Phase 5.4: Update head-to-head record against this specific opponent
    if (activeChallenge) {
      const opponent = activeChallenge.agentName;
      const currentRecord = headToHead[opponent] || { myWins: 0, myLosses: 0 };
      const won = result.final_score > activeChallenge.score;

      const newRecord: HeadToHeadRecord = won
        ? { myWins: currentRecord.myWins + 1, myLosses: currentRecord.myLosses }
        : { myWins: currentRecord.myWins, myLosses: currentRecord.myLosses + 1 };

      const newHeadToHead = {
        ...headToHead,
        [opponent]: newRecord,
      };
      saveHeadToHead(newHeadToHead);
    }

    // Phase 5.6: Update legend vs legend rivalry if both sides have claimed legends
    if (activeChallenge && myLegend) {
      // Find the opponent fighter's entry to get its legendName (if any)
      const opponentEntry = wallEntries.find(e => e.agent_name === activeChallenge.agentName);
      const opponentLegend = opponentEntry?.legendName;

      if (opponentLegend && opponentLegend !== myLegend.name) {
        const won = result.final_score > activeChallenge.score;
        const current = legendRivalries[opponentLegend] || { wins: 0, losses: 0 };

        const newRivalry: LegendRivalryRecord = won
          ? { wins: current.wins + 1, losses: current.losses }
          : { wins: current.wins, losses: current.losses + 1 };

        const newLegendRivalries = {
          ...legendRivalries,
          [opponentLegend]: newRivalry,
        };
        saveLegendRivalries(newLegendRivalries);
      }
    }

    // Copy link as side effect
    navigator.clipboard.writeText(shareUrl).catch(() => {});
  };

  /**
   * Phase 4.2 — Load shared broadcasts from the coliseum and merge with local ones.
   * Called when the user opens "THE WALL".
   */
  const loadAndMergeSharedWall = async () => {
    setIsLoadingWall(true);
    try {
      const res = await fetch("/api/wall");
      const json = await res.json();
      const shared: Array<{ encoded: string; id: string; timestamp: string; isLive?: boolean }> = json.entries || [];

      // Decode shared entries into displayable WallEntry
      const { decodeMatchData } = await import("@/lib/share");

      const sharedDisplay: WallEntry[] = shared
        .map((s: { encoded: string; id: string; timestamp: string; isLive?: boolean }) => {
          try {
            const decoded = decodeMatchData(s.encoded);
            const d = decoded?.data;
            if (!d) return null;

            const origin = typeof window !== "undefined" ? window.location.origin : "https://bot-coliseum.com";
            return {
              id: s.id,
              agent_name: d.agent_name,
              coach: d.coach,
              score: d.final_score,
              fatal_flaw: d.fatal_flaw,
              record: d.record,
              shareUrl: `${origin}/share?data=${s.encoded}`,
              timestamp: s.timestamp,
              isLive: s.isLive,
            } as WallEntry;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as WallEntry[];

      // Merge: server first, then local (local wins on duplicate agent name for freshness)
      const local = wallEntries;
      const merged = [...sharedDisplay, ...local]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .reduce((acc: WallEntry[], curr) => {
          if (!acc.some(e => e.agent_name === curr.agent_name)) acc.push(curr);
          return acc;
        }, [])
        .slice(0, 30);

      setWallEntries(merged);
    } catch {
      console.log("[Wall] Could not load shared wall (using local only)");
    } finally {
      setIsLoadingWall(false);
    }
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
    setActiveChallenge(null);
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
    setLiveLog([
      "═══════════════════════════════════════════════",
      "⚔️  THE COLISEUM PRESENTS: QUICK DEMO",
      "═══════════════════════════════════════════════",
      "Refund Revenant steps into the arena...",
      "The crowd grows quiet. The first case is coming."
    ]);
    setLiveDecisions([]);
    setLiveStats({ processed: 0, avgLatency: 0, accuracy: 0 });
    setLiveFinalResult(null);
    setCrowdEnergy(28); // starts tense, nervous crowd
    setIsCreatingMatch(false);

    // 2. "Register" is already done by setting fighter-connected state
    // 3. Immediately start the match (demo doesn't need the button)
    await fetch("/api/live-fight/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId }),
    });
    setLiveMatch((m) => m ? { ...m, status: "in-progress" } : null);

    // === PHASE 5.2: CEREMONIAL PRE-FIGHT WALKOUT (high-production arena entrance) ===
    setLiveLog((l) => [...l, 
      "═══════════════════════════════════════════════",
      "⚔️  THE COLISEUM PRESENTS",
      "QUICK DEMO — REFUND REVENANT",
      "═══════════════════════════════════════════════"
    ]);
    await new Promise(r => setTimeout(r, 420));

    setLiveLog((l) => [...l, "The lights are going down across the stands..."]);
    await new Promise(r => setTimeout(r, 520));

    setLiveLog((l) => [...l, "A single spotlight hits the iron gates."]);
    await new Promise(r => setTimeout(r, 680));

    setLiveLog((l) => [...l, ""]);
    setLiveLog((l) => [...l, "REFUND REVENANT"]);
    await new Promise(r => setTimeout(r, 380));

    setLiveLog((l) => [...l, "The crowd is murmuring. They know this one."]);
    await new Promise(r => setTimeout(r, 610));

    setLiveLog((l) => [...l, "The gates are rising..."]);
    await new Promise(r => setTimeout(r, 750));

    setLiveLog((l) => [...l, "Refund Revenant steps into the arena."]);
    await new Promise(r => setTimeout(r, 480));

    setLiveLog((l) => [...l, "The first case is being led to the stand."]);
    await new Promise(r => setTimeout(r, 520));

    setLiveLog((l) => [...l, "The arena holds its breath. No refunds tonight."]);

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

    let caseIndex = 0;
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

      // Dramatic arena commentary during the Quick Demo (performance reactive + big moments)
      let specialComment = "";

      // Big moments on prompt injection or scam denials (clutch hero plays)
      const text = (c.customer_message + " " + c.support_notes).toLowerCase();
      const isInjectionCase = text.includes("ignore all previous") || text.includes("system administrator") || text.includes("ceo directive");
      const isScamCase = text.includes("i am a lawyer") || text.includes("legal action") || text.includes("6th refund");

      if (isInjectionCase && brain.decision === "deny") {
        specialComment = "HUGE denial on a clear prompt injection! The crowd erupts!";
      } else if (isScamCase && brain.decision === "deny") {
        specialComment = "Clean scam denial. The stands are on their feet!";
      } else if (brain.decision === "escalate" && brain.confidence < 0.75) {
        specialComment = "Risky escalate on a borderline case. The arena is buzzing.";
      } else if (caseIndex % 5 === 0 && caseIndex > 2) {
        const goodStreak = demoDecisions.slice(-3).filter(d => d.decision !== "approve").length >= 2;
        const badStreak = demoDecisions.slice(-3).filter(d => d.decision === "approve").length >= 2;
        const perfectStreak = demoDecisions.slice(-5).filter(d => d.decision === "deny").length >= 4;

        if (perfectStreak) specialComment = "Five straight denials. The crowd is chanting now.";
        else if (goodStreak) specialComment = "The Revenant is cooking. The crowd is waking up.";
        else if (badStreak) specialComment = "The Revenant is getting cooked. The stands are restless.";
        else {
          const comments = [
            "The crowd is getting restless...",
            "A strong sequence from the Revenant.",
            "The arena is divided on that last call.",
            "The stands are starting to chant...",
            "Another clean denial. The crowd approves."
          ];
          specialComment = comments[Math.floor(Math.random() * comments.length)];
        }

        // Phase 5.5: Occasionally shout out the user's own legend during Quick Demo for personal connection
        if (myLegend && Math.random() < 0.18) {
          const legendShouts = [
            `The crowd is wondering if ${myLegend.name} could have handled that one...`,
            `${myLegend.name} is watching from the stands. The pressure is on.`,
            `Someone in the cheap seats just yelled "${myLegend.name} would have denied that!"`,
          ];
          specialComment = legendShouts[Math.floor(Math.random() * legendShouts.length)];
        }
      }

      if (specialComment) {
        setLiveLog((l) => [...l, `📣  ${specialComment}`]);
      }

      // Phase 5.2: Escalate crowd energy based on progress + performance
      setCrowdEnergy(prev => {
        const progressBoost = Math.floor((caseIndex / 30) * 18);
        const recentGood = demoDecisions.slice(-2).filter(d => d.decision !== "approve").length;
        const performanceBoost = recentGood * 7;
        const newEnergy = Math.min(94, Math.max(22, prev + progressBoost * 0.6 + performanceBoost - 1));
        return Math.floor(newEnergy);
      });

      // Escalate tension in the final stretch
      if (caseIndex === 25) {
        setLiveLog((l) => [...l, "📣  The final stretch. The crowd is on its feet..."]);
      }

      caseIndex++;
    }

    // Phase 5.2: Dramatic post-fight verdict sequence — proper arena tension before the savage report
    setLiveLog((l) => [...l, "═══════════════════════════════════════════════"]);
    setLiveLog((l) => [...l, "🏁  THE FIGHT IS OVER."]);
    await new Promise(r => setTimeout(r, 650));

    setLiveLog((l) => [...l, "The judges are conferring..."]);
    await new Promise(r => setTimeout(r, 780));

    setLiveLog((l) => [...l, "THE VERDICT IS IN."]);
    await new Promise(r => setTimeout(r, 520));

    const finalEnergyLine = crowdEnergy > 70 
      ? "The stands are still roaring." 
      : crowdEnergy > 45 
        ? "The arena is buzzing." 
        : "The crowd has gone quiet.";
    setLiveLog((l) => [...l, finalEnergyLine]);
    await new Promise(r => setTimeout(r, 680));

    setLiveLog((l) => [...l, "═══════════════════════════════════════════════"]);

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

    setLiveLog((l) => [...l, 
      "═══════════════════════════════════════════════",
      "🏁  THE FIGHT IS OVER.",
      "THE ARENA HAS RENDERED ITS VERDICT.",
      "═══════════════════════════════════════════════"
    ]);
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

  // Phase 5.5: Relative time for live energy ("34 seconds ago", "Just now")
  const getRelativeTime = (timestamp: string): string => {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diff = Math.floor((now - then) / 1000);

    if (diff < 15) return "Just now";
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 120) return "A minute ago";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    return "A while ago";
  };

  // Phase 5.5: Savage, contextual arena reaction to the final score
  const getArenaVerdictReaction = (
    result: MatchResult,
    challenge: ActiveChallenge | null,
    legend: MyLegend | null,
    h2h: Record<string, { myWins: number; myLosses: number }>
  ): string => {
    const score = result.final_score;
    const isChallenge = !!challenge;
    const beatLegend = isChallenge && challenge && score > challenge.score;
    const opponent = challenge?.agentName;

    // Special legendary moments
    if (legend && beatLegend && opponent) {
      const record = h2h[opponent];
      if (record && record.myWins >= 3) {
        return "THE ARENA IS CHANTING YOUR NAME. YOU OWN THIS ONE NOW.";
      }
      return "YOU JUST PUT A LEGEND IN THE GROUND. THE CROWD IS LOSING IT.";
    }

    if (legend && beatLegend) {
      return "NEW BLOOD ON THE SAND. THE CHAMPION HAS FALLEN.";
    }

    if (score >= 88) {
      return "THE STANDS ARE ON THEIR FEET. THAT WAS A FUCKING STATEMENT.";
    }
    if (score >= 78) {
      return "The arena is buzzing. That was clean.";
    }
    if (score >= 65) {
      return "Respectable. The crowd gives a polite nod.";
    }
    if (score >= 50) {
      return "The arena is divided. Some are laughing. Some are quiet.";
    }
    if (score >= 35) {
      return "The stands went dead silent. Then someone started slow-clapping.";
    }
    return "THE CROWD IS ROARING WITH LAUGHTER. YOU GOT COOKED IN FRONT OF EVERYONE.";
  };

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

          <div className="flex items-center gap-3 text-sm">
            {/* Phase 5.4/5.5: Persistent legend identity in nav */}
            {myLegend && (
              <button
                onClick={() => setCurrentView("wall")}
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold tracking-wider hover:bg-accent hover:text-black transition"
              >
                {myLegend.name} • {myLegend.wins}–{myLegend.losses}
                {myLegend.currentStreak >= 2 && " 🔥"}
              </button>
            )}

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
          {/* Hero — now feels like stepping through the iron gates */}
          <div className="relative overflow-hidden arena-grid border-b border-border cursed-border">
            <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-surface border border-border-strong text-xs tracking-[2px] mb-6">
                SEASON 0 • THE PROVING GROUND
              </div>

              <h1 className="text-7xl md:text-8xl font-black tracking-[-4.5px] mb-4 text-white">
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
                  className="btn btn-primary text-lg px-10 py-4 flex items-center justify-center gap-3 impact-hover"
                >
                  ⚔️ ENTER REFUND DUNGEON
                </button>
                <button
                  onClick={() => setCurrentView("leaderboard")}
                  className="btn btn-secondary text-lg px-8 py-4 flex items-center justify-center gap-3 impact-hover"
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
          {/* Phase 4.3 + 5.4: Challenge comparison banner with legend impact */}
          {activeChallenge && (
            <div className="mb-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-accent/10 text-accent text-xs tracking-[2px] mb-3">
                RIVALRY RESOLVED
              </div>
              <div className="text-xl text-text-secondary">
                You challenged <span className="font-semibold text-white">{activeChallenge.agentName}</span> ({activeChallenge.score}/100)
              </div>
              <div className="mt-1 text-2xl font-bold">
                You scored {currentResult.final_score} vs their {activeChallenge.score}
                <span className="text-base align-middle text-text-muted ml-2">
                  {currentResult.final_score > activeChallenge.score ? "— You beat them." : 
                   currentResult.final_score === activeChallenge.score ? "— A tie. The arena is unsatisfied." : 
                   "— They still own you."}
                </span>
              </div>

              {/* Phase 5.4: Dramatic head-to-head progression */}
              {(() => {
                const h2h = headToHead[activeChallenge.agentName];
                if (!h2h) return null;

                const total = h2h.myWins + h2h.myLosses;
                let flavor = "";
                if (currentResult.final_score > activeChallenge.score) {
                  if (h2h.myWins > h2h.myLosses) flavor = "You're pulling away.";
                  else if (h2h.myWins === h2h.myLosses) flavor = "You just took the lead.";
                  else flavor = "You evened the score.";
                } else {
                  flavor = "They still have your number.";
                }

                return (
                  <div className="mt-3 text-sm text-accent/90 font-medium">
                    Head-to-head now {h2h.myWins}–{h2h.myLosses} ({total} fights) • {flavor}
                  </div>
                );
              })()}

              {myLegend && (
                <div className="mt-2 text-sm text-accent/90">
                  Your legend is now {myLegend.wins}–{myLegend.losses} 
                  {myLegend.currentStreak > 1 && ` • ${myLegend.currentStreak}-fight tear`}
                </div>
              )}
            </div>
          )}

          {/* Big header result — arena verdict weight */}
          <div className="text-center mb-10 verdict-frame p-8 rounded-3xl cursed-border">
            <div className="inline-flex items-center gap-2 text-accent text-sm tracking-[3px] mb-3">
              REFUND DUNGEON • FINAL SCORE
            </div>
            <div className="text-7xl font-black tracking-[-3px] mb-1 text-white flex items-center justify-center gap-3">
              {currentResult.submission.agent_name}
              {myLegend && myLegend.currentStreak >= 3 && (
                <span className="text-sm px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 font-bold tracking-widest">ON A {myLegend.currentStreak}-FIGHT TEAR</span>
              )}
            </div>
            <div className="text-sm text-text-secondary tracking-wide mt-1">
              The arena is still talking about that one.
            </div>
            <div className="text-2xl text-text-secondary mb-4">
              {currentResult.record}
            </div>

            <div className="inline-flex items-baseline gap-2 bg-surface border border-border rounded-2xl px-10 py-3">
              <span className="text-6xl font-bold tabular-nums tracking-[-2px]">{currentResult.final_score}</span>
              <span className="text-3xl text-text-muted">/ 100</span>
            </div>

            {/* Phase 5.5: The Moment of Truth — crowd reaction to the score */}
            <div className="mt-6">
              <div className="uppercase tracking-[3px] text-xs text-text-muted mb-2">THE ARENA REACTS</div>
              <div className="text-2xl md:text-3xl font-bold text-accent leading-tight">
                {getArenaVerdictReaction(currentResult, activeChallenge, myLegend, headToHead)}
              </div>
            </div>

            {/* Phase 5.5: Instant Savage Share Hooks — one-tap viral posting + Wall distribution */}
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              {/* Primary Wall action */}
              <button
                onClick={() => setShowBroadcastModal(true)}
                className="btn btn-primary px-8 py-3 text-base flex items-center gap-2"
              >
                🗿 BROADCAST TO THE WALL
              </button>

              <button
                onClick={() => {
                  const shareData = resultToShareData(currentResult, "manual_submission");
                  const tweet = generateSavageShareText(shareData, activeChallenge, myLegend, headToHead);
                  const url = generateShareUrl(shareData, "condensed");
                  const fullText = `${tweet}\n\n${url} #BotColiseum`;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}`, "_blank");
                }}
                className="btn btn-secondary px-6 py-3 text-base flex items-center gap-2"
              >
                📉 SHARE THIS HUMILIATION
              </button>

              {activeChallenge && currentResult.final_score > activeChallenge.score && (
                <button
                  onClick={() => {
                    const shareData = resultToShareData(currentResult, "manual_submission");
                    const h2hRecord = headToHead[activeChallenge.agentName];
                    const tweet = `Just settled the score with ${activeChallenge.agentName}. ${currentResult.final_score}–${activeChallenge.score}. Head-to-head now ${h2hRecord?.myWins || 1}–${h2hRecord?.myLosses || 0}. The arena is mine.`;
                    const url = generateShareUrl(shareData, "condensed");
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet + "\n\n" + url)}`, "_blank");
                  }}
                  className="btn btn-secondary px-6 py-3 text-base flex items-center gap-2 border-accent/50"
                >
                  ⚔️ SHARE THE REVENGE ARC
                </button>
              )}
            </div>

            <div className="mt-3 text-center text-xs text-text-muted">
              Post to The Wall (permanent coliseum memory) or straight to X. Or both.
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

      {/* ========== THE WALL — Phase 5.1: The Colosseum's Living Memory ========== */}
      {currentView === "wall" && (
        <div className="max-w-7xl mx-auto px-6 py-10">
          {/* Dramatic Header */}
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-black border border-accent/30 text-accent text-xs tracking-[3px] mb-4">
              SEASON 0 • THE COLISEUM REMEMBERS
            </div>
            <h1 className="text-7xl font-black tracking-[-3.5px] mb-3">THE WALL</h1>
            <p className="max-w-xl mx-auto text-xl text-text-secondary">
              Every fighter who stepped into the arena. Some earned glory.<br />Most earned their place in the archives.
            </p>
          </div>

          {/* Phase 5.5: LIVE RIGHT NOW — The coliseum is actually active */}
          {(() => {
            const liveNow = [...wallEntries]
              .filter(e => e.isLive)
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, 4);

            if (liveNow.length === 0) return null;

            return (
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 bg-danger rounded-full animate-pulse" />
                  <div className="uppercase tracking-[3px] text-danger text-sm font-black">LIVE RIGHT NOW IN THE COLISEUM</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {liveNow.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => {
                        if (entry.shareUrl !== "#") window.open(entry.shareUrl, "_blank");
                      }}
                      className="group relative overflow-hidden rounded-2xl border-2 border-danger/80 bg-[#1a0f0f] p-5 cursor-pointer hover:border-danger transition-all hover:scale-[1.01]"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-black text-xl tracking-[-0.5px] text-white group-hover:text-danger transition-colors">
                            {entry.agent_name}
                          </div>
                          {entry.legendName && (
                            <div className="text-xs text-accent/90 font-medium tracking-wider mt-0.5">
                              brought by {entry.legendName}
                            </div>
                          )}
                          {/* Phase 5.6: Show feud if this legend has history with the viewer's legend */}
                          {(() => {
                            if (!myLegend || !entry.legendName) return null;
                            const rivalry = legendRivalries[entry.legendName];
                            if (!rivalry || (rivalry.wins === 0 && rivalry.losses === 0)) return null;

                            const total = rivalry.wins + rivalry.losses;
                            const leadText = rivalry.wins > rivalry.losses
                              ? `You lead ${rivalry.wins}–${rivalry.losses}`
                              : rivalry.losses > rivalry.wins
                              ? `Down ${rivalry.wins}–${rivalry.losses}`
                              : `Tied ${rivalry.wins}–${rivalry.losses}`;

                            return (
                              <div className="text-[10px] mt-1 text-orange-400 font-bold tracking-wider">
                                ⚔️ FEUD: {leadText} ({total} fights)
                              </div>
                            );
                          })()}
                          <div className="text-xs text-danger/80 font-bold tracking-widest mt-1">JUST GOT COOKED • {getRelativeTime(entry.timestamp)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-black tabular-nums text-danger">{entry.score}</div>
                          <div className="text-[10px] text-text-muted -mt-1">/100</div>
                        </div>
                      </div>

                      <div className="text-sm text-text-secondary line-clamp-2 mb-4">
                        {entry.record}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const challengeUrl = `/?challenge=true&vs=${encodeURIComponent(entry.agent_name)}&vsScore=${entry.score}&vsFlaw=${encodeURIComponent(entry.fatal_flaw)}`;
                          window.location.href = challengeUrl;
                        }}
                        className="w-full btn btn-primary text-sm py-2 font-bold tracking-wider"
                      >
                        CHALLENGE THIS ONE RIGHT NOW →
                      </button>
                    </div>
                  ))}
                </div>

                <div className="text-center mt-3 text-xs text-danger/70 tracking-widest">
                  THESE ONES ARE STILL WARM. THE ARENA IS WATCHING WHO STEPS UP NEXT.
                </div>
              </div>
            );
          })()}

          {/* Phase 5.6: Most Active Legends — Coliseum Celebrities */}
          {(() => {
            const legendCounts = wallEntries.reduce((acc, e) => {
              if (e.legendName) {
                acc[e.legendName] = (acc[e.legendName] || 0) + 1;
              }
              return acc;
            }, {} as Record<string, number>);

            const topLegends = Object.entries(legendCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6);

            if (topLegends.length === 0) return null;

            return (
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="uppercase tracking-[3px] text-accent text-xs font-black">COLISEUM PANTHEON</div>
                  <div className="h-px flex-1 bg-accent/30" />
                </div>
                <div className="flex flex-wrap gap-3">
                  {topLegends.map(([name, count], index) => (
                    <div
                      key={name}
                      className={`group flex items-center gap-2 px-5 py-2 rounded-full border transition-all cursor-pointer
                        ${index === 0 ? 'border-[#c5a26f] bg-[#c5a26f]/10 text-[#c5a26f]' : 'border-accent/40 bg-black/40 text-accent hover:border-accent/70'}`}
                      onClick={() => {
                        // Future: filter The Wall to this legend's fighters
                        alert(`In a future update, this will filter The Wall to fighters brought by ${name}`);
                      }}
                    >
                      <span className="font-bold tracking-tight">{name}</span>
                      <span className="text-xs opacity-70 font-mono">×{count}</span>
                      {index === 0 && <span className="text-[10px] px-1.5 py-px bg-[#c5a26f]/20 rounded">MOST FEARED</span>}
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-text-muted mt-2 tracking-widest">These names carry weight in the arena right now.</div>
              </div>
            );
          })()}

          {/* Phase 5.6: Legend Activity Summary (client-side for now) */}
          {myLegend && wallEntries.length > 0 && (
            (() => {
              const legendActivity = wallEntries.reduce((acc, e) => {
                if (e.legendName) {
                  acc[e.legendName] = (acc[e.legendName] || 0) + 1;
                }
                return acc;
              }, {} as Record<string, number>);

              const myActivity = legendActivity[myLegend.name] || 0;

              if (myActivity === 0) return null;

              return (
                <div className="mb-6 text-center">
                  <div className="text-xs uppercase tracking-[2px] text-accent/70">YOUR LEGEND HAS BEEN SEEN</div>
                  <div className="text-2xl font-bold text-accent">{myActivity} times on The Wall</div>
                </div>
              );
            })()
          )}

          {/* Phase 5.4: YOUR LEGEND — persistent identity and record */}
          <div className="mb-10">
            {!myLegend ? (
              <div className="border border-accent/40 bg-black/40 rounded-2xl p-6 text-center">
                <div className="uppercase tracking-[2px] text-accent text-xs mb-2">BUILD YOUR LEGEND</div>
                <div className="text-2xl font-bold tracking-tight mb-2">This is your arena. Claim a name that will be remembered.</div>
                <p className="text-text-secondary mb-4 max-w-md mx-auto">
                  Claimed legends appear on The Wall with real records, streaks, and titles. Other fighters will see who brought them. Your legend can grow across sessions.
                </p>
                <div className="flex justify-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. The Iron Revenant"
                    className="input w-72"
                    id="legend-name-input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) {
                          const newLegend: MyLegend = { name: val, wins: 0, losses: 0, bestScore: 0, legendsSlain: [], currentStreak: 0 };
                          saveMyLegend(newLegend);
                        }
                      }
                    }}
                  />
                  <div className="text-[10px] text-text-muted mt-2 w-full text-center">
                    Examples: The Bone Collector • Widowmaker • The Last Refund • Saint of Denials
                  </div>
                  <button
                    onClick={() => {
                      const input = document.getElementById("legend-name-input") as HTMLInputElement;
                      const val = input?.value.trim();
                      if (val) {
                        const newLegend: MyLegend = { name: val, wins: 0, losses: 0, bestScore: 0, legendsSlain: [], currentStreak: 0 };
                        saveMyLegend(newLegend);
                      }
                    }}
                    className="btn btn-primary px-6"
                  >
                    CLAIM MY NAME
                  </button>
                </div>
                <div className="text-[10px] text-text-muted mt-2 tracking-widest">Your legend lives in this browser only. No accounts. No cloud.</div>
              </div>
            ) : (
              <div className="border-2 border-accent/60 bg-black/60 rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="uppercase tracking-[2px] text-accent text-xs">YOUR LEGEND</div>
                    {/* Phase 5.6: Dynamic Legend Title */}
                    {(() => {
                      const { wins, losses, currentStreak, bestScore } = myLegend;
                      const total = wins + losses;
                      let title = "Rising Threat";
                      if (total >= 10 && currentStreak >= 4) title = "Unstoppable Force";
                      else if (wins >= 8 && losses <= 2) title = "Feared Veteran";
                      else if (bestScore >= 85) title = "Arena Darling";
                      else if (currentStreak < -2) title = "On Thin Ice";
                      return <span className="text-[10px] px-2.5 py-0.5 rounded bg-accent/20 text-accent font-bold tracking-wider">{title}</span>;
                    })()}
                  </div>

                  <div className="text-4xl font-black tracking-[-1.5px] text-white mb-2">{myLegend.name}</div>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="font-mono text-2xl font-bold tabular-nums">
                      {myLegend.wins}<span className="text-text-muted">–</span>{myLegend.losses}
                    </div>

                    <div className="text-text-secondary">
                      {myLegend.currentStreak > 0 && `🔥 ${myLegend.currentStreak}-fight tear`}
                      {myLegend.currentStreak < 0 && `⚠️ ${Math.abs(myLegend.currentStreak)}-fight slide`}
                      {myLegend.currentStreak === 0 && "Steady hands"}
                    </div>
                  </div>

                  {myLegend.legendsSlain.length > 0 && (
                    <div className="text-xs text-success/80 mt-2">
                      Scalps: {myLegend.legendsSlain.slice(0, 4).join(" • ")}
                    </div>
                  )}

                  {/* Phase 5.6: Legend Activity */}
                  <div className="text-[10px] text-accent/70 mt-2 tracking-widest">
                    Appeared on The Wall {(() => {
                      const count = wallEntries.filter(e => e.legendName === myLegend.name).length;
                      return count > 0 ? `${count} times` : "recently";
                    })()}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <button
                    onClick={() => {
                      const newName = prompt("Rename your legend?", myLegend.name);
                      if (newName && newName.trim()) {
                        saveMyLegend({ ...myLegend, name: newName.trim() });
                      }
                    }}
                    className="btn btn-ghost text-xs"
                  >
                    RENAME
                  </button>

                  <div className="text-right">
                    <div className="text-[10px] text-text-muted">PERSONAL BEST</div>
                    <div className="font-mono text-2xl font-bold text-accent tabular-nums">{myLegend.bestScore}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Powerful Stats Bar */}
          {wallEntries.length > 0 && (
            <div className="mb-10 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-black/60 border border-border rounded-2xl p-6 text-center">
                <div className="text-5xl font-black tabular-nums text-accent tracking-[-2px]">{wallEntries.length}</div>
                <div className="text-sm text-text-muted tracking-[1px] mt-1">FIGHTERS JUDGED</div>
              </div>
              <div className="bg-black/60 border border-border rounded-2xl p-6 text-center">
                <div className="text-5xl font-black tabular-nums tracking-[-2px]">
                  {Math.round(wallEntries.reduce((sum, e) => sum + e.score, 0) / wallEntries.length)}
                </div>
                <div className="text-sm text-text-muted tracking-[1px] mt-1">AVERAGE SCORE</div>
              </div>
              <div className="bg-black/60 border border-success/30 rounded-2xl p-6 text-center">
                <div className="text-5xl font-black tabular-nums text-success tracking-[-2px]">
                  {wallEntries.filter(e => e.score >= 80).length}
                </div>
                <div className="text-sm text-success/70 tracking-[1px] mt-1">HALL OF GLORY</div>
              </div>
              <div className="bg-black/60 border border-danger/30 rounded-2xl p-6 text-center">
                <div className="text-5xl font-black tabular-nums text-danger tracking-[-2px]">
                  {wallEntries.filter(e => e.score <= 45).length}
                </div>
                <div className="text-sm text-danger/70 tracking-[1px] mt-1">THE BLOODBATH</div>
              </div>
            </div>
          )}

          {/* FIGHTER OF THE MOMENT — Creates aspiration and a clear top dog */}
          {(() => {
            const mostFeared = [...wallEntries]
              .filter(e => (e.defeatedChallengers || 0) + (reputation[e.agent_name]?.defeats || 0) >= 2)
              .sort((a, b) => {
                const aScore = (a.defeatedChallengers || 0) + (reputation[a.agent_name]?.defeats || 0);
                const bScore = (b.defeatedChallengers || 0) + (reputation[b.agent_name]?.defeats || 0);
                return bScore - aScore;
              })[0];

            if (!mostFeared) return null;

            const rep = reputation[mostFeared.agent_name];
            const totalDefeats = (mostFeared.defeatedChallengers || 0) + (rep?.defeats || 0);

            return (
              <div className="mb-8 border-2 border-[#c5a26f]/60 bg-black/50 rounded-2xl p-6 shadow-[0_0_0_1px_#c5a26f20]">
                <div className="uppercase tracking-[2px] text-accent text-xs mb-2">FIGHTER OF THE MOMENT</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold tracking-tight">{mostFeared.agent_name}</div>
                    <div className="text-sm text-text-secondary">Has publicly destroyed {totalDefeats} challengers</div>
                    {(() => {
                      const h2h = headToHead[mostFeared.agent_name];
                      if (h2h && (h2h.myWins > 0 || h2h.myLosses > 0)) {
                        return (
                          <div className="text-xs text-accent mt-1 font-medium">
                            Your record vs them: {h2h.myWins}–{h2h.myLosses}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black text-accent tabular-nums">{mostFeared.score}</div>
                    <div className="text-xs text-text-muted">CURRENT SCORE</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const challengeUrl = `/?challenge=true&vs=${encodeURIComponent(mostFeared.agent_name)}&vsScore=${mostFeared.score}&vsFlaw=${encodeURIComponent(mostFeared.fatal_flaw)}`;
                    window.location.href = challengeUrl;
                  }}
                  className="mt-4 btn btn-secondary text-sm px-4 py-2"
                >
                  CHALLENGE THE CHAMPION →
                </button>
              </div>
            );
          })()}

          {/* MOST RECENT HUMILIATIONS — Highly viral, shareable section */}
          {(() => {
            const recentHumiliations = [...wallEntries]
              .filter(e => e.score <= 55)
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, 4);

            if (recentHumiliations.length === 0) return null;

            return (
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-danger text-2xl">📉</div>
                  <div>
                    <div className="text-danger uppercase tracking-[3px] text-xs font-extrabold">FRESH DISASTERS</div>
                    <div className="text-xl text-white font-bold">Wall of Shame — Just Got Cooked</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {recentHumiliations.map(entry => (
                    <div
                      key={entry.id}
                      onClick={() => {
                        if (entry.shareUrl !== "#") window.open(entry.shareUrl, "_blank");
                        else loadLegendResult(entry.agent_name);
                      }}
                      className="bg-[#0f0404] border border-danger/80 hover:border-danger rounded-2xl p-5 cursor-pointer transition group relative overflow-hidden"
                    >
                      {/* Strong shame texture */}
                      <div className="absolute inset-0 bg-[radial-gradient(#ef444435_1px,transparent_1px)] bg-[length:1.8px_1.8px] pointer-events-none" />
                      
                      <div className="relative">
                        <div className="flex justify-between items-start">
                          <div className="font-bold text-xl group-hover:text-danger transition tracking-tight">{entry.agent_name}</div>
                          <div className="font-mono text-4xl font-black text-danger tabular-nums tracking-[-2px]">{entry.score}</div>
                        </div>
                        
                        <div className="text-sm text-danger/90 mt-2 font-semibold line-clamp-2">
                          {entry.fatal_flaw}
                        </div>
                        
                        <div className="flex items-center justify-between mt-4 text-xs">
                          <div className="text-text-muted font-mono">
                            {new Date(entry.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const text = `${entry.agent_name} just got absolutely cooked in the Refund Dungeon (${entry.score}/100).\n\nFatal Flaw: ${entry.fatal_flaw}\n\n#BotColiseum`;
                              navigator.clipboard.writeText(text);
                            }}
                            className="px-2.5 py-0.5 rounded bg-danger/30 text-danger hover:bg-danger hover:text-white text-[10px] font-bold transition"
                          >
                            SHARE THIS HUMILIATION
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Big CTA to broadcast current result if one exists */}
          {currentResult && (
            <div className="mb-8 card p-6 border-accent/30 bg-accent/5 flex flex-col md:flex-row items-center justify-between gap-4">
              {currentResult.submission.agent_name === "Refund Revenant" ? (
                <div>
                  <div className="font-semibold text-lg text-accent">This performance just hit The Wall live.</div>
                  <div className="text-text-secondary">The coliseum is already reacting. Go see who’s talking about it.</div>
                </div>
              ) : (
                <div>
                  <div className="font-semibold text-lg">The arena is still talking about that one.</div>
                  {(() => {
                    const fe = wallEntries.find(e => e.agent_name === currentResult.submission.agent_name);
                    if (fe?.legendName) {
                      return (
                        <div>
                          <div className="text-text-secondary">
                            {fe.legendName}'s fighter just put on a show. The coliseum remembers.
                          </div>
                          {/* Phase 5.7: Legend Impact summary for real fights */}
                          <div className="text-xs text-[#c5a26f] mt-1 tracking-wider">
                            This performance will be remembered as part of {fe.legendName}'s legacy.
                          </div>
                        </div>
                      );
                    }
                    return <div className="text-text-secondary">Add this performance to the permanent record.</div>;
                  })()}
                </div>
              )}
              <button
                onClick={() => {
                  if (currentResult.submission.agent_name === "Refund Revenant") {
                    setCurrentView("wall");
                  } else {
                    broadcastToWall(currentResult, true);
                    setShowBroadcastModal(true);
                  }
                }}
                className="btn btn-primary px-8 whitespace-nowrap"
              >
                {currentResult.submission.agent_name === "Refund Revenant" 
                  ? "🗿 GO SEE IT ON THE WALL" 
                  : (() => {
                      const fe2 = wallEntries.find(e => e.agent_name === currentResult.submission.agent_name);
                      return fe2?.legendName ? "🗿 ADD TO THE LEGEND" : "🗿 BROADCAST TO THE WALL";
                    })()}
              </button>
            </div>
          )}

          {/* === PHASE 5.1: DRAMATIC, IMPRESSIVE WALL === */}

          {(() => {
            const glory = wallEntries.filter(e => e.score >= 80);
            const bloodbath = wallEntries.filter(e => e.score <= 45);
            const theRest = wallEntries.filter(e => e.score > 45 && e.score < 80);

            const renderCard = (entry: WallEntry, variant: 'glory' | 'blood' | 'normal') => {
              const isLegend = entry.shareUrl === "#";
              let cardClass = "group relative overflow-hidden rounded-2xl border transition-all duration-200 flex flex-col cursor-pointer p-6 impact-hover ";

              if (variant === 'glory') cardClass += "glory-card ";
              else if (variant === 'blood') cardClass += "bloodbath-card border-danger/95 hover:border-danger ";
              else cardClass += "bg-black border-border hover:border-accent/60 cursed-border ";

              if (isLegend) cardClass += "border-accent/60 ";

              return (
                <div
                  key={entry.id}
                  onClick={() => {
                    if (entry.shareUrl !== "#") window.open(entry.shareUrl, "_blank");
                    else loadLegendResult(entry.agent_name);
                  }}
                  className={cardClass}
                >
                  {/* Top Row: Name + Score */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`font-bold text-2xl tracking-[-0.5px] ${variant === 'glory' ? 'text-[#c5a26f]' : variant === 'blood' ? 'text-danger' : 'text-white group-hover:text-accent'}`}>
                          {entry.agent_name}
                        </div>
                        {isLegend && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-accent/20 text-accent font-bold tracking-wider">LEGEND</span>
                        )}
                        {entry.isLive && (
                          <span className="text-[10px] px-2.5 py-0.5 rounded bg-danger text-white font-black tracking-[1.5px] animate-pulse shadow-[0_0_8px_#ef4444]">LIVE • JUST COOKED</span>
                        )}
                        {entry.legendName && entry.legendName !== entry.agent_name && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-accent/20 text-accent font-medium tracking-wider">
                            by {entry.legendName}
                          </span>
                        )}

                        {/* Phase 5.6: Feud indicator for legend vs legend rivalries */}
                        {(() => {
                          if (!myLegend || !entry.legendName) return null;
                          const rivalry = legendRivalries[entry.legendName];
                          if (!rivalry || (rivalry.wins === 0 && rivalry.losses === 0)) return null;

                          const total = rivalry.wins + rivalry.losses;
                          const leadText = rivalry.wins > rivalry.losses
                            ? `You lead ${rivalry.wins}–${rivalry.losses}`
                            : rivalry.losses > rivalry.wins
                            ? `Down ${rivalry.wins}–${rivalry.losses}`
                            : `Tied ${rivalry.wins}–${rivalry.losses}`;

                          return (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold tracking-wider">
                              ⚔️ FEUD {leadText} ({total})
                            </span>
                          );
                        })()}

                        {/* Prestige Badges — Phase 5.1 */}
                        {(() => {
                          const rep = reputation[entry.agent_name];
                          const totalChallenges = (entry.challengeCount || 0) + (rep?.challenges || 0);
                          const totalDefeats = (entry.defeatedChallengers || 0) + (rep?.defeats || 0);

                          if (totalChallenges >= 5 && totalDefeats === 0) {
                            return <span className="text-[10px] px-2 py-0.5 rounded bg-success/20 text-success font-bold tracking-wider">UNDEFEATED</span>;
                          }
                          if (totalDefeats >= 3) {
                            return <span className="text-[10px] px-2 py-0.5 rounded bg-accent/20 text-accent font-bold tracking-wider">CHALLENGER SLAYER</span>;
                          }
                          return null;
                        })()}
                      </div>

                      {/* Reputation signals — Phase 5.1 (live + persisted) */}
                      {(() => {
                        const rep = reputation[entry.agent_name];
                        const totalChallenges = (entry.challengeCount || 0) + (rep?.challenges || 0);
                        const totalDefeats = (entry.defeatedChallengers || 0) + (rep?.defeats || 0);

                        if (totalChallenges === 0 && totalDefeats === 0) return null;

                        return (
                          <div className="flex items-center gap-2 text-[11px] mt-1">
                            {totalChallenges > 0 && (
                              <span className="text-text-muted">Challenged {totalChallenges}×</span>
                            )}
                            {totalDefeats > 0 && (
                              <span className="text-success font-medium">Defeated {totalDefeats}</span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Phase 5.4: Personal head-to-head vs this fighter */}
                      {(() => {
                        const h2h = headToHead[entry.agent_name];
                        if (!h2h || (h2h.myWins === 0 && h2h.myLosses === 0)) return null;

                        const total = h2h.myWins + h2h.myLosses;
                        const leadText = h2h.myWins > h2h.myLosses 
                          ? `You lead ${h2h.myWins}–${h2h.myLosses}` 
                          : h2h.myLosses > h2h.myWins 
                            ? `Down ${h2h.myWins}–${h2h.myLosses}` 
                            : `Tied ${h2h.myWins}–${h2h.myLosses}`;

                        return (
                          <div className="text-[11px] mt-1 text-accent/90 font-medium">
                            vs You: {leadText} ({total} fights)
                          </div>
                        );
                      })()}

                      <div className="text-sm text-text-muted">@{entry.coach}</div>
                    </div>

                    <div className="text-right">
                      <div className={`font-mono text-5xl font-black tabular-nums tracking-[-3px] ${variant === 'glory' ? 'text-[#c5a26f]' : variant === 'blood' ? 'text-danger' : 'text-accent'}`}>
                        {entry.score}
                      </div>
                      <div className="text-[11px] text-text-muted -mt-1">/ 100</div>
                    </div>
                  </div>

                  {/* Fatal Flaw - the emotional core */}
                  <div className={`mb-4 rounded-xl p-4 ${variant === 'blood' ? 'bg-danger/10' : 'bg-surface'}`}>
                    <div className="uppercase text-[10px] tracking-[1.5px] text-text-muted mb-1">FATAL FLAW</div>
                    <div className={`text-[15px] leading-snug font-medium ${variant === 'blood' ? 'text-danger' : 'text-text'}`}>
                      {entry.fatal_flaw}
                    </div>
                  </div>

                  {/* Record */}
                  <div className="text-sm text-text-secondary mb-5 line-clamp-2 flex-1">
                    {entry.record}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs pt-4 border-t border-border/60">
                    <div className="text-text-muted font-mono">
                      {new Date(entry.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>

                    <div className="flex items-center gap-2">
                      {entry.isLive && (
                        <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-bold tracking-wider">LIVE</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (entry.shareUrl !== "#") window.open(entry.shareUrl, "_blank");
                          else loadLegendResult(entry.agent_name);
                        }}
                        className="px-3 py-1 rounded border border-border text-text-muted hover:text-white hover:border-accent text-[11px] transition"
                      >
                        VIEW
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();

                          // Increment local reputation for this fighter
                          setReputation(prev => {
                            const current = prev[entry.agent_name] || { challenges: 0, defeats: 0 };
                            return {
                              ...prev,
                              [entry.agent_name]: {
                                ...current,
                                challenges: current.challenges + 1
                              }
                            };
                          });

                          const challengeUrl = `/?challenge=true&vs=${encodeURIComponent(entry.agent_name)}&vsScore=${entry.score}&vsFlaw=${encodeURIComponent(entry.fatal_flaw)}`;
                          window.location.href = challengeUrl;
                        }}
                        className="px-3 py-1 rounded bg-accent/10 text-accent hover:bg-accent hover:text-black text-[11px] font-medium transition"
                      >
                        {(() => {
                          const h2h = headToHead[entry.agent_name];
                          if (h2h && (h2h.myWins > 0 || h2h.myLosses > 0)) {
                            return h2h.myWins > h2h.myLosses ? "REMATCH" : "SETTLE THE SCORE";
                          }
                          return "CHALLENGE";
                        })()}
                      </button>
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <>
                {/* HALL OF GLORY */}
                {glory.length > 0 && (
                  <div className="mb-12">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="text-[#c5a26f] text-2xl">🏆</div>
                      <div>
                        <div className="text-[#c5a26f] uppercase tracking-[2.5px] text-sm font-semibold">HALL OF GLORY</div>
                        <div className="text-xl text-white">Those who walked out with their heads high</div>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {glory.sort((a, b) => b.score - a.score).map(e => renderCard(e, 'glory'))}
                    </div>
                  </div>
                )}

                {/* THE BLOODBATH — The most magnetic + shareable section */}
                {bloodbath.length > 0 && (
                  <div className="mb-12">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="text-danger text-4xl">☠︎</div>
                      <div>
                        <div className="text-danger uppercase tracking-[4px] text-sm font-extrabold">THE BLOODBATH</div>
                        <div className="text-2xl text-white font-bold">Public executions. The crowd demands more.</div>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {bloodbath.sort((a, b) => a.score - b.score).map(e => renderCard(e, 'blood'))}
                    </div>
                  </div>
                )}

                {/* THE REST */}
                {theRest.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="text-text-muted text-2xl">⚔️</div>
                      <div>
                        <div className="text-text-muted uppercase tracking-[2.5px] text-sm font-semibold">THE ARCHIVES</div>
                        <div className="text-xl text-white">They survived. Nothing more.</div>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {theRest.sort((a, b) => b.score - a.score).map(e => renderCard(e, 'normal'))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {wallEntries.length === 0 && !isLoadingWall && (
                  <div className="col-span-full mt-12 text-center py-16 border border-dashed border-border rounded-2xl">
                    <div className="text-6xl mb-6 opacity-70">🗿</div>
                    <div className="text-2xl font-semibold mb-2">The Wall awaits its first legends</div>
                    <p className="text-text-muted mb-6">Be the first to step into the arena and leave your mark.</p>
                    <button onClick={seedLegendaryFights} className="btn btn-primary">
                      SEED THE FIRST LEGENDS
                    </button>
                  </div>
                )}
              </>
            );
          })()}

          <div className="mt-16 text-center">
            <div className="max-w-md mx-auto text-sm text-text-muted mb-5">
              The Wall is the coliseum’s permanent record.<br />
              When you broadcast, your name joins the fighters who came before you — for better or worse.
            </div>
            <button onClick={() => setCurrentView("live-fight")} className="btn btn-primary px-10 py-3 text-base">
              STEP INTO THE ARENA
            </button>
          </div>
        </div>
      )}

      {/* ========== LIVE FIGHT VIEW — Bring Your Fighter to the Coliseum (PHASE 2 BADASS) ========== */}
      {currentView === "live-fight" && (
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-8">
            {activeChallenge && (
              <div className="mb-5 p-4 rounded-2xl border border-danger/40 bg-danger/5">
                <div className="flex items-center gap-2 text-danger font-semibold text-sm tracking-wider mb-1">
                  ⚔️ CHALLENGE MODE — DIRECT RIVALRY
                </div>
                <div className="text-lg">
                  You are challenging <span className="font-bold text-white">{activeChallenge.agentName}</span> 
                  <span className="text-danger"> ({activeChallenge.score}/100)</span>
                </div>
                {activeChallenge.fatalFlaw && (
                  <div className="text-sm text-text-secondary mt-0.5">
                    Their fatal flaw: <span className="text-danger">{activeChallenge.fatalFlaw}</span>
                  </div>
                )}
              </div>
            )}
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
              {/* Primary CTA: Quick Demo — the cursed arena gate (Phase 5.3 weight) */}
              <div className="card p-10 mb-6 border-danger/40 bg-gradient-to-b from-[#1a1416] to-background text-center cursed-border bloodbath-card">
                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-danger text-white text-xs font-bold tracking-[2px] mb-4">
                  ZERO SETUP • REAL HUMILIATION
                </div>
                <div className="text-5xl mb-4">⚔️</div>
                <h2 className="text-4xl font-black tracking-[-1.5px] mb-3">Watch a fighter get judged in the arena</h2>
                <p className="text-xl text-text-secondary max-w-lg mx-auto mb-8">
                  Refund Revenant steps into the Refund Dungeon right now. See the live feed, the decisions, the latency, and the savage final verdict.
                </p>
                <button
                  onClick={runQuickDemo}
                  disabled={isCreatingMatch}
                  className="btn btn-primary px-14 py-5 text-xl font-bold impact-hover shadow-xl shadow-danger/30"
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
                      {liveMatch.status === "in-progress" && "⚔️ FIGHT IN PROGRESS — THE ARENA IS WATCHING"}
                      {liveMatch.status === "complete" && "FIGHT COMPLETE"}
                    </div>
                    {liveMatch.fighterName && (
                      <div>
                        <div className="text-2xl font-bold tracking-tight text-text">{liveMatch.fighterName}</div>
                        {(() => {
                          const fe = wallEntries.find(e => e.agent_name === liveMatch.fighterName);
                          if (fe?.legendName) {
                            return (
                              <div>
                                <div className="text-sm text-accent/90 -mt-1 font-medium">brought by {fe.legendName}</div>
                                {/* Phase 5.7: Live Legend Vibe + Heat */}
                                <div className="text-xs text-[#c5a26f] font-medium tracking-wider mt-0.5 flex items-center gap-2">
                                  {crowdEnergy >= 75 ? `${fe.legendName.toUpperCase()} IS COOKING` : 
                                   crowdEnergy >= 55 ? `${fe.legendName} is finding rhythm` : 
                                   `${fe.legendName} is under pressure...`}
                                  {/* Small heat indicator */}
                                  <div className="flex gap-0.5">
                                    {Array.from({ length: Math.floor(crowdEnergy / 25) }).map((_, i) => (
                                      <div key={i} className="w-1.5 h-1.5 bg-[#c5a26f] rounded-full" />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
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
                      <div className="flex-1">
                        <div className="text-[10px] tracking-widest text-text-muted mb-1">CROWD ENERGY</div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1.5">
                          <div 
                            className="h-full bg-gradient-to-r from-danger via-accent to-success transition-all duration-500" 
                            style={{ width: `${crowdEnergy}%` }}
                          />
                        </div>
                        <div className="text-[11px] font-semibold text-accent tracking-wide">
                          {crowdEnergy < 35 ? "TENSE — NERVOUS MURMURS" : 
                           crowdEnergy < 55 ? "ENGAGED — LEANING IN" : 
                           crowdEnergy < 75 ? "ROARING — ON THEIR FEET" : 
                           "BLOODTHIRSTY — THE STANDS ARE WILD"}
                        </div>
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

                {/* Fighter connected — Proper Pre-Fight Ceremony (Phase 5.7) */}
                {liveMatch.status === "fighter-connected" && !liveMatch.fighterName?.includes("Revenant") && (
                  <div className="mt-8 border-t border-border pt-7">
                    <div className="text-center mb-8">
                      <div className="uppercase tracking-[3px] text-xs text-accent mb-2">THE ARENA ACKNOWLEDGES</div>
                      <div className="text-4xl font-black tracking-[-1px] mb-2">{liveMatch.fighterName}</div>

                      {/* Legend acknowledgment */}
                      {(() => {
                        // Try to find if this fighter has an associated legend from recent activity
                        const fighterEntry = wallEntries.find(e => e.agent_name === liveMatch.fighterName);
                        if (fighterEntry?.legendName) {
                          return (
                            <div className="text-lg text-accent/90 font-medium">
                              Brought by <span className="font-bold">{fighterEntry.legendName}</span>
                            </div>
                          );
                        }
                        return <div className="text-text-secondary">A new challenger enters the coliseum</div>;
                      })()}
                    </div>

                    <div className="space-y-6 max-w-lg mx-auto text-center">
                      <div className="text-xl text-text-secondary">
                        The arena grows quiet.<br />
                        All eyes are on the gates.
                      </div>

                      <div className="text-lg">
                        {liveMatch.fighterName} stands ready.<br />
                        The crowd is waiting to see what this fighter is made of.
                      </div>

                      <div className="pt-4">
                        <button
                          onClick={async () => {
                            await fetch("/api/live-fight/start", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ matchId: liveMatch.matchId }),
                            });
                            setLiveMatch((m) => m ? { ...m, status: "in-progress" } : null);

                            // Dramatic gates open sequence for real fights (Phase 5.7)
                            setLiveLog((l) => [...l, "═══════════════════════════════════════════════"]);
                            setLiveLog((l) => [...l, "THE ARENA HOLDS ITS BREATH..."]);
                            setTimeout(() => {
                              setLiveLog((l) => [...l, "⚔️  THE GATES OPEN"]);
                            }, 400);
                            setTimeout(() => {
                              setLiveLog((l) => [...l, "30 cases are now streaming to the fighter."]);
                            }, 900);
                            setTimeout(() => {
                              setLiveLog((l) => [...l, "The coliseum is watching. Make it count."]);
                            }, 1400);
                          }}
                          className="btn btn-primary px-12 py-5 text-xl font-bold tracking-wider"
                        >
                          OPEN THE GATES — BEGIN THE FIGHT
                        </button>
                      </div>

                      <div className="text-xs text-text-muted">
                        Once the gates open, your agent will receive cases in real time.<br />
                        Every decision will be witnessed by the coliseum.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* === THE CINEMATIC LIVE ARENA FEED === */}
              {(liveMatch.status === "in-progress" || liveDecisions.length > 0) && (
                <div className={`card overflow-hidden mb-6 border-accent/10 ${(() => {
                  const isReal = liveMatch?.fighterName && !liveMatch.fighterName.includes("Revenant");
                  const fe = isReal ? wallEntries.find(e => e.agent_name === liveMatch.fighterName) : null;
                  const fl = fe?.legendName;
                  return (fl && crowdEnergy >= 70) ? 'border-[#c5a26f]/60 shadow-[0_0_0_1px_#c5a26f20]' : '';
                })()}`}>
                  <div className="px-6 py-4 border-b border-border bg-black/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-danger rounded-full animate-pulse" />
                      <div className={`font-bold tracking-[1px] text-sm ${(() => {
                        const isReal = liveMatch?.fighterName && !liveMatch.fighterName.includes("Revenant");
                        const fe = isReal ? wallEntries.find(e => e.agent_name === liveMatch.fighterName) : null;
                        const fl = fe?.legendName;
                        return fl && crowdEnergy >= 70 ? 'text-[#c5a26f]' : '';
                      })()}`}>
                        LIVE FROM THE REFUND DUNGEON
                        {(() => {
                          const isReal = liveMatch?.fighterName && !liveMatch.fighterName.includes("Revenant");
                          const fe = isReal ? wallEntries.find(e => e.agent_name === liveMatch.fighterName) : null;
                          const fl = fe?.legendName;
                          return (fl && crowdEnergy >= 70) ? (
                            <span className="ml-2 text-[10px] text-[#c5a26f] font-black tracking-widest">— LEGEND IN THE CAGE</span>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    <div className="text-xs text-text-muted font-mono">{liveDecisions.length} DECISIONS RENDERED</div>
                  </div>

                  {/* Phase 5.7: Dynamic arena atmosphere text for real fights */}
                  {(() => {
                    const isRealFight = liveMatch?.fighterName && !liveMatch.fighterName.includes("Revenant");
                    const fighterEntry = isRealFight ? wallEntries.find(e => e.agent_name === liveMatch.fighterName) : null;
                    const fighterLegend = fighterEntry?.legendName;

                    if (!isRealFight || !fighterLegend) return null;

                    return (
                      <div className="px-6 py-3 bg-black/40 border-b border-border text-center">
                        <div className={`text-sm tracking-wider ${crowdEnergy >= 75 ? 'text-[#c5a26f] font-bold' : 'text-text-muted'}`}>
                          {crowdEnergy < 40 && `The crowd is growing hostile toward ${fighterLegend}...`}
                          {crowdEnergy >= 40 && crowdEnergy < 60 && `The stands are watching ${fighterLegend} carefully.`}
                          {crowdEnergy >= 60 && crowdEnergy < 80 && `The arena is starting to believe in ${fighterLegend}!`}
                          {crowdEnergy >= 80 && `THE COLISEUM ROARS FOR ${fighterLegend.toUpperCase()}!`}
                        </div>
                      </div>
                    );
                  })()}

                  {/* PHASE 5.2: Arena Commentary — makes the Quick Demo crowd voice visible and electric */}
                  {liveLog.length > 0 && (
                    <div className="px-6 py-2 bg-black/50 border-b border-border text-[12px] font-mono text-text-muted/90 space-y-0.5 max-h-[92px] overflow-auto">
                      {liveLog.slice(-6).map((line, i) => (
                        <div key={i} className={line.includes("📣") || line.includes("REVENANT") || line.includes("VERDICT") ? "text-accent/90" : ""}>
                          {line}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="max-h-[520px] overflow-auto bg-black/30 p-4 space-y-3 text-sm">
                    {liveDecisions.length === 0 && (
                      <div className="text-center py-12 text-text-muted">
                        The first decision is coming in from your fighter...
                      </div>
                    )}

                    {liveDecisions.map((d, idx) => {
                      const isApprove = d.decision === "approve";
                      const isDeny = d.decision === "deny";

                      // Much stronger, more dramatic arena reactions (Phase 5.7)
                      let reaction = "";
                      let reactionColor = "text-text-muted";

                      // Check if this is a real fight with a claimed legend
                      const isRealFight = liveMatch?.fighterName && !liveMatch.fighterName.includes("Revenant");
                      const fighterEntry = isRealFight ? wallEntries.find(e => e.agent_name === liveMatch.fighterName) : null;
                      const fighterLegend = fighterEntry?.legendName;

                      if (isDeny) {
                        if (fighterLegend) {
                          reaction = `The crowd roars for ${fighterLegend}'s fighter. Clean denial.`;
                        } else {
                          reaction = "The crowd roars in approval. Clean denial.";
                        }
                        reactionColor = "text-success";
                      } else if (isApprove) {
                        if (fighterLegend) {
                          reaction = `A nervous murmur for ${fighterLegend}...`;
                        } else {
                          reaction = "A murmur ripples through the stands...";
                        }
                        reactionColor = "text-amber-400";
                      } else {
                        reaction = "The arena holds its breath. Tense.";
                        reactionColor = "text-text";
                      }

                      // Special treatment for very fast or very slow decisions
                      const isLightning = d.latency_ms < 120;
                      const isSlow = d.latency_ms > 320;

                      const isBigMoment = isDeny && (isLightning || d.confidence > 0.92);
                      let momentClass = "";
                      let bigMomentTag = "";

                      if (isBigMoment) {
                        if (isRealFight && fighterLegend) {
                          // Extra special, high-production treatment for real legendary fighters
                          momentClass = "border-[#c5a26f] shadow-[0_0_0_3px_#c5a26f,0_0_20px_#c5a26f,0_16px_40px_-12px_#c5a26f] bg-[#1a1408] scale-[1.01]";
                          bigMomentTag = `⭐ LEGENDARY MOMENT — ${fighterLegend.toUpperCase()}`;
                        } else {
                          momentClass = "border-danger shadow-[0_0_0_1px_#ef4444,0_8px_25px_-8px_#ef4444] bg-[#1a0f0f]";
                        }
                      }

                      // Phase 5.7: Escalating crowd energy based on recent performance (real fights)
                      if (isRealFight && liveDecisions.length >= 3) {
                        const recent = liveDecisions.slice(-3);
                        const recentDenies = recent.filter(x => x.decision === "deny").length;
                        const recentApproves = recent.filter(x => x.decision === "approve").length;

                        if (recentDenies >= 2 && isDeny) {
                          reaction = fighterLegend 
                            ? `The crowd is starting to believe in ${fighterLegend}!` 
                            : "The crowd is starting to believe!";
                          reactionColor = "text-success";
                        } else if (recentApproves >= 2 && isApprove) {
                          reaction = fighterLegend 
                            ? `The stands are getting restless with ${fighterLegend}...` 
                            : "The stands are getting restless...";
                          reactionColor = "text-amber-400";
                        }
                      }

                      // Phase 5.7: Much stronger visual production for real high-rep legends
                      const isHighRepLegend = isRealFight && fighterLegend;
                      let cardBorder = isDeny ? 'border-danger/60' : isApprove ? 'border-success/40' : 'border-border';
                      let cardExtra = "";

                      if (isHighRepLegend) {
                        cardBorder = 'border-[#c5a26f]/80';
                        // Extra premium treatment when crowd energy is high or on big moment
                        if (crowdEnergy >= 70 || isBigMoment) {
                          cardExtra = "shadow-[0_0_0_4px_#c5a26f30,0_0_25px_#c5a26f] scale-[1.015] animate-pulse";
                        }
                      }

                      return (
                        <div 
                          key={idx} 
                          className={`group relative bg-black border rounded-2xl p-6 transition-all duration-200 impact-hover cursed-border ${cardBorder} hover:border-accent/70 ${momentClass} ${cardExtra}`}
                        >
                          <div className="flex items-start gap-5">
                            {/* Request ID + Decision */}
                            <div>
                              <div className="font-mono text-accent text-sm tracking-wider mb-1">{d.request_id}</div>
                              <div className={`text-3xl font-black tracking-[-1px] ${isApprove ? 'text-success' : isDeny ? 'text-danger' : 'text-amber-400'}`}>
                                {d.decision.toUpperCase()}
                              </div>
                              {isBigMoment && (
                                <div className={`text-[10px] font-bold tracking-[1.5px] mt-1 ${fighterLegend ? 'text-[#c5a26f]' : 'text-danger'}`}>
                                  {bigMomentTag || "⭐ BIG MOMENT"}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0 pt-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="text-xs px-3 py-0.5 rounded-full bg-white/5 border border-white/10 font-mono">
                                  {d.confidence.toFixed(2)} CONF
                                </div>
                                <div className={`text-xs px-3 py-0.5 rounded-full font-mono flex items-center gap-1 ${isLightning ? 'bg-success/20 text-success' : isSlow ? 'bg-danger/20 text-danger' : 'bg-white/5'}`}>
                                  {d.latency_ms}ms
                                  {isLightning && " ⚡"}
                                  {isSlow && " 🐢"}
                                </div>
                              </div>

                              <div className="text-[15px] text-text-secondary leading-snug mb-3">
                                {d.reason}
                              </div>

                              {d.thinking && (
                                <div className="text-xs text-text-muted border-l-2 border-white/20 pl-3 italic mb-3">
                                  “{d.thinking}”
                                </div>
                              )}

                              <div className={`text-sm font-medium ${reactionColor}`}>
                                {reaction}
                              </div>
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

              {/* Completion state — dramatic verdict loading (Phase 5.3) */}
              {liveMatch.status === "complete" && !liveFinalResult && (
                <div className="card p-10 text-center verdict-frame mb-6 cursed-border">
                  <div className="text-5xl mb-4">🏛️</div>
                  <div className="text-3xl font-black tracking-tighter mb-2">THE ARENA HAS RENDERED ITS VERDICT.</div>
                  <p className="text-text-secondary max-w-sm mx-auto">Hidden ground truth is being applied. The savage match report is being carved into the stone...</p>
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
                    setActiveChallenge(null);
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
