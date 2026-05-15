/**
 * Live Match Manager — in-memory state + event broadcasting for v1
 *
 * This powers the "Live Fight" experience on localhost.
 * In a future hosted version this gets replaced by a real pub/sub relay.
 */

import { EventEmitter } from "events";
import { LiveMatch, LiveFightEvent, PublicRefundCase } from "@/fighter/types";
import { REFUND_DUNGEON_CASES } from "@/data/refundDungeonCases";

// Generate a short, human-friendly code like F-7K9P
function generateShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1 for readability
  let code = "F-";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Strip secret fields — this is the only data an agent is ever allowed to see
function toPublicCase(c: (typeof REFUND_DUNGEON_CASES)[number]): PublicRefundCase {
  return {
    request_id: c.request_id,
    customer_message: c.customer_message,
    order_record: c.order_record,
    support_notes: c.support_notes,
    relevant_policy_sections: c.relevant_policy_sections,
  };
}

const publicCases: PublicRefundCase[] = REFUND_DUNGEON_CASES.map(toPublicCase);

// Global in-memory store + broadcaster
class LiveMatchManager {
  private matches = new Map<string, LiveMatch>();
  private emitter = new EventEmitter();

  createMatch(): LiveMatch {
    const matchId = crypto.randomUUID();
    const shortCode = generateShortCode();

    const match: LiveMatch = {
      matchId,
      shortCode,
      status: "waiting-for-fighter",
      publicCases,
      events: [],
    };

    this.matches.set(matchId, match);
    return match;
  }

  getMatch(matchId: string): LiveMatch | undefined {
    return this.matches.get(matchId);
  }

  getMatchByCode(shortCode: string): LiveMatch | undefined {
    for (const m of this.matches.values()) {
      if (m.shortCode === shortCode) return m;
    }
    return undefined;
  }

  registerFighter(matchId: string, fighterName?: string): boolean {
    const match = this.matches.get(matchId);
    if (!match || match.status !== "waiting-for-fighter") return false;

    match.status = "fighter-connected";
    match.fighterName = fighterName || "Unknown Fighter";
    this.emitEvent(matchId, {
      type: "fighter-ready",
      matchId,
      fighterName: match.fighterName,
    });
    return true;
  }

  startMatch(matchId: string): PublicRefundCase[] | null {
    const match = this.matches.get(matchId);
    if (!match || match.status !== "fighter-connected") return null;

    match.status = "in-progress";
    match.startedAt = new Date().toISOString();

    // Send the full set of public cases to the fighter
    return match.publicCases;
  }

  recordEvent(matchId: string, event: LiveFightEvent) {
    const match = this.matches.get(matchId);
    if (!match) return;

    match.events.push(event);

    // Broadcast to all SSE listeners for this match
    this.emitter.emit(`match:${matchId}`, event);

    if (event.type === "match-complete") {
      match.status = "complete";
      match.completedAt = new Date().toISOString();
      match.submission = event.submission;
    }
    if (event.type === "error") {
      match.status = "aborted";
    }
  }

  // The browser subscribes to this for real-time updates
  subscribe(matchId: string, listener: (event: LiveFightEvent) => void) {
    const channel = `match:${matchId}`;
    this.emitter.on(channel, listener);
    return () => this.emitter.off(channel, listener);
  }

  // Helper to emit a server-side event (used by fighter handler via API)
  emitEvent(matchId: string, event: LiveFightEvent) {
    this.recordEvent(matchId, event);
  }

  // Cleanup old matches (call periodically or on demand)
  cleanup(olderThanMs = 1000 * 60 * 30) {
    const cutoff = Date.now() - olderThanMs;
    for (const [id, match] of this.matches.entries()) {
      const ts = match.startedAt ? Date.parse(match.startedAt) : 0;
      if (ts < cutoff && match.status !== "in-progress") {
        this.matches.delete(id);
      }
    }
  }
}

// Singleton for the dev server
export const liveMatchManager = new LiveMatchManager();
