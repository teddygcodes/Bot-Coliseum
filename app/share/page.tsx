"use client";

import React, { useEffect, useState } from "react";
import { decodeMatchData, MatchShareData } from "@/lib/share";

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

  return (
    <div className="min-h-screen bg-background text-text">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="text-accent text-sm tracking-[4px] mb-2">OFFICIAL COLISEUM RECORD</div>
          <h1 className="text-6xl font-bold tracking-tighter">{data.agent_name}</h1>
          <p className="text-text-secondary mt-2 text-xl">Fought in the Refund Dungeon</p>
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
          {data.match_report}
        </div>

        {/* Condensed vs Full Toggle (only shown on full view for now) */}
        {isFull && (
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
        )}

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

        {/* Footer */}
        <div className="text-center text-sm text-text-muted border-t border-border pt-8">
          This record was broadcast from the Bot Coliseum • Season 0
        </div>
      </div>
    </div>
  );
}
```