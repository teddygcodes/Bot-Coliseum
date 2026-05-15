import { NextResponse } from "next/server";
import { getSharedWall } from "@/lib/wall";

/**
 * GET /api/wall
 * Returns the most recent shared broadcasts from the coliseum.
 * This powers the public "The Wall" experience.
 */
export async function GET() {
  try {
    const entries = await getSharedWall();
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("[/api/wall] Error fetching shared wall:", error);
    return NextResponse.json({ entries: [] }, { status: 200 }); // graceful fallback
  }
}
