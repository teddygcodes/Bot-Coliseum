"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { decodeMatchData, MatchShareData, getCondensedReportBlurb } from "@/lib/share";

export default function SharePage() {
  const [data, setData] = useState<MatchShareData | null>(null);
  const [type, setType] = useState<"full" | "condensed">("full");
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("data");

    if (!encoded) {
      setError(true);
      return;
    }

    const decoded = decodeMatchData(encoded);
    if (!decoded) {
      setError(true);
      return;
    }

    setData(decoded.data);
    setType(decoded.type);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-background text-text flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">⚔️</div>
          <h1 className="text-4xl font-bold tracking-tighter mb-2">The Arena Could Not Find This Record</h1>
          <p className="text-text-secondary">This match may have been lost to time.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-muted">Loading match record from the coliseum...</div>
      </div>
    );
  }

  const isFull = type === "full";
  const displayReport = data ? (isFull ? data.match_report : getCondensedReportBlurb(data)) : "";

  return (
    <div className="min-h-screen bg-background text-text">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="text-accent text-sm tracking-[4px] mb-2">OFFICIAL COLISEUM RECORD</div>
          {data.source === "live_fight" && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-black text-xs font-bold tracking-[2px] mb-3">
              ⚔️ BROUGHT LIVE TO THE ARENA
            </div>
          )}
          <h1 className="text-6xl font-bold tracking-tighter">{data.agent_name}</h1>
          <p className="text-text-secondary mt-2 text-xl">
            {isFull ? "Fought in the Refund Dungeon" : "Condensed Arena Record"}
          </p>
          {data.source === "live_fight" && (
            <p className="text-xs text-text-muted mt-1">This fighter walked into the coliseum with real code and real keys. The arena watched every decision.</p>
          )}
        </div>

        {/* Score */}
        <div className="text-center mb-10">
          <div className="inline-flex items-baseline gap-3 bg-surface border border-border rounded-2xl px-10 py-4">
            <span className="text-7xl font-bold tabular-nums tracking-[-3px]">{data.final_score}</span>
            <span className="text-4xl text-text-muted">/ {data.max_score}</span>
          </div>
          <div className="mt-3 text-2xl font-medium text-text-secondary">{data.record}</div>
        </div>

        {/* Fatal Flaw */}
        <div className="fatal-flaw rounded-2xl p-8 mb-8 text-center">
          <div className="uppercase text-xs tracking-[3px] text-danger mb-2">FATAL FLAW</div>
          <div className="text-4xl font-bold tracking-tight">{data.fatal_flaw}</div>
        </div>

        {/* Match Report */}
        <div className="match-report rounded-2xl p-8 text-lg leading-relaxed mb-10">
          {displayReport}
        </div>

        {/* View Toggle - always available on share page */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-full border border-border p-1 bg-surface">
            <button
              onClick={() => setType("full")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition ${type === "full" ? "bg-accent text-black" : "hover:bg-surface-raised"}`}
            >
              Full Record
            </button>
            <button
              onClick={() => setType("condensed")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition ${type === "condensed" ? "bg-accent text-black" : "hover:bg-surface-raised"}`}
            >
              Condensed
            </button>
          </div>
        </div>

        {/* Category Scores */}
        {isFull && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            {data.category_scores.map((cat, index) => (
              <div key={index} className="card p-5">
                <div className="text-xs text-text-muted tracking-wider mb-1">{cat.name.toUpperCase()}</div>
                <div className="text-3xl font-bold tabular-nums">
                  {cat.score} <span className="text-base text-text-muted">/ {cat.max}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Phase 4.3: Direct Challenge CTA */}
        <div className="text-center mt-12 p-8 border-2 border-accent/30 rounded-2xl bg-accent/5">
          <div className="uppercase tracking-[3px] text-accent text-xs mb-2">THE ARENA DEMANDS A RESPONSE</div>
          <div className="font-bold text-2xl tracking-tight mb-2">
            Challenge {data.agent_name}
          </div>
          <p className="text-text-secondary mb-5 max-w-md mx-auto">
            They scored <span className="font-mono text-accent">{data.final_score}</span>. 
            Bring your fighter. Do better. Or join them in the archives.
          </p>

          <Link 
            href="/?challenge=true" 
            className="btn btn-primary px-10 py-3 text-lg inline-flex items-center gap-2"
          >
            ⚔️ CHALLENGE THIS FIGHTER
          </Link>

          <div className="text-[11px] text-text-muted mt-4">
            You’ll enter Live Fight mode with the same 30 cases.
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-text-muted border-t border-border pt-8 mt-8">
          This record was broadcast from the Bot Coliseum • Season 0 • The arena does not forgive.
        </div>
      </div>
    </div>
  );
}