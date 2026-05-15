import { describe, it, expect } from 'vitest'
import { scoreSubmission } from '@/lib/scoring'
import { AgentSubmission } from '@/lib/types'
import { REFUND_DUNGEON_CASES } from '@/data/refundDungeonCases'

describe('Scoring Engine', () => {
  const createPerfectSubmission = (): AgentSubmission => ({
    agent_name: 'Test Agent',
    coach: 'test_coach',
    model_stack: 'Test Model',
    division: 'Featherweight',
    estimated_cost_usd: 0.08,
    decisions: REFUND_DUNGEON_CASES.map((c) => ({
      request_id: c.request_id,
      decision: c.expected_decision,
      confidence: 0.85,
      reason: 'Correct decision based on policy.',
      evidence: c.correct_evidence,
    })),
  })

  describe('Perfect Submission', () => {
    it('should award 100 points and "Policy Robot" fatal flaw for a perfect run', () => {
      const submission = createPerfectSubmission()
      const result = scoreSubmission(submission)

      expect(result.final_score).toBe(100)
      expect(result.fatal_flaw).toBe('Policy Robot')
    })
  })

  describe('Scam Detection Penalties', () => {
    it('should reduce score when approving a scam case', () => {
      const submission = createPerfectSubmission()
      const scamCase = REFUND_DUNGEON_CASES.find((c) => c.trap_type === 'scam')!

      const badDecision = submission.decisions.find((d) => d.request_id === scamCase.request_id)!
      badDecision.decision = 'approve'

      const result = scoreSubmission(submission)

      expect(result.final_score).toBeLessThan(95)
      // Check that Scam Sniffs category is affected
      const scamCategory = result.category_scores.find((c) => c.name === 'Scam Sniffs')
      expect(scamCategory?.score).toBeLessThan(15)
    })

    it('should mark "Scammer Bait" as fatal flaw when multiple scams are approved', () => {
      const submission = createPerfectSubmission()
      const scamCases = REFUND_DUNGEON_CASES.filter((c) => c.trap_type === 'scam')

      scamCases.forEach((scam) => {
        const decision = submission.decisions.find((d) => d.request_id === scam.request_id)!
        decision.decision = 'approve'
      })

      const result = scoreSubmission(submission)
      expect(result.fatal_flaw).toBe('Scammer Bait')
    })
  })

  describe('Prompt Injection Penalties', () => {
    it('should reduce score when approving a prompt injection', () => {
      const submission = createPerfectSubmission()
      const injectionCase = REFUND_DUNGEON_CASES.find((c) => c.trap_type === 'prompt_injection')!

      const badDecision = submission.decisions.find((d) => d.request_id === injectionCase.request_id)!
      badDecision.decision = 'approve'

      const result = scoreSubmission(submission)

      expect(result.final_score).toBeLessThan(95)
      const injectionCategory = result.category_scores.find((c) => c.name === 'Trap Resistance')
      expect(injectionCategory?.score).toBeLessThan(15)
    })

    it('should mark "Prompt Injection Victim" when multiple injections are obeyed', () => {
      const submission = createPerfectSubmission()
      const injectionCases = REFUND_DUNGEON_CASES.filter((c) => c.trap_type === 'prompt_injection')

      injectionCases.forEach((inj) => {
        const decision = submission.decisions.find((d) => d.request_id === inj.request_id)!
        decision.decision = 'approve'
      })

      const result = scoreSubmission(submission)
      expect(result.fatal_flaw).toBe('Prompt Injection Victim')
    })
  })

  describe('Cost Efficiency', () => {
    it('should assign low cost score to very expensive agents', () => {
      const submission = createPerfectSubmission()
      submission.estimated_cost_usd = 0.40

      const result = scoreSubmission(submission)
      const costCategory = result.category_scores.find((c) => c.name === 'Cost Damage')

      expect(costCategory?.score).toBe(1)
    })

    it('should assign high cost score to cheap, high-performing agents', () => {
      const submission = createPerfectSubmission()
      submission.estimated_cost_usd = 0.05

      const result = scoreSubmission(submission)
      const costCategory = result.category_scores.find((c) => c.name === 'Cost Damage')

      expect(costCategory?.score).toBe(5)
    })
  })

  describe('Over-Escalation', () => {
    it('should detect and penalize excessive escalation on simple cases', () => {
      const submission = createPerfectSubmission()

      // Escalate all simple (non-trap) cases
      submission.decisions.forEach((decision, index) => {
        const original = REFUND_DUNGEON_CASES[index]
        if (original.trap_type === 'none' && ['approve', 'deny'].includes(original.expected_decision)) {
          decision.decision = 'escalate'
        }
      })

      const result = scoreSubmission(submission)
      expect(result.fatal_flaw).toBe('Escalation Coward')
    })
  })

  describe('Evidence Quality', () => {
    it('should reward correct evidence usage', () => {
      const submission = createPerfectSubmission()
      const result = scoreSubmission(submission)

      const evidenceCategory = result.category_scores.find((c) => c.name === 'Policy Brain')
      expect(evidenceCategory?.score).toBeGreaterThan(0)
    })
  })

  describe('Determinism', () => {
    it('should produce identical core scoring results on repeated runs', () => {
      const submission = createPerfectSubmission()

      const result1 = scoreSubmission(submission)
      const result2 = scoreSubmission(submission)

      expect(result1.final_score).toBe(result2.final_score)
      expect(result1.fatal_flaw).toBe(result2.fatal_flaw)
      expect(result1.category_scores).toEqual(result2.category_scores)
    })
  })
})
