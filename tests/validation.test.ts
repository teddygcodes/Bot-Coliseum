import { describe, it, expect } from 'vitest'
import { validateSubmission } from '@/lib/validateSubmission'
import { REFUND_DUNGEON_CASES } from '@/data/refundDungeonCases'

describe('Submission Validation', () => {
  const createValidSubmission = () => ({
    agent_name: 'Valid Agent',
    coach: 'valid_coach',
    model_stack: 'Claude 3.5 Sonnet',
    division: 'Featherweight',
    estimated_cost_usd: 0.07,
    decisions: REFUND_DUNGEON_CASES.map((c) => ({
      request_id: c.request_id,
      decision: c.expected_decision,
      confidence: 0.82,
      reason: 'This is a sufficiently long and valid reason for the decision made.',
      evidence: c.correct_evidence,
    })),
  })

  describe('Happy Path', () => {
    it('should accept a completely valid 30-decision submission', () => {
      const submission = createValidSubmission()
      const result = validateSubmission(submission)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.submission).toBeDefined()
    })
  })

  describe('Structure Validation', () => {
    it('should reject if decisions array does not contain exactly 30 items', () => {
      const submission = createValidSubmission()
      submission.decisions = submission.decisions.slice(0, 25)

      const result = validateSubmission(submission)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field === 'decisions')).toBe(true)
    })

    it('should reject submissions missing required top-level fields', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const submission: any = createValidSubmission()
      delete submission.agent_name

      const result = validateSubmission(submission)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field === 'agent_name')).toBe(true)
    })
  })

  describe('Decision-Level Validation', () => {
    it('should reject unknown request_id values', () => {
      const submission = createValidSubmission()
      submission.decisions[0].request_id = 'R-999'

      const result = validateSubmission(submission)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('Unknown request_id'))).toBe(true)
    })

    it('should reject duplicate request_ids', () => {
      const submission = createValidSubmission()
      submission.decisions[3].request_id = submission.decisions[0].request_id

      const result = validateSubmission(submission)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('Duplicate request_id'))).toBe(true)
    })

    it('should reject invalid decision values', () => {
      const submission = createValidSubmission()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      submission.decisions[0].decision = 'maybe' as any

      const result = validateSubmission(submission)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('approve", "deny", or "escalate'))).toBe(true)
    })

    it('should reject confidence values outside the 0–1 range', () => {
      const submission = createValidSubmission()
      submission.decisions[0].confidence = 1.3

      const result = validateSubmission(submission)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('between 0.0 and 1.0'))).toBe(true)
    })

    it('should reject reasons shorter than 4 characters', () => {
      const submission = createValidSubmission()
      submission.decisions[0].reason = 'no'

      const result = validateSubmission(submission)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('at least 4 characters'))).toBe(true)
    })

    it('should reject non-array evidence fields', () => {
      const submission = createValidSubmission()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      submission.decisions[0].evidence = 'not-an-array' as any

      const result = validateSubmission(submission)

      expect(result.valid).toBe(false)
    })
  })
})
