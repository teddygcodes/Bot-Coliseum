"use client";

import React, { useState } from "react";
import { MatchResult } from "@/lib/types";
import {
  resultToShareData,
  generateFullMarkdown,
  generateCondensedMarkdown,
  generateTweetText,
  generateShareUrl,
} from "@/lib/share";

interface BroadcastModalProps {
  result: MatchResult;
  isOpen: boolean;
  onClose: () => void;
}

export default function BroadcastModal({ result, isOpen, onClose }: BroadcastModalProps) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const shareData = resultToShareData(result, "manual_submission");

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1800);
  };

  const fullMarkdown = generateFullMarkdown(shareData);
  const condensedMarkdown = generateCondensedMarkdown(shareData);
  const tweetText = generateTweetText(shareData, "condensed");

  const fullLink = generateShareUrl(shareData, "full");
  const condensedLink = generateShareUrl(shareData, "condensed");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-background p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="text-accent text-sm tracking-[3px] uppercase mb-1">THE ARENA REMEMBERS</div>
            <h2 className="text-4xl font-bold tracking-tighter">Broadcast to the Colosseum</h2>
            <p className="text-text-secondary mt-2 text-lg">
              Claim your place on The Wall. When people click the link, they’ll see a proper cursed arena card — not a boring URL.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Full Match Record */}
        <div className="mb-6 rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-xl">Full Match Record</div>
              <div className="text-sm text-text-secondary">The official, detailed report</div>
            </div>
            <button
              onClick={() => handleCopy(fullMarkdown, "full-markdown")}
              className="btn btn-secondary text-sm px-4 py-2"
            >
              {copied === "full-markdown" ? "COPIED" : "Copy Markdown"}
            </button>
          </div>
          <button
            onClick={() => window.open(fullLink, "_blank")}
            className="btn btn-primary w-full mt-2"
          >
            Copy Shareable Link (Full)
          </button>
        </div>

        {/* Condensed Arena Record */}
        <div className="rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-xl">Condensed Arena Record</div>
              <div className="text-sm text-text-secondary">Sharp. Savage. Made for posting.</div>
            </div>
            <button
              onClick={() => handleCopy(condensedMarkdown, "condensed-markdown")}
              className="btn btn-secondary text-sm px-4 py-2"
            >
              {copied === "condensed-markdown" ? "COPIED" : "Copy Markdown"}
            </button>
          </div>

          <div className="flex gap-3 mt-2">
            <button
              onClick={() => handleCopy(tweetText, "tweet")}
              className="btn btn-secondary flex-1"
            >
              {copied === "tweet" ? "COPIED TO CLIPBOARD" : "Copy Tweet Text"}
            </button>
            <button
              onClick={() => window.open(condensedLink, "_blank")}
              className="btn btn-primary flex-1"
            >
              Copy Shareable Link (Condensed)
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-text-muted space-y-1">
          <div>Share links render as beautiful cursed arena cards on X, Discord, and everywhere else.</div>
          <div className="text-[10px]">The arena does not forgive. The arena remembers.</div>
        </div>
      </div>
    </div>
  );
}