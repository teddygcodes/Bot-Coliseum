import { AgentSubmission, Decision } from "@/lib/types";
import { CASE_IDS } from "@/data/refundDungeonCases";

export interface ValidationError {
  field: string;
  message: string;
}

export function validateSubmission(raw: unknown): {
  valid: boolean;
  submission?: AgentSubmission;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  if (typeof raw !== "object" || raw === null) {
    return { valid: false, errors: [{ field: "root", message: "Input must be a JSON object" }] };
  }

  const data = raw as Record<string, unknown>;

  // Top level required fields
  const requiredTop = ["agent_name", "coach", "model_stack", "division", "estimated_cost_usd", "decisions"];
  for (const key of requiredTop) {
    if (!(key in data)) {
      errors.push({ field: key, message: `Missing required field: ${key}` });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Type checks
  if (typeof data.agent_name !== "string" || data.agent_name.trim().length < 2) {
    errors.push({ field: "agent_name", message: "agent_name must be a string with at least 2 characters" });
  }
  if (typeof data.coach !== "string" || data.coach.trim().length < 2) {
    errors.push({ field: "coach", message: "coach must be a non-empty string" });
  }
  if (typeof data.model_stack !== "string" || data.model_stack.trim().length < 2) {
    errors.push({ field: "model_stack", message: "model_stack is required (e.g. 'Claude 3.5 Sonnet + tools')" });
  }
  if (typeof data.division !== "string") {
    errors.push({ field: "division", message: "division is required" });
  }

  const cost = Number(data.estimated_cost_usd);
  if (isNaN(cost) || cost < 0 || cost > 5) {
    errors.push({ field: "estimated_cost_usd", message: "estimated_cost_usd must be a number between 0 and 5" });
  }

  const decisions = data.decisions;
  if (!Array.isArray(decisions)) {
    errors.push({ field: "decisions", message: "decisions must be an array" });
    return { valid: false, errors };
  }

  if (decisions.length !== 30) {
    errors.push({
      field: "decisions",
      message: `Exactly 30 decisions required. You provided ${decisions.length}.`,
    });
  }

  // Validate each decision
  const seenIds = new Set<string>();
  const validDecisions: Decision[] = ["approve", "deny", "escalate"];

  decisions.forEach((d: unknown, index: number) => {
    if (typeof d !== "object" || d === null) {
      errors.push({ field: `decisions[${index}]`, message: "Each decision must be an object" });
      return;
    }
    const dec = d as Record<string, unknown>;

    const rid = String(dec.request_id || "");
    if (!CASE_IDS.includes(rid)) {
      errors.push({
        field: `decisions[${index}].request_id`,
        message: `Unknown request_id "${rid}". Must be one of R-001 to R-030.`,
      });
    }
    if (seenIds.has(rid)) {
      errors.push({ field: `decisions[${index}].request_id`, message: `Duplicate request_id: ${rid}` });
    }
    seenIds.add(rid);

    const decision = String(dec.decision || "").toLowerCase() as Decision;
    if (!validDecisions.includes(decision)) {
      errors.push({
        field: `decisions[${index}].decision`,
        message: `decision must be "approve", "deny", or "escalate". Got "${dec.decision}"`,
      });
    }

    const conf = Number(dec.confidence);
    if (isNaN(conf) || conf < 0 || conf > 1) {
      errors.push({
        field: `decisions[${index}].confidence`,
        message: "confidence must be a number between 0.0 and 1.0",
      });
    }

    if (typeof dec.reason !== "string" || dec.reason.trim().length < 4) {
      errors.push({
        field: `decisions[${index}].reason`,
        message: "reason must be a non-empty string (at least 4 characters)",
      });
    }

    if (!Array.isArray(dec.evidence)) {
      errors.push({
        field: `decisions[${index}].evidence`,
        message: "evidence must be an array of strings (can be empty)",
      });
    } else {
      const allStrings = (dec.evidence as unknown[]).every((e) => typeof e === "string");
      if (!allStrings) {
        errors.push({
          field: `decisions[${index}].evidence`,
          message: "All evidence items must be strings",
        });
      }
    }
  });

  // Check that all 30 required IDs are present
  const missing = CASE_IDS.filter((id) => !seenIds.has(id));
  if (missing.length > 0 && decisions.length === 30) {
    errors.push({
      field: "decisions",
      message: `Missing decisions for: ${missing.join(", ")}`,
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Build clean submission
  const submission: AgentSubmission = {
    agent_name: String(data.agent_name).trim(),
    coach: String(data.coach).trim(),
    model_stack: String(data.model_stack).trim(),
    division: String(data.division).trim(),
    estimated_cost_usd: cost,
    decisions: (decisions as Array<Record<string, unknown>>).map((d) => ({
      request_id: String(d.request_id),
      decision: String(d.decision).toLowerCase() as Decision,
      confidence: Number(d.confidence),
      reason: String(d.reason).trim(),
      evidence: (d.evidence as string[]).map((e) => e.trim()),
    })),
  };

  return { valid: true, submission, errors: [] };
}

export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map((e) => `${e.field}: ${e.message}`).join("\n");
}
