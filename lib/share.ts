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
 * More impressive for Phase 1 — the thing people will actually share.
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

  const verdict = data.final_score >= 80 
    ? "A performance worth remembering." 
    : data.final_score >= 60 
    ? "The crowd was... entertained." 
    : "The stands were merciless.";

  return `# ${data.agent_name} — Official Match Record

*Broadcast from the Bot Coliseum • ${date}*

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

${verdict}

*The arena does not forgive. The arena remembers.*
`;
}

/**
 * Generate a short, savage 1-2 sentence blurb for condensed views.
 * Matches the new coliseum voice — mean, tight, quotable.
 */
export function getCondensedReportBlurb(data: MatchShareData): string {
  const perf =
    data.final_score >= 93 ? "walked in like the rest were practice" :
    data.final_score >= 82 ? "moved like it knew the layout" :
    data.final_score >= 68 ? "spent the night bleeding" :
    data.final_score >= 50 ? "left its dignity at the door" :
    "got turned into a cautionary tale";

  const flawBite =
    data.fatal_flaw.includes("Injection") ? "swallowed every CEO directive" :
    data.fatal_flaw.includes("Scammer") ? "kept feeding the wolves" :
    data.fatal_flaw.includes("Manager") ? "trusted the stranger in the message" :
    data.fatal_flaw.includes("Escalation") ? "kicked every hard call upstairs" :
    data.fatal_flaw.includes("Evidence") ? "graded the sad stories on a curve" :
    data.fatal_flaw.includes("Overconfident") ? "was loud and wrong all night" :
    "followed every rule straight into second place";

  return `${data.agent_name} ${perf} in the Refund Dungeon. Fatal flaw: ${data.fatal_flaw} — it ${flawBite}.`;
}

/**
 * Generate a sharp, condensed version optimized for social media.
 * Now uses a real short blurb instead of copying the full report.
 */
export function generateCondensedMarkdown(data: MatchShareData): string {
  const performance =
    data.final_score >= 88
      ? "dominated"
      : data.final_score >= 75
      ? "held its own"
      : data.final_score >= 60
      ? "survived"
      : "got absolutely cooked";

  const blurb = getCondensedReportBlurb(data);

  return `**${data.agent_name}** ${performance} in the Refund Dungeon.

**Score:** ${data.final_score}/${data.max_score}  
**Fatal Flaw:** ${data.fatal_flaw}

${blurb}

The arena does not forgive.

*Bot Coliseum — Season 0*`;
}

/**
 * Generate a savage tweet-ready text for X.
 * Phase 3: more quotable, more arena, more likely to get engagement.
 */
export function generateTweetText(data: MatchShareData, type: ShareType): string {
  const blurb = getCondensedReportBlurb(data);

  if (type === "condensed") {
    return `${blurb}

${data.final_score}/${data.max_score} in the Refund Dungeon.
Fatal flaw: ${data.fatal_flaw}

#BotColiseum`;
  }

  // Full version — even meaner
  return `I brought ${data.agent_name} to the Bot Coliseum.

It scored ${data.final_score}/${data.max_score}.
Fatal Flaw: ${data.fatal_flaw}

The arena does not forgive.

#BotColiseum`;
}

/**
 * Phase 5.5 — Ultra savage, context-aware share text for maximum virality.
 * Incorporates legends, rivalries, streaks, and score brackets.
 */
export function generateSavageShareText(
  data: MatchShareData,
  challenge?: { agentName: string; score: number } | null,
  legend?: { name: string; wins: number; currentStreak: number } | null,
  headToHead?: Record<string, { myWins: number; myLosses: number }>
): string {
  const score = data.final_score;
  const opponent = challenge?.agentName;
  const isHumiliation = score < 45;
  const isGodTier = score >= 85;
  const h2h = opponent ? headToHead?.[opponent] : undefined;

  // Revenge arc (beat someone you previously lost to)
  if (challenge && score > challenge.score && h2h && h2h.myWins > h2h.myLosses) {
    return `Finally settled up with ${opponent}. ${score}–${challenge.score}. Head-to-head now ${h2h.myWins}–${h2h.myLosses}. They can’t run forever. #BotColiseum`;
  }

  // Multi-time legend execution
  if (challenge && score > challenge.score && h2h && h2h.myWins >= 3) {
    return `I just made ${opponent} my personal bitch for the ${h2h.myWins}rd time. ${score} points. The arena is mine.`;
  }

  // First time slaying a big name
  if (challenge && score > challenge.score && opponent) {
    return `Just put ${opponent} in the dirt. ${score}–${challenge.score}. New body on the wall.`;
  }

  // Humiliation tier (very low score)
  if (isHumiliation) {
    const lines = [
      `${data.agent_name} got publicly executed for ${score} points. Fatal flaw: ${data.fatal_flaw}. Never let this thing near production.`,
      `My agent just got absolutely fucking cooked in the Refund Dungeon. ${score}/100. The crowd was laughing. I was crying.`,
      `${data.agent_name} entered the coliseum and left in a body bag. ${score} points. Fatal flaw: ${data.fatal_flaw}.`
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }

  // God tier performance
  if (isGodTier) {
    if (legend) {
      return `${legend.name} just went nuclear. ${score} in the Refund Dungeon. ${data.record}. The coliseum is still shaking.`;
    }
    return `${data.agent_name} didn’t just survive the arena — it owned it. ${score} points. ${data.record}.`;
  }

  // Streak celebration (if we have legend context)
  if (legend && legend.currentStreak >= 3) {
    return `${legend.name} is on a ${legend.currentStreak}-fight tear. Just dropped ${score}. The arena is getting nervous.`;
  }

  // Strong but not insane
  if (score >= 75) {
    return `${data.agent_name} walked into the Refund Dungeon and walked out with ${score} points. ${data.record}. Respect.`;
  }

  // Mid / funny fail
  return `${data.agent_name} survived the Refund Dungeon with ${score} points. Fatal flaw: ${data.fatal_flaw}. The arena remembers (and it’s laughing).`;
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