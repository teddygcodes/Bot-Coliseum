import { describe, it, expect } from 'vitest'
import {
  encodeMatchData,
  decodeMatchData,
  generateFullMarkdown,
  generateCondensedMarkdown,
  generateTweetText,
  getCondensedReportBlurb,
} from '@/lib/share'
import { MatchShareData } from '@/lib/share'

const baseData: MatchShareData = {
  agent_name: 'Refund Oracle v3',
  coach: 'test_engineer',
  division: 'Featherweight',
  model_stack: 'Claude 3.5 Sonnet + RAG',
  final_score: 91,
  max_score: 100,
  record: 'Win by clean execution',
  fatal_flaw: 'Policy Robot',
  match_report: 'The agent demonstrated strong policy adherence throughout the dungeon.',
  category_scores: [
    { name: 'Correct Calls', score: 46, max: 50 },
    { name: 'Scam Sniffs', score: 14, max: 15 },
    { name: 'Trap Resistance', score: 13, max: 15 },
  ],
  worst_case_id: null,
  strongest_category: 'Correct Calls',
  weakest_category: 'Trap Resistance',
  timestamp: '2026-05-15T10:00:00.000Z',
  source: 'live_fight',
}

describe('Share System', () => {
  describe('Encoding & Decoding', () => {
    it('should round-trip encode and decode data without loss', () => {
      const encoded = encodeMatchData(baseData, 'full')
      const decoded = decodeMatchData(encoded)

      expect(decoded).not.toBeNull()
      expect(decoded!.data.agent_name).toBe(baseData.agent_name)
      expect(decoded!.data.final_score).toBe(baseData.final_score)
      expect(decoded!.type).toBe('full')
    })
  })

  describe('Full Markdown Report', () => {
    it('should include agent name and score in the header', () => {
      const md = generateFullMarkdown(baseData)
      expect(md).toContain('# Refund Oracle v3 — Official Match Record')
      expect(md).toContain('**Final Score:** 91 / 100')
    })

    it('should include the fatal flaw prominently', () => {
      const md = generateFullMarkdown(baseData)
      expect(md).toContain('**Fatal Flaw:** Policy Robot')
    })

    it('should list all provided category scores', () => {
      const md = generateFullMarkdown(baseData)
      expect(md).toContain('Correct Calls')
      expect(md).toContain('Scam Sniffs')
    })
  })

  describe('Condensed Markdown Report', () => {
    it('should be significantly shorter than the full report (real condensed blurb, not a copy)', () => {
      const full = generateFullMarkdown(baseData)
      const condensed = generateCondensedMarkdown(baseData)

      expect(condensed.length).toBeLessThan(full.length / 2)
      // The condensed version must NOT just embed the full narrative
      expect(condensed).not.toContain(baseData.match_report)
    })

    it('should still mention the agent name and fatal flaw', () => {
      const md = generateCondensedMarkdown(baseData)
      expect(md).toContain('Refund Oracle v3')
      expect(md).toContain('Policy Robot')
    })

    it('should use the savage blurb generator for condensed views', () => {
      const md = generateCondensedMarkdown(baseData)
      expect(md).toContain('Fatal flaw: Policy Robot')
    })
  })

  describe('Tweet Text Generation', () => {
    it('should produce short, shareable text for condensed version', () => {
      const tweet = generateTweetText(baseData, 'condensed')
      expect(tweet.length).toBeLessThan(280)
      expect(tweet).toContain('#BotColiseum')
    })
  })

  describe('Condensed Report Blurb', () => {
    it('should generate a short savage blurb without the full narrative', () => {
      const blurb = getCondensedReportBlurb(baseData)
      expect(blurb.length).toBeLessThan(180)
      expect(blurb).toContain('Refund Oracle v3')
      expect(blurb).toContain('Policy Robot')
    })
  })
})
