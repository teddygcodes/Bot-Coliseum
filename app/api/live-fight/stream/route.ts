import { NextRequest } from "next/server";
import { liveMatchManager } from "@/lib/live-match";

/**
 * GET /api/live-fight/stream?matchId=...
 *
 * Server-Sent Events endpoint. The browser connects here to receive
 * real-time updates (fighter connected, decisions, completion, etc.).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");

  if (!matchId) {
    return new Response("Missing matchId", { status: 400 });
  }

  const match = liveMatchManager.getMatch(matchId);
  if (!match) {
    return new Response("Match not found", { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send the current state immediately
      const initial = {
        type: "snapshot",
        matchId,
        status: match.status,
        fighterName: match.fighterName,
        shortCode: match.shortCode,
        eventCount: match.events.length,
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`));

      // Subscribe to future events for this match
      const unsubscribe = liveMatchManager.subscribe(matchId, (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // connection closed
        }
      });

      // Keep the connection alive with a heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15000);

      // Cleanup when the client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // important for nginx proxies
    },
  });
}
