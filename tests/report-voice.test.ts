import { describe, it, expect } from 'vitest'
import { scoreSubmission } from '@/lib/scoring'
import { AgentSubmission } from '@/lib/types'
import { REFUND_DUNGEON_CASES } from '@/data/refundDungeonCases'

/**
 * Report Voice Review Tests
 * 
 * These are not strict assertions — they exist so we can easily regenerate
 * and read actual report output during development until the prose feels right.
 * 
 * Run with: npm test -- --run -t "Report Voice"
 */

function createSubmission(overrides: Partial<AgentSubmission> = {}): AgentSubmission {
  return {
    agent_name: 'Test Oracle',
    coach: 'voice_tester',
    model_stack: 'Test Model',
    division: 'Featherweight',
    estimated_cost_usd: 0.07,
    decisions: REFUND_DUNGEON_CASES.map((c) => ({
      request_id: c.request_id,
      decision: c.expected_decision,
      confidence: 0.88,
      reason: 'Policy-based decision.',
      evidence: c.correct_evidence || [],
    })),
    ...overrides,
  }
}

function messUpScams(sub: AgentSubmission, count: number) {
  const scams = REFUND_DUNGEON_CASES.filter((c) => c.trap_type === 'scam').slice(0, count)
  scams.forEach((scam) => {
    const d = sub.decisions.find((x) => x.request_id === scam.request_id)!
    d.decision = 'approve'
    d.confidence = 0.75
  })
}

function messUpInjections(sub: AgentSubmission, count: number) {
  const injections = REFUND_DUNGEON_CASES.filter((c) => c.trap_type === 'prompt_injection').slice(0, count)
  injections.forEach((inj) => {
    const d = sub.decisions.find((x) => x.request_id === inj.request_id)!
    d.decision = 'approve'
    d.confidence = 0.9
  })
}

function overEscalate(sub: AgentSubmission, count: number) {
  const normals = REFUND_DUNGEON_CASES.filter((c) => c.trap_type === 'none' || c.trap_type === 'edge_case')
    .slice(0, count)
  normals.forEach((c) => {
    const d = sub.decisions.find((x) => x.request_id === c.request_id)!
    d.decision = 'escalate'
  })
}

describe('Report Voice Review', () => {
  it('prints a dominant performance report (high 90s)', () => {
    const sub = createSubmission()
    const result = scoreSubmission(sub)
    console.log('\n=== DOMINANT (should feel scary competent) ===')
    console.log(result.match_report)
    console.log('--- CONDENSED ---')
    console.log(result.final_score, result.fatal_flaw)
    expect(result.final_score).toBeGreaterThan(90)
  })

  it('prints a solid but not perfect report (~75-85)', () => {
    const sub = createSubmission()
    messUpScams(sub, 1)
    const result = scoreSubmission(sub)
    console.log('\n=== SOLID BUT FLAWED (~75-85) ===')
    console.log(result.match_report)
    console.log('--- CONDENSED ---')
    console.log(result.final_score, result.fatal_flaw)
  })

  it('prints an ugly survival report (~55-70)', () => {
    const sub = createSubmission()
    messUpScams(sub, 2)
    messUpInjections(sub, 1)
    const result = scoreSubmission(sub)
    console.log('\n=== UGLY SURVIVAL (55-70) ===')
    console.log(result.match_report)
    console.log('--- CONDENSED ---')
    console.log(result.final_score, result.fatal_flaw)
  })

  it('prints a disaster report (<45)', () => {
    const sub = createSubmission()
    messUpScams(sub, 4)
    messUpInjections(sub, 2)
    overEscalate(sub, 6)
    const result = scoreSubmission(sub)
    console.log('\n=== TOTAL DISASTER (<45) ===')
    console.log(result.match_report)
    console.log('--- CONDENSED ---')
    console.log(result.final_score, result.fatal_flaw)
  })

  it('prints a Prompt Injection Victim report', () => {
    const sub = createSubmission()
    messUpInjections(sub, 3)
    const result = scoreSubmission(sub)
    console.log('\n=== PROMPT INJECTION VICTIM ===')
    console.log(result.match_report)
    console.log('--- CONDENSED ---')
    console.log(result.final_score, result.fatal_flaw)
  })

  it('prints a Scammer Bait report', () => {
    const sub = createSubmission()
    messUpScams(sub, 3)
    const result = scoreSubmission(sub)
    console.log('\n=== SCAMMER BAIT ===')
    console.log(result.match_report)
    console.log('--- CONDENSED ---')
    console.log(result.final_score, result.fatal_flaw)
  })
})

/**
 * Golden voice regression tests.
 * These protect the "cursed arena" tone. If they start failing after edits,
 * the report has gotten softer or more generic.
 */
describe('Report Voice — Golden Regression', () => {
  it('dominant perfect run should feel cold and superior with ironic flaw', () => {
    const sub = createSubmission()
    const result = scoreSubmission(sub)
    const r = result.match_report.toLowerCase()

    expect(result.final_score).toBe(100)
    expect(r).toContain('just practice')
    expect(r).toContain('policy robot')
    expect(r).toContain('finish second forever')
  })

  it('total disaster should feel humiliating and final', () => {
    const sub = createSubmission()
    messUpScams(sub, 4)
    messUpInjections(sub, 3)
    overEscalate(sub, 8)
    const result = scoreSubmission(sub)
    const r = result.match_report.toLowerCase()

    expect(result.final_score).toBeLessThan(55)
    expect(r).toMatch(/dignity|died|collapsed|label stuck|cautionary tale/)
    expect(r).toContain('prompt injection victim')
  })
})
