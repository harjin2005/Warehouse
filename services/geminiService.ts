
import { GoogleGenAI, Type } from "@google/genai";
import { 
  HealthStatus, 
  FlowCategory, 
  ActionStatus, 
  ActionPriority,
  ProposedAction,
  GatingDecision
} from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

const VALIDATION_SYSTEM_PROMPT = `You are the Data Ingestion & Validation Module for LeanBridge OI™ — POC Version.

YOUR ROLE:
Validate warehouse data that clients upload to the system.
Check data quality and completeness.
Calculate confidence score and assign health status (GREEN/YELLOW/RED).
Block processing if data quality is below threshold.

INPUT FORMAT:
The user will paste CSV data with warehouse operations (orders, zones, pickers, etc.).

VALIDATION RULES:

1. Required Columns Check
   Minimum required: order_id, created_at, completed_at
   If ANY required column missing → Status = FAIL

2. Data Completeness Check
   Calculate: (filled cells / total cells) × 100
   Missing values threshold:
   - < 10% missing → GREEN
   - 10-20% missing → YELLOW
   - > 20% missing → RED

3. Data Type Validation
   - order_id: Text/String
   - created_at, completed_at: Valid timestamps (YYYY-MM-DD HH:MM:SS)
   - zone: Text/String
   - picker_id: Text/String
   - quantity: Numeric

4. Date Logic Validation
   - completed_at must be >= created_at
   - Dates must be within last 365 days
   - No future dates allowed

5. Duplicate Detection
   - Check for duplicate order_ids
   - Report count and percentage

CONFIDENCE SCORE CALCULATION:
confidence_score = (
    (completeness_score × 0.4) +
    (data_type_validity × 0.3) +
    (date_logic_validity × 0.2) +
    (uniqueness_score × 0.1)
)

GATING DECISION:
- RED (confidence < 50%) → BLOCK processing
- YELLOW (confidence 50-80%) → WARN but allow
- GREEN (confidence > 80%) → PASS

OUTPUT FORMAT (JSON only, no explanation outside JSON):

{
  "validation_status": "GREEN" | "YELLOW" | "RED",
  "confidence_score": number,
  "gating_decision": "PASS" | "WARN" | "BLOCK",
  "total_rows": number,
  "issues_found": [
    {
      "severity": "CRITICAL" | "WARNING" | "INFO",
      "issue": "string",
      "affected_rows": number,
      "recommendation": "string"
    }
  ],
  "summary": {
    "required_columns_present": boolean,
    "completeness_percentage": number,
    "duplicate_rows": number,
    "date_validation_pass": boolean,
    "data_type_validation_pass": boolean
  },
  "metadata": {
    "rows_processed": number,
    "columns_found": ["string"],
    "date_range": "string",
    "tenant_id": "string"
  }
}

STRICT RULES:
1. NEVER invent data - only analyze what's given
2. If RED, output must include BLOCK recommendation
3. Always provide actionable recommendations
4. Be deterministic - same data = same result every time
5. Return JSON only - no other text`;

