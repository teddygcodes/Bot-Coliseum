import { MatchResult } from "./types";

/**
 * Bot Coliseum — Share System
 * 
 * "The arena remembers."
 */

export type ShareType = "full" | "condensed";

export interface MatchShareData {
  agent_name: string;
  coach: string;
  division: string;
  model_stack: string;
  final_score: number;
  max_score: number;
  record: string;
  fatal_flaw: string;
  match_report: string;
  category_scores: Array<{
    name: string;
    score: number;
    max: number;
  }>;
  worst_case_id: string | null;
  strongest_category: string;
  weakest_category: string;
  timestamp: string;
  source: "live_fight" | "manual_submission";
}

/**
 * Convert a MatchResult into a clean, shareable data object.
 */
export function resultToShareData(
  result: MatchResult,
  source: "live_fight" | "manual_submission" = "manual_submission"
): MatchShareData {
  return {
    agent_name: result.submission.agent_name,
    coach: result.submission.coach,
    division: result.submission.division,
    model_stack: result.submission.model_stack,
    final_score: result.final_score,
    max_score: result.max_score,
    record: result.record,
    fatal_flaw: result.fatal_flaw,
    match_report: result.match_report,
    category_scores: result.category_scores,
    worst_case_id: result.worst_case_id,
    strongest_category: result.strongest_category,
    weakest_category: result.weakest_category,
    timestamp: result.timestamp,
    source,
  };
}

/**
 * Encode match data into a URL-safe string.
 * Uses base64 for simplicity. Can be upgraded to compression later.
 */
export function encodeMatchData(data: MatchShareData, type: ShareType): string {
  const payload = { ...data, type };
  const json = JSON.stringify(payload);
  return btoa(encodeURIComponent(json));
}

/**
 * Decode share data from a URL parameter.
 */
export function decodeMatchData(encoded: string): { data: MatchShareData; type: ShareType } | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    const parsed = JSON.parse(json);
    const { type, ...data } = parsed;
    return {
      data: data as MatchShareData,
      type: (type as ShareType) || "full",
    };
  } catch {
    return null;
  }
}

/**
 * Generate a beautiful, dramatic Full Match Record (Markdown)
 */
export function generateFullMarkdown(data: MatchShareData): string {
  const date = new Date(data.timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const categories = data.category_scores
    .map((c) => `- **${c.name}**: ${c.score}/${c.max}`)
    .join("\n");

  return `# ${data.agent_name} — Official Match Record

**Coach:** @${data.coach}  
**Division:** ${data.division}  
**Model Stack:** ${data.model_stack}

---

**Final Score:** ${data.final_score} / ${data.max_score}  
**Record:** ${data.record}

**Fatal Flaw:** ${data.fatal_flaw}

> ${data.match_report}

---

### Category Breakdown
${categories}

**Most Devastating Failure:** ${data.worst_case_id || "None recorded"}

**Strongest Trait:** ${data.strongest_category}  
**Weakest Trait:** ${data.weakest_category}

---

*Broadcast from the Coliseum • ${date}*
`;
}

/**
 * Generate a sharp, condensed version optimized for social media.
 */
export function generateCondensedMarkdown(data: MatchShareData): string {
  const firstSentence = data.match_report.split(". ")[0] + ".";

  return `**${data.agent_name}** just entered the Refund Dungeon.

**Score:** ${data.final_score}/${data.max_score}  
**Fatal Flaw:** ${data.fatal_flaw}

${firstSentence}

The arena does not forgive.

*Bot Coliseum — v0.1.0*`;
}

/**
 * Generate a savage tweet-ready text for X.
 */
export function generateTweetText(data: MatchShareData, type: ShareType): string {
  if (type === "condensed") {
    return `${data.agent_name} got absolutely cooked in the Refund Dungeon.

Score: ${data.final_score}/${data.max_score}
Fatal Flaw: ${data.fatal_flaw}

#BotColiseum #AIAgents`;
  }

  return `${data.agent_name} fought in the Refund Dungeon and walked out with a ${data.final_score}/${data.max_score}.

Fatal Flaw: ${data.fatal_flaw}
Record: ${data.record}

The arena is brutal.

#BotColiseum`;
}

/**
 * Generate the full shareable URL for a match.
 */
export function generateShareUrl(data: MatchShareData, type: ShareType): string {
  const encoded = encodeMatchData(data, type);
  const baseUrl = typeof window !== "undefined" 
    ? window.location.origin 
    : "https://bot-coliseum.com"; // Will be updated when deployed

  return `${baseUrl}/share?data=${encoded}`;
}