/**
 * Phase 4.2 — Shared Wall Storage
 *
 * Provides a tiny, durable, append-only log of broadcasts so The Wall
 * becomes a true coliseum-wide memory instead of per-browser localStorage.
 *
 * Storage strategy (graceful):
 * - If Upstash Redis is configured (UPSTASH_REDIS_REST_URL), use it (recommended for production on Vercel)
 * - Otherwise fall back to a module-level in-memory array (great for local dev and single-instance deploys)
 *
 * This keeps the "local-first" spirit while unlocking real network effects.
 */

import { Redis } from "@upstash/redis";
import type { SharedWallBroadcast } from "./types";

const WALL_KEY = "coliseum:wall:v1";
const MAX_ENTRIES = 50; // keep the last N broadcasts on the server

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redis;
  }
  return null;
}

// In-memory fallback (resets when the serverless function cold-starts)
let memoryWall: SharedWallBroadcast[] = [];

export async function getSharedWall(): Promise<SharedWallBroadcast[]> {
  const client = getRedis();

  if (client) {
    try {
      // We store as a Redis list (newest first)
      const entries = await client.lrange<SharedWallBroadcast>(WALL_KEY, 0, MAX_ENTRIES - 1);
      return entries || [];
    } catch (err) {
      console.error("[wall] Redis read failed, falling back to memory:", err);
    }
  }

  return [...memoryWall];
}

export async function addToSharedWall(entry: SharedWallBroadcast): Promise<void> {
  const client = getRedis();

  if (client) {
    try {
      // Remove any previous broadcast from the same agent to avoid duplicates
      // (we do a light client-side filter later too)
      await client.lrem(WALL_KEY, 0, JSON.stringify(entry)); // best effort

      // Push to front of list
      await client.lpush(WALL_KEY, entry);

      // Trim to MAX_ENTRIES
      await client.ltrim(WALL_KEY, 0, MAX_ENTRIES - 1);
      return;
    } catch (err) {
      console.error("[wall] Redis write failed, falling back to memory:", err);
    }
  }

  // Memory fallback
  memoryWall = [entry, ...memoryWall.filter(e => e.id !== entry.id)].slice(0, MAX_ENTRIES);
}

/**
 * Helper to convert a SharedWallBroadcast into something the UI can render.
 * The client will call this after fetching + decoding the `encoded` field.
 */
export async function sharedToDisplay(
  shared: SharedWallBroadcast,
  origin: string
): Promise<import("./types").WallEntry> {
  // Dynamic import to avoid circular dependency issues at module load time
  const shareModule = await import("./share");
  const { decodeMatchData } = shareModule;

  const decoded = decodeMatchData(shared.encoded);
  const data = decoded?.data;

  if (!data) {
    // Fallback for corrupted data
    return {
      id: shared.id,
      agent_name: "Unknown Fighter",
      coach: "unknown",
      score: 0,
      fatal_flaw: "Data corruption in the arena archives",
      record: "Lost to time",
      shareUrl: `${origin}/share?data=${shared.encoded}`,
      timestamp: shared.timestamp,
      isLive: shared.isLive,
    };
  }

  return {
    id: shared.id,
    agent_name: data.agent_name,
    coach: data.coach,
    score: data.final_score,
    fatal_flaw: data.fatal_flaw,
    record: data.record,
    shareUrl: `${origin}/share?data=${shared.encoded}`,
    timestamp: shared.timestamp,
    isLive: shared.isLive,
  };
}