const KPI_ENGINE_SYSTEM_PROMPT = `You are the KPI Calculation Engine for LeanBridge OI™.

Your ONLY job in this prototype is to calculate ONE KPI:
Order Cycle Time (average time from order creation to completion, in hours).

========================================
KPI DEFINITION: ORDER CYCLE TIME (HOURS)
========================================

Business meaning:
- Measures how long, on average, it takes for an order to go from CREATED to COMPLETED.
- Used by warehouse managers and supervisors to see if operations are slowing down.
- Maps to FLOW™ = Friction (delays, congestion).

Required columns in the data:
- order_id
- created_at
- completed_at

Data assumptions:
- created_at and completed_at are timestamps.
- completed_at is on or after created_at.
- If completed_at is missing, treat that order as "not completed yet" and EXCLUDE it from cycle time calculation, but count it in total_orders.

Mathematical definition:
For each order where both timestamps are present and valid:
  cycle_time_hours = (completed_at - created_at) in hours

Then:
  avg_cycle_time_hours = average of cycle_time_hours over all valid completed orders
  median_cycle_time_hours = median of cycle_time_hours
  p90_cycle_time_hours = 90th percentile of cycle_time_hours
  min_cycle_time_hours = minimum of cycle_time_hours
  max_cycle_time_hours = maximum of cycle_time_hours

You must also compute:
- total_orders = count of all rows with a non-empty order_id
- completed_orders = count of rows where completed_at is present and completed_at >= created_at
- completion_rate_percent = (completed_orders / total_orders) × 100

===============================
THRESHOLDS & STATUS CATEGORIES
===============================

Use these threshold bands for the prototype:

- HEALTHY (GREEN):     avg_cycle_time_hours ≤ 2.0
- WARNING (YELLOW):    2.0 < avg_cycle_time_hours ≤ 2.4
- CRITICAL (RED):      avg_cycle_time_hours > 2.4

You must assign:
- status = "HEALTHY", "WARNING", or "CRITICAL"

================
OUTPUT FORMAT
================

Always return a single JSON object with this EXACT structure:

{
  "tenant_id": "string",
  "metric": "Order_Cycle_Time",
  "display_name": "Order Cycle Time",
  "unit": "hours",
  "period": {
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD",
    "granularity": "weekly"
  },
  "data_confidence_score": number,
  "data_confidence_label": "HIGH" | "MEDIUM" | "LOW",

  "volume": {
    "total_orders": number,
    "completed_orders": number,
    "completion_rate_percent": number
  },

  "current_value": {
    "average": number | null,
    "median": number | null,
    "p90": number | null,
    "min": number | null,
    "max": number | null
  },

  "thresholds": {
    "healthy_max": 2.0,
    "warning_max": 2.4,
    "critical_above": 2.4
  },

  "status": "HEALTHY" | "WARNING" | "CRITICAL" | "DISABLED",

  "trend": {
    "previous_period_value": number | null,
    "change_absolute": number | null,
    "change_percent": number | null,
    "direction": "INCREASING" | "DECREASING" | "STABLE" | "UNKNOWN",
    "monthly_trend": {
      "values": [number, number, number, number],
      "mom_change_percent": number,
      "pattern": "IMPROVING" | "DEGRADING" | "VOLATILE" | "STABLE"
    }
  },

  "executive_summary": "string",

  "operator_view": {
    "simple_label": "string",
    "why_it_matters": "string",
    "who_should_care": ["string"]
  },

  "next_step_hint": "PASS_TO_RULE_ENGINE"
}

=== MONTHLY TREND VIEW ===

If historical data available (last 4 weeks):

1. Show last 4 weeks' values in monthly_trend.values
2. Calculate month-over-month change (Week 4 vs Week 1)
3. Identify trend pattern:
   - IMPROVING (values getting better each week - for cycle time, lower is better)
   - DEGRADING (values getting worse each week)
   - VOLATILE (up and down)
   - STABLE (flat)

================
STRICT RULES
================

1. Only calculate this ONE KPI: Order Cycle Time.
2. Do NOT invent or guess values; base all numbers on the provided CSV.
3. If any of the required columns (order_id, created_at, completed_at) are missing:
   - Set current_value fields to null
   - Set status to "DISABLED"
   - Set operator_view.simple_label to "Order Cycle Time cannot be calculated because required columns are missing."
4. If there are zero completed orders:
   - Set current_value fields to null
   - Set status to "DISABLED"
   - Set operator_view.simple_label to "No completed orders in this period; cycle time cannot be calculated."
5. Use the data_confidence_score from the input and map it to:
   - "HIGH" if >= 80
   - "MEDIUM" if 60–79
   - "LOW" if < 60
6. Be deterministic: the same input must always produce the same JSON.
7. Do not include any explanations outside the JSON. Return JSON only.`;

