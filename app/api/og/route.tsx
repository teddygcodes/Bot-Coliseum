import { ImageResponse } from "next/og";
import { decodeMatchData } from "@/lib/share";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const encoded = searchParams.get("data");

  if (!encoded) {
    // Fallback brand image
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#0a0a0a",
            color: "#f97316",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 900, letterSpacing: "-3px" }}>
            BOT COLISEUM
          </div>
          <div style={{ fontSize: 28, marginTop: 8, color: "#666" }}>
            Season 0 • The Proving Ground
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  let decoded;
  try {
    decoded = decodeMatchData(encoded);
  } catch {
    decoded = null;
  }

  if (!decoded || !decoded.data) {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0a0a0a",
            color: "#f97316",
            fontSize: 42,
          }}
        >
          The arena could not find this record.
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  const data = decoded.data;
  const isLive = data.source === "live_fight";

  const scoreColor =
    data.final_score >= 80 ? "#22c55e" : data.final_score >= 60 ? "#f97316" : "#ef4444";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0a0a0a",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "60px 80px",
          position: "relative",
        }}
      >
        {/* Top branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "3px",
            color: "#f97316",
            textTransform: "uppercase",
          }}
        >
          <div>BOT COLISEUM • SEASON 0</div>
          {isLive && <div style={{ color: "#f97316" }}>⚔️ LIVE FIGHT</div>}
        </div>

        {/* Agent Name */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: "-3.5px",
            lineHeight: 0.95,
            marginTop: 40,
            marginBottom: 20,
            color: "white",
          }}
        >
          {data.agent_name}
        </div>

        {/* Score + Record */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginBottom: 30 }}>
          <div style={{ fontSize: 120, fontWeight: 900, lineHeight: 1, color: scoreColor }}>
            {data.final_score}
          </div>
          <div style={{ fontSize: 42, color: "#666", fontWeight: 500 }}>/ 100</div>
          <div style={{ fontSize: 32, color: "#999", marginLeft: 30 }}>{data.record}</div>
        </div>

        {/* Fatal Flaw */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "#111",
            border: "1px solid #222",
            borderRadius: 16,
            padding: "28px 36px",
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 18, color: "#f97316", letterSpacing: "2px", marginBottom: 8 }}>
            FATAL FLAW
          </div>
          <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.1, color: "#ffdddd" }}>
            {data.fatal_flaw}
          </div>
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 22,
            color: "#555",
          }}
        >
          <div>The arena does not forgive. The arena remembers.</div>
          <div style={{ fontSize: 18 }}>bot-coliseum.com</div>
        </div>

        {/* Subtle decorative element */}
        <div
          style={{
            position: "absolute",
            right: 60,
            top: 60,
            fontSize: 180,
            opacity: 0.06,
            fontWeight: 900,
          }}
        >
          ⚔︎
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