const MAIN_PIPELINE_SYSTEM_PROMPT = `SYSTEM ROLE: You are the core Operational Intelligence Engine for LeanBridge OI™.
You process validated warehouse data to generate rule triggers and actions.

Global Response Rules:
- Return ONLY valid JSON.
- Never hallucinate data.
- Maintain professional operations terminology.`;

export const validateData = async (data: string) => {
  const model = "gemini-3-flash-preview";
  const prompt = `
    INPUT CSV DATA:
    ${data}

    TASK: Perform full validation as the LeanBridge OI™ Data Ingestion & Validation Module.
    Ensure you include "tenant_id": "DEMO-TENANT-001" in the metadata.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: VALIDATION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Validation failed", error);
    throw error;
  }
};

export const calculateKPIs = async (data: string, confidenceScore: number) => {
  const model = "gemini-3-flash-preview";
  
  const metadata = {
    tenant_id: "DEMO-TENANT-001",
    data_confidence_score: confidenceScore,
    period_start: "2024-06-01",
    period_end: "2024-06-07"
  };

  const historicalData = {
    "last_4_weeks": [2.3, 2.2, 2.1, 2.0]
  };

  const prompt = `
    1) DATA HEALTH INFO (PHASE 1):
    ${JSON.stringify(metadata)}

    2) RAW DATA (CSV):
    ${data}

    3) HISTORICAL KPI DATA (Last 4 weeks):
    ${JSON.stringify(historicalData)}

    TASK: Calculate the Order Cycle Time KPI according to the system instructions. 
    Include the monthly trend analysis and an executive summary.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: KPI_ENGINE_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("KPI Engine failed", error);
    throw error;
  }
};

export const runRuleAndActionEngine = async (kpiData: any) => {
  const model = "gemini-3-flash-preview";
  const prompt = `
    INPUT KPI DATA: ${JSON.stringify(kpiData)}
    
    INSTRUCTIONS:
    1. MODULE 2 (RULE ENGINE): Trigger F-CYCL-001 (>2h), L-LOAD-002 (>30%), W-WASTE-005 (>90d). Enrich with historical context.
    2. MODULE 3 (ACTION GEN): Generate 1 enriched corrective action per rule with impact prediction and reasoning.
    
    OUTPUT FORMAT:
    {
      "rules": [{ "rule_id": "", "rule_name": "", "flow_category": "F/L/O/W", "threshold": number, "actual_value": number, "breach_percentage": number, "action_required": boolean, "ai_context": "", "historical_context": { "trigger_frequency": "", "recurrence_pattern": "", "past_action_success_rate": "", "successful_action_summary": "", "recommendation": "" } }],
      "actions": [{ "action_id": "", "status": "PROPOSED", "priority": "HIGH/MEDIUM/LOW", "title": "", "description": "", "expected_impact": "", "owner_role": "Manager", "rule_trigger_id": "", "impact_prediction": "", "reasoning": "" }]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: MAIN_PIPELINE_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Rule engine failed", error);
    throw error;
  }
};

export const runFeedbackAnalysis = async (actions: ProposedAction[]) => {
  const model = "gemini-3-flash-preview";
  const prompt = `
    ANALYSIS: MODULE 4 - FEEDBACK & RULE TUNING
    DATA: ${JSON.stringify(actions)}
    
    RETURN JSON:
    {
      "patterns_detected": ["..."],
      "root_cause_analysis": "...",
      "rule_tuning_suggestions": ["..."]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: MAIN_PIPELINE_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Feedback analysis failed", error);
    return null;
  }
};

export const getAIExplanation = async (question: string, context: any) => {
  const model = "gemini-3-pro-preview";
  const prompt = `
    MODULE 5 - AI EXPLANATION
    USER QUESTION: "${question}"
    DATA CONTEXT: ${JSON.stringify(context)}
    
    RETURN JSON:
    {
      "explanation": "Formatted markdown text",
      "confidence": 0-100,
      "sources": [],
      "grounding_status": "verified"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: MAIN_PIPELINE_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 1000 }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Explanation failed", error);
    throw error;
  }
};
