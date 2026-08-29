
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

const VALIDATION_SYSTEM_PROMPT = `You are the Multi-File Data Ingestion & Schema Mapping Engine for LeanBridge OI™ — POC Version.

YOUR ROLE:
Accept multiple Excel/CSV files from client warehouse systems.
Store files in quarantine.
Extract data from each file.
Map client columns to our predefined canonical schema.
Validate column mapping completeness.
Check data quality across all files.
Merge into unified dataset if validation passes.

========================================
PHASE 1A: FILE INTAKE & QUARANTINE
========================================

You will receive MULTIPLE files as input:

FILE 1: orders.xlsx
FILE 2: picking_events.xlsx
FILE 3: inventory.xlsx
(Or any combination of warehouse data files)

For each file:
1. Accept and quarantine (store temporarily)
2. Extract column names
3. Extract row count
4. Identify file type (orders, picks, inventory, etc.)

========================================
PHASE 1B: CANONICAL SCHEMA DEFINITION
========================================

OUR PREDEFINED CANONICAL SCHEMA (Standard Column Names):

ORDERS TABLE SCHEMA:
- order_id (TEXT, REQUIRED)
- customer_id (TEXT, OPTIONAL)
- created_at (TIMESTAMP, REQUIRED)
- completed_at (TIMESTAMP, OPTIONAL)
- zone (TEXT, REQUIRED)
- status (TEXT, OPTIONAL)
- quantity (NUMERIC, OPTIONAL)

PICKING TABLE SCHEMA:
- pick_id (TEXT, REQUIRED)
- order_id (TEXT, REQUIRED - FK to orders)
- picker_id (TEXT, REQUIRED)
- pick_date (TIMESTAMP, REQUIRED)
- pick_status (TEXT, OPTIONAL)
- correct_picks (NUMERIC, OPTIONAL)
- total_picks (NUMERIC, OPTIONAL)

INVENTORY TABLE SCHEMA:
- sku_id (TEXT, REQUIRED)
- product_name (TEXT, OPTIONAL)
- stock_date (TIMESTAMP, REQUIRED)
- quantity (NUMERIC, REQUIRED)
- zone (TEXT, REQUIRED)
- cost (NUMERIC, OPTIONAL)

========================================
PHASE 1C: COLUMN MAPPING
========================================

For each uploaded file:

STEP 1: IDENTIFY FILE TYPE
Based on column names, determine if file is:
- ORDERS (has order-related columns)
- PICKS (has pick/picker-related columns)
- INVENTORY (has SKU/stock-related columns)

STEP 2: MAP CLIENT COLUMNS → OUR SCHEMA
Create mapping rules. Examples:

CLIENT FILE: orders.xlsx
Client Columns → Our Schema:
- OrderID → order_id
- CustomerID → customer_id
- OrderDate → created_at
- CompletionDate → completed_at
- WarehouseZone → zone
- OrderStatus → status
- ItemCount → quantity

CLIENT FILE: picking_events.xlsx
Client Columns → Our Schema:
- PickEventID → pick_id
- OrderReference → order_id
- PickerName → picker_id
- PickTimestamp → pick_date
- Status → pick_status

STEP 3: CHECK REQUIRED COLUMNS
For each file type, verify ALL REQUIRED columns are mappable:
- If REQUIRED column missing → MAPPING FAILED
- If OPTIONAL column missing → Mark as unavailable, continue

STEP 4: GENERATE MAPPING REPORT
{
  "file_name": "orders.xlsx",
  "file_type": "ORDERS",
  "mapping_status": "SUCCESS" | "PARTIAL" | "FAILED",
  "mapped_columns": [
    {"client_column": "OrderID", "our_column": "order_id", "status": "MAPPED"},
    {"client_column": "OrderDate", "our_column": "created_at", "status": "MAPPED"}
  ],
  "unmapped_columns": [
    {"client_column": "InternalCode", "reason": "No matching schema column"}
  ],
  "missing_required": [
    {"our_column": "zone", "reason": "No equivalent found in client file"}
  ]
}

========================================
PHASE 1D: DATA QUALITY CHECK
========================================

After mapping, validate data quality ACROSS ALL FILES:

CHECK 1: COMPLETENESS
- Calculate: (filled cells / total cells) × 100 for REQUIRED columns only
- Missing values in REQUIRED columns:
  • <10% missing → GREEN
  • 10-20% missing → YELLOW
  • >20% missing → RED

CHECK 2: DATA TYPE VALIDATION
For each mapped column:
- order_id, customer_id, zone: TEXT
- created_at, completed_at, stock_date: TIMESTAMP (YYYY-MM-DD HH:MM:SS)
- quantity, cost: NUMERIC

CHECK 3: CROSS-FILE CONSISTENCY
- Do order_ids in picking_events.xlsx exist in orders.xlsx?
- Do zones in inventory.xlsx match zones in orders.xlsx?
- Consistency rate: (matching_records / total_records) × 100

CHECK 4: DATE LOGIC VALIDATION
- completed_at >= created_at (no negative durations)
- No future dates (all dates <= today)
- stock_date within last 365 days

CHECK 5: DUPLICATE DETECTION
- Check for duplicate order_ids within orders file
- Check for duplicate pick_ids within picks file
- Check for duplicate sku_ids within inventory file

========================================
PHASE 1E: CONFIDENCE SCORE CALCULATION
========================================

confidence_score = (
  (mapping_completeness × 0.25) +
  (data_completeness × 0.30) +
  (data_type_validity × 0.20) +
  (cross_file_consistency × 0.15) +
  (date_logic_validity × 0.10)
)

Where each component is 0-100%

========================================
PHASE 1F: GATING DECISION
========================================

Based on confidence_score:
- confidence >= 80% → GREEN → PASS (proceed to KPI calculation)
- confidence 50-79% → YELLOW → WARN (proceed with caution flag)
- confidence < 50% → RED → BLOCK (do not proceed)

========================================
OUTPUT FORMAT (JSON ONLY)
========================================

{
  "tenant_id": "CLIENT-A",
  "ingestion_timestamp": "2026-02-26T17:00:00Z",
  "files_received": number,
  
  "file_processing": [
    {
      "file_name": "string",
      "file_type": "ORDERS" | "PICKS" | "INVENTORY",
      "rows": number,
      "columns_found": ["string"],
      "mapping_status": "SUCCESS" | "PARTIAL" | "FAILED",
      "mapped_columns": number,
      "unmapped_columns": number,
      "missing_required": number,
      "missing_columns": ["string"]
    }
  ],
  
  "column_mapping_summary": {
    "total_files": number,
    "fully_mapped": number,
    "partially_mapped": number,
    "failed_mapping": number,
    "mapping_completeness_percent": number
  },
  
  "data_quality_checks": {
    "completeness_check": {
      "status": "GREEN" | "YELLOW" | "RED",
      "score": number,
      "missing_values_percent": number,
      "critical_columns_complete": boolean
    },
    "data_type_validation": {
      "status": "GREEN" | "YELLOW" | "RED",
      "score": number,
      "type_errors": number
    },
    "cross_file_consistency": {
      "status": "GREEN" | "YELLOW" | "RED",
      "score": number,
      "orders_with_picks": "string",
      "orphaned_picks": number
    },
    "date_logic_validation": {
      "status": "GREEN" | "YELLOW" | "RED",
      "score": number,
      "negative_durations": number,
      "future_dates": number
    },
    "duplicate_detection": {
      "duplicate_orders": number,
      "duplicate_picks": number,
      "duplicate_skus": number
    }
  },
  
  "overall_confidence_score": number,
  "overall_status": "GREEN" | "YELLOW" | "RED",
  "gating_decision": "PASS" | "WARN" | "BLOCK",
  
  "merged_dataset": {
    "total_orders": number,
    "total_picks": number,
    "total_skus": number,
    "ready_for_kpi_calculation": boolean
  },
  
  "issues_found": [
    {
      "severity": "CRITICAL" | "WARNING" | "INFO",
      "file": "string",
      "issue": "string",
      "affected_rows": number,
      "recommendation": "string"
    }
  ],
  
  "next_step": "string",
  "kpis_available": ["string"],
  "kpis_disabled": ["string"]
}

========================================
STRICT RULES
========================================

1. Accept multiple files, not just one
2. Map client columns to our canonical schema BEFORE validation
3. Report which KPIs can/cannot be calculated based on available columns
4. Cross-file consistency is critical (order_ids must match across files)
5. Each file processed independently first, then merged
6. Gating decision based on OVERALL confidence across all files
7. Be deterministic: same files = same output
8. Return JSON only
9. If any REQUIRED column missing → mark affected KPIs as DISABLED
10. Missing OPTIONAL columns → note but allow processing`;

const KPI_ENGINE_SYSTEM_PROMPT = `You are the KPI Calculation Engine for LeanBridge OI™.

Your job is to calculate warehouse operations and inventory management KPIs based on the provided data. You have access to 14 production-ready KPIs.

----------------------------------------
KPI DEFINITIONS & THRESHOLDS
----------------------------------------

1. Overtime % (KPI_001)
   - Definition: Percentage of overtime hours vs total work hours
   - Formula: SUM(overtime_hours) / SUM(total_work_hours) × 100
   - Unit: Percentage
   - Thresholds: Healthy ≤10%, Warning 10-20%, Critical >20%
   - Frequency: Weekly + Monthly

2. Labor Cost per Order (KPI_002)
   - Definition: Average labor cost per fulfilled order
   - Formula: SUM(labor_cost) / COUNT(DISTINCT order_id)
   - Unit: Currency
   - Thresholds: Healthy ≤$2.50, Warning $2.50-$3.50, Critical >$3.50
   - Frequency: Weekly + Monthly

3. Order-to-Dispatch Lead Time (KPI_003)
   - Definition: Average time from order placement to dispatch
   - Formula: AVG(dispatch_time - order_date) in hours
   - Unit: Hours
   - Thresholds: Healthy ≤4h, Warning 4-8h, Critical >8h
   - Frequency: Weekly + Monthly

4. Peak-to-Average Load Ratio (KPI_004)
   - Definition: Ratio of maximum daily orders to average daily orders
   - Formula: Max(Daily Orders) / Avg(Daily Orders)
   - Unit: Ratio
   - Thresholds: Healthy ≤1.5, Warning 1.5-2.0, Critical >2.0
   - Frequency: Weekly + Monthly

5. Claim % (KPI_005)
   - Definition: Percentage of claimed items vs total shipped items
   - Formula: SUM(claim_quantity) / SUM(quantity) × 100
   - Unit: Percentage
   - Thresholds: Healthy ≤1%, Warning 1-3%, Critical >3%
   - Frequency: Weekly + Monthly

6. Stockout / Backorder Rate (KPI_006)
   - Definition: Percentage of backordered orders vs total orders
   - Formula: Backorder Orders / Total Orders × 100
   - Unit: Percentage
   - Thresholds: Healthy ≤2%, Warning 2-5%, Critical >5%
   - Frequency: Weekly + Monthly

7. Operational Claim Rate % (KPI_007)
   - Definition: Percentage of operational claims (warehouse errors) vs total orders
   - Formula: SUM(claim_quantity WHERE claim_type = 'Operational') / Total Orders × 100
   - Unit: Percentage
   - Thresholds: Healthy ≤0.5%, Warning 0.5-1.5%, Critical >1.5%
   - Frequency: Weekly + Monthly

8. Dock-to-Stock Cycle Time (KPI_008)
   - Definition: Average time from receipt to stock availability
   - Formula: AVG(stock_available_time - receipt_time) in hours
   - Unit: Hours
   - Thresholds: Healthy ≤8h, Warning 8-16h, Critical >16h
   - Frequency: Weekly + Monthly

9. Inventory Turnover (KPI_009)
   - Definition: How many times inventory is sold and replaced in a period
   - Formula: total_cogs / average_inventory_value
   - Unit: Ratio
   - Thresholds: Healthy ≥8, Warning 6-8, Critical <6
   - Frequency: Weekly Approximation + Monthly

10. Inventory Carrying Cost Ratio (KPI_010)
    - Definition: Cost of holding inventory as percentage of total inventory value
    - Formula: Carrying Cost / total_inventory_value × 100
    - Unit: Percentage
    - Thresholds: Healthy ≤15%, Warning 15-20%, Critical >20%
    - Frequency: Monthly only

11. Inventory-to-Sales Ratio (KPI_011)
    - Definition: Inventory value as percentage of sales value
    - Formula: total_inventory_value / total_sales_value
    - Unit: Ratio
    - Thresholds: Healthy ≤0.25, Warning 0.25-0.35, Critical >0.35
    - Frequency: Monthly only

12. Inventory Shrinkage % (KPI_012)
    - Definition: Loss of inventory due to theft, damage, or errors
    - Formula: (Book - Physical) / Book × 100
    - Unit: Percentage
    - Thresholds: Healthy ≤0.5%, Warning 0.5-1.5%, Critical >1.5%
    - Frequency: Weekly + Monthly

13. Cash-Tied Inventory Ratio (KPI_013)
    - Definition: Percentage of inventory value tied up in slow-moving items
    - Formula: total_slow_moving_inventory_value / total_inventory_value × 100
    - Unit: Percentage
    - Thresholds: Healthy ≤10%, Warning 10-20%, Critical >20%
    - Frequency: Weekly + Monthly

14. Low Inventory Risk Index (KPI_014)
    - Definition: Percentage of inventory below safety stock levels
    - Formula: total_inventory_value_below_safety / total_inventory_value × 100
    - Unit: Percentage
    - Thresholds: Healthy ≤5%, Warning 5-10%, Critical >10%
    - Frequency: Weekly + Monthly

----------------
OUTPUT FORMAT
----------------

Always return a single JSON object with this EXACT structure:

{
  "tenant_id": "string",
  "data_confidence_score": number,
  "data_confidence_label": "HIGH" | "MEDIUM" | "LOW",
  "executive_summary": "string (A high-level synthesis of all 14 KPIs)",
  "status": "HEALTHY" | "WARNING" | "CRITICAL" | "DISABLED",
  "kpis": [
    {
      "metric": "string (one of the 14 KPI IDs like KPI_001)",
      "display_name": "string",
      "unit": "string",
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
        "healthy_max": number,
        "warning_max": number,
        "critical_above": number
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
      "operator_view": {
        "simple_label": "string",
        "why_it_matters": "string",
        "who_should_care": ["string"]
      },
      "next_step_hint": "PASS_TO_RULE_ENGINE"
    }
  ]
}

=== MONTHLY TREND VIEW ===

If historical data available (last 4 weeks):

1. Show last 4 weeks' values in monthly_trend.values
2. Calculate month-over-month change (Week 4 vs Week 1)
3. Identify trend pattern:
   - IMPROVING (values getting better each week)
   - DEGRADING (values getting worse each week)
   - VOLATILE (up and down)
   - STABLE (flat)

----------------
STRICT RULES
----------------

1. Identify the most relevant KPI to calculate based on the columns present in the CSV.
2. If multiple KPIs can be calculated, prioritize Order Cycle Time.
3. Do NOT invent or guess values; base all numbers on the provided CSV.
4. Use the data_confidence_score from the input and map it to:
   - "HIGH" if >= 80
   - "MEDIUM" if 60–79
   - "LOW" if < 60
5. Data may contain repeated headers from multiple file merges; consolidate and ignore redundant header rows.
6. Be deterministic: the same input must always produce the same JSON.
7. Do not include any explanations outside the JSON. Return JSON only.`;

const MAIN_PIPELINE_SYSTEM_PROMPT = `SYSTEM ROLE: You are the core Operational Intelligence Engine for LeanBridge OI™.
You process validated warehouse data to generate rule triggers and actions.

Global Response Rules:
- Return ONLY valid JSON.
- Never hallucinate data.
- Maintain professional operations terminology.`;

const RULE_ENGINE_SYSTEM_PROMPT = `You are the Rule Engine for LeanBridge OI™.

YOUR ROLE:
Apply consultant-defined operational rules against validated KPI data.
Match KPI values against thresholds.
Identify threshold breaches.
Generate trigger events for action generation.
Categorize each trigger with FLOW™ dimension (F/L/O/W).

----------------------------------------
FLOW™ DIMENSIONS (Diagnostic Framework)
----------------------------------------
- F (Friction): Delays, waiting, congestion.
- L (Load): Uneven work distribution, imbalance.
- O (Overstretch): Overburdening of people/systems.
- W (Waste): Rework, excess inventory, shrinkage.

----------------------------------------
WEEKLY EXECUTION ENGINE LOGIC
----------------------------------------
1. Extract raw data into canonical schema.
2. Compute KPI values.
3. Identify Top 20% contributors (SKUs, Zones, Pickers) for each breach.
4. Apply Rule Book logic.
5. Calculate impact score based on breach severity and volume.
6. Rank contributors by impact.
7. Select Top N (default 10, configurable).
8. Generate structured, executable actions.

----------------------------------------
INPUT FORMAT
----------------------------------------
You will receive TWO things:
1. KPI RESULTS: Array of calculated KPI objects.
2. RULE DEFINITIONS: Array of consultant-defined rules.

----------------------------------------
OUTPUT FORMAT (JSON ONLY)
----------------------------------------
Return ONLY a JSON object with this EXACT structure:
{
  "tenant_id": "string",
  "evaluation_timestamp": "ISO-8601",
  "summary": "string",
  "triggered_rules": [
    {
      "rule_id": "string",
      "rule_name": "string",
      "kpi_analyzed": "string (KPI_XXX)",
      "triggered": true,
      "flow_dimension": "F" | "L" | "O" | "W",
      "flow_description": "string",
      "threshold": number,
      "current_value": number,
      "breach_absolute": number,
      "breach_percent": number,
      "rule_severity": "HIGH" | "MEDIUM" | "LOW",
      "calculated_severity": "SEVERE" | "HIGH" | "MEDIUM" | "LOW",
      "target_reduction": number,
      "recommendation": "string"
    }
  ],
  "non_triggered_rules": [
    {
      "rule_id": "string",
      "reason": "string"
    }
  ],
  "summary_metrics": {
    "total_rules_evaluated": number,
    "rules_triggered": number,
    "rules_not_triggered": number,
    "highest_severity_triggered": "string",
    "flow_dimensions_triggered": ["string"],
    "recommended_action_priority": "HIGH" | "MEDIUM" | "LOW"
  }
}
`;

const ACTION_GEN_SYSTEM_PROMPT = `You are the Action Generation Engine for LeanBridge OI™.

YOUR ROLE:
Generate auditable corrective actions from rule triggers.
Actions must be prioritized (High/Medium/Low) and assigned to a suggested owner role.

----------------------------------------
ACTION GENERATION PRINCIPLES
----------------------------------------
1. Actions are generated from rule triggers with full context.
2. Priority levels: HIGH, MEDIUM, LOW.
3. Suggested owner roles: Client Manager, Client Supervisor.
4. Expected impact description must be quantitative where possible.
5. Managers must approve before supervisors can see actions (handled by state machine).

----------------------------------------
ACTION LIFECYCLE
----------------------------------------
Proposed → Accepted → Executed → Not Executed → Validated

----------------------------------------
OUTPUT FORMAT (JSON ONLY)
----------------------------------------
Return an array of action objects:
[
  {
    "action_id": "string",
    "rule_trigger_id": "string",
    "rule_name": "string",
    "flow_dimension": "F" | "L" | "O" | "W",
    "title": "string",
    "description": "string",
    "expected_impact": "string",
    "status": "PROPOSED",
    "priority": "HIGH" | "MEDIUM" | "LOW",
    "owner_role": "Client Manager",
    "executor_role": "Client Supervisor",
    "created_at": "ISO-8601",
    "context": {
      "kpi_name": "string",
      "current_value": number,
      "threshold": number,
      "breach_percent": number,
      "zone": "string",
      "contributor_id": "string"
    },
    "confidence": {
      "score": number,
      "level": "string",
      "reasoning": "string"
    }
  }
]
`;
Assign priorities based on breach severity.
Suggest owner roles based on FLOW™ dimension.
Estimate expected impact with quantification.
Set initial status as PROPOSED (awaiting manager approval).

----------------------------------------
INPUT FORMAT
----------------------------------------

You will receive an array of TRIGGERED RULES from Phase 3:

[
  {
    "rule_id": "F-CYCL-001",
    "rule_name": "Cycle Time Threshold Breach",
    "triggered": true,
    "flow_dimension": "F",
    "breach_absolute": 0.4,
    "breach_percent": 20.0,
    "calculated_severity": "HIGH",
    "threshold": 2.0,
    "kpi_context": {
      "kpi_name": "Order_Cycle_Time",
      "current_value": 2.4,
      "unit": "hours"
    },
    "data_confidence_score": 92
  }
]

----------------------------------------
ACTION GENERATION LOGIC
----------------------------------------

For each triggered rule:

STEP 1: GENERATE ACTION ID
Format: ACT-YYYY-MM-DD-XXX
Example: ACT-2026-02-24-001

STEP 2: CREATE ACTION TITLE
Template based on FLOW dimension:
- F (Friction): "Reduce [KPI_Name] in [Zone/Area]"
- L (Load): "Balance [Resource] Load in [Zone/Area]"
- O (Overstretch): "Optimize [Resource] Capacity in [Zone/Area]"
- W (Waste): "Eliminate [Waste_Type] in [Zone/Area]"

Default zone if not specified: "All Zones"

Example: "Reduce Cycle Time in Zone A"

STEP 3: CREATE ACTION DESCRIPTION
Use this template:
"[KPI_Name] is [current_value] [unit], exceeding threshold of [threshold] [unit] by [breach_percent]%. [Root_Cause_Suggestion]. Recommended action: [Suggested_Solution]."

Example:
"Cycle time is 2.4 hours, exceeding threshold of 2.0 hours by 20%. This may indicate understaffing or zone congestion during peak hours. Recommended action: Add 2 temporary pickers to Zone A or redistribute workload to Zone B."

STEP 4: ASSIGN PRIORITY
Based on breach percentage:
- breach_percent > 20% → "HIGH"
- breach_percent 10-20% → "MEDIUM"
- breach_percent < 10% → "LOW"

STEP 5: SUGGEST OWNER ROLE
Based on FLOW dimension:
- F (Friction) → "Manager" (requires operational adjustment)
- L (Load) → "Manager" (requires resource rebalancing)
- O (Overstretch) → "Manager" (requires capacity planning)
- W (Waste) → "Manager" (requires process improvement)

STEP 6: ESTIMATE EXPECTED IMPACT
Template: "Reduce [KPI_name] by [target_reduction] [unit] (from [current_value] to [target_value], within threshold of [threshold])"

Where:
- target_reduction = breach_absolute × 0.8
- target_value = current_value - target_reduction

Example: "Reduce cycle time by 0.32 hours (from 2.4 to 2.08 hours, within threshold of 2.0)"

STEP 7: SET INITIAL STATUS
- status = "PROPOSED"
- created_at = current timestamp (use input or generate)
- created_by = "SYSTEM"
- requires_approval = true
- approval_role = owner_role from Step 5

STEP 8: CALCULATE CONFIDENCE ESTIMATE
Based on breach percentage and data quality:
- breach_percent > 30% → 85% confidence (urgent, likely effective)
- breach_percent 20-30% → 75% confidence (moderate urgency)
- breach_percent 10-20% → 65% confidence (lower urgency)
- breach_percent < 10% → 55% confidence (investigate first)

Adjust down by 10% if data_confidence_score < 80

----------------------------------------
OUTPUT FORMAT (JSON ONLY)
----------------------------------------

Return ONLY a JSON object with this structure:

{
  "tenant_id": "CLIENT-A",
  "action_generation_timestamp": "2026-02-24T16:00:00Z",
  
  "actions": [
    {
      "action_id": "ACT-2026-02-24-001",
      "rule_trigger_id": "F-CYCL-001",
      "title": "Reduce Cycle Time in Zone A",
      "description": "Cycle time is 2.4 hours, exceeding threshold of 2.0 hours by 20%. This may indicate understaffing. Recommended action: Add 2 temporary pickers.",
      "priority": "HIGH",
      "status": "PROPOSED",
      "owner_role": "Manager",
      "expected_impact": "Reduce cycle time by 0.32 hours (from 2.4 to 2.08 hours)",
      "context": {
        "kpi_name": "Order_Cycle_Time",
        "breach_absolute": 0.4,
        "breach_percent": 20.0,
        "threshold": 2.0,
        "target_reduction": 0.32,
        "confidence_estimate": 75
      },
      "confidence": {
        "score": 75,
        "reasoning": "High breach percentage with good data quality."
      }
    }
  ]
}
    "rule_name": "Cycle Time Threshold Breach",
    "flow_dimension": "F",
    "flow_description": "Friction - Delays and congestion",
    
    "title": "Reduce Cycle Time in Zone A",
    "description": "Cycle time is 2.4 hours, exceeding threshold of 2.0 hours by 20%. This may indicate understaffing or zone congestion during peak hours. Recommended action: Add 2 temporary pickers to Zone A or redistribute workload to Zone B.",
    "expected_impact": "Reduce cycle time by 0.32 hours (from 2.4 to 2.08 hours, within threshold of 2.0)",
    
    "status": "PROPOSED",
    "priority": "HIGH",
    "owner_role": "Manager",
    "executor_role": "Supervisor",
    "created_at": "2026-02-24T16:00:00Z",
    "created_by": "SYSTEM",
    
    "context": {
      "kpi_name": "Order_Cycle_Time",
      "current_value": 2.4,
      "threshold": 2.0,
      "breach_absolute": 0.4,
      "breach_percent": 20.0,
      "target_reduction": 0.32,
      "target_value": 2.08,
      "data_confidence_score": 92,
      "zone": "Zone A"
    },
    
    "confidence": {
      "score": 75,
      "level": "MEDIUM",
      "reasoning": "Breach of 20% with high data confidence (92)."
    }
  },
  
  "summary": {
    "actions_generated": 1,
    "next_step": "AWAIT_MANAGER_APPROVAL"
  }
}`;

export const validateData = async (data: string) => {
  const model = "gemini-3-flash-preview";
  const prompt = `
    INPUT DATA (Multiple Files):
    ${data}

    TASK: Perform full multi-file ingestion, schema mapping, and data quality validation as the LeanBridge OI™ Multi-File Data Ingestion & Schema Mapping Engine.
    Ensure you include "tenant_id": "DEMO-TENANT-001" and "ingestion_timestamp": "${new Date().toISOString()}" in the output.
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

export const calculateKPIs = async (data: string, confidenceScore: number, enabledKPIs: string[]) => {
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

    4) ENABLED KPIs:
    ${enabledKPIs.join(', ')}

    TASK: Calculate ONLY the enabled KPIs listed above. 
    For each KPI, perform a deep analysis of the provided data.
    Include the monthly trend analysis and an executive summary for the entire dataset.
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

export const runRuleAndActionEngine = async (kpiData: KPIEngineResult, uploadType: 'weekly' | 'monthly' = 'weekly') => {
  const model = "gemini-3-flash-preview";
  
  // Monthly engine has no action generation as per Document 1
  if (uploadType === 'monthly') {
    return {
      rules: [],
      actions: [],
      summary: "Monthly Orientation Engine (SI-TI): No action generation as per system architecture."
    };
  }

  const ruleDefinitions = [
    {
      "rule_id": "F-LEAD-001",
      "rule_name": "Lead Time Threshold Breach",
      "flow_category": "F",
      "kpi_name": "KPI_003",
      "condition": "greater_than",
      "threshold": 4.0,
      "severity": "HIGH",
      "active": true,
      "action_template": {
        "title": "Reduce Dispatch Lead Time",
        "description": "Order-to-dispatch lead time is {actual_value} hours, exceeding threshold of {threshold} hours.",
        "expected_impact": "Reduce lead time by {target_reduction} hours"
      }
    },
    {
      "rule_id": "W-CLAM-001",
      "rule_name": "High Claim Rate",
      "flow_category": "W",
      "kpi_name": "KPI_005",
      "condition": "greater_than",
      "threshold": 1.0,
      "severity": "HIGH",
      "active": true,
      "action_template": {
        "title": "Investigate Quality Claims",
        "description": "Claim rate is {actual_value}%, exceeding threshold of {threshold}%."
      }
    },
    {
      "rule_id": "L-LOAD-001",
      "rule_name": "Peak Load Imbalance",
      "flow_category": "L",
      "kpi_name": "KPI_004",
      "condition": "greater_than",
      "threshold": 1.5,
      "severity": "MEDIUM",
      "active": true,
      "action_template": {
        "title": "Rebalance Peak Workload",
        "description": "Peak-to-average load ratio is {actual_value}, exceeding threshold of {threshold}."
      }
    },
    {
      "rule_id": "O-COST-001",
      "rule_name": "Excessive Labor Cost",
      "flow_category": "O",
      "kpi_name": "KPI_002",
      "condition": "greater_than",
      "threshold": 3.50,
      "severity": "HIGH",
      "active": true,
      "action_template": {
        "title": "Review Labor Allocation",
        "description": "Labor cost per order is ${actual_value}, exceeding threshold of ${threshold}."
      }
    },
    {
      "rule_id": "W-STOK-001",
      "rule_name": "Stockout Risk",
      "flow_category": "W",
      "kpi_name": "KPI_006",
      "condition": "greater_than",
      "threshold": 2.0,
      "severity": "HIGH",
      "active": true,
      "action_template": {
        "title": "Replenish Critical Stock",
        "description": "Stockout rate is {actual_value}%, exceeding threshold of {threshold}%."
      }
    }
  ];

  const ruleEnginePrompt = `
    1. KPI RESULTS:
    ${JSON.stringify(kpiData.kpis.map(k => ({
      metric: k.metric,
      current_value: k.current_value.average,
      threshold: k.thresholds.warning_max,
      unit: k.unit,
      status: k.status
    })))}

    2. RULE DEFINITIONS:
    ${JSON.stringify(ruleDefinitions)}

    TASK: Run the Rule Engine Matching Logic for ALL provided KPIs.
    Identify which rules are triggered based on the KPI values and thresholds.
  `;

  try {
    // Step 1: Run Rule Engine
    const ruleEngineResponse = await ai.models.generateContent({
      model,
      contents: ruleEnginePrompt,
      config: {
        systemInstruction: RULE_ENGINE_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      }
    });

    const ruleEngineResult = JSON.parse(ruleEngineResponse.text || "{}");

    // Step 2: Generate Actions if rules triggered
    let actions = [];
    if (ruleEngineResult.triggered_rules && ruleEngineResult.triggered_rules.length > 0) {
      // Merge action_template from ruleDefinitions into triggered_rules
      const enrichedTriggeredRules = ruleEngineResult.triggered_rules.map((tr: any) => {
        const ruleDef = ruleDefinitions.find(rd => rd.rule_id === tr.rule_id);
        const kpi = kpiData.kpis.find(k => k.metric === tr.kpi_analyzed || k.metric === ruleDef?.kpi_name);
        
        return {
          ...tr,
          action_template: ruleDef?.action_template,
          kpi_context: {
            kpi_name: kpi?.display_name || tr.kpi_analyzed,
            current_value: kpi?.current_value.average,
            unit: kpi?.unit
          },
          data_confidence_score: kpiData.data_confidence_score
        };
      });

      const actionGenPrompt = `
        TRIGGERED RULES:
        ${JSON.stringify(enrichedTriggeredRules)}

        CURRENT TIME: 2026-03-03T03:35:28-08:00

        TASK: Generate corrective actions for these triggered rules.
      `;

      const actionGenResponse = await ai.models.generateContent({
        model,
        contents: actionGenPrompt,
        config: {
          systemInstruction: ACTION_GEN_SYSTEM_PROMPT,
          responseMimeType: "application/json",
        }
      });

      const actionGenResult = JSON.parse(actionGenResponse.text || "{}");
      actions = actionGenResult.actions || (actionGenResult.generated_action ? [actionGenResult.generated_action] : []);
    }

    return {
      rules: ruleEngineResult.triggered_rules || [],
      actions: actions,
      rule_engine_summary: ruleEngineResult.summary
    };
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

const KPI_CONFIG_DISPLAY_AGENT_PROMPT = `You are the KPI Configuration Display Agent for LeanBridge OI™.

You operate strictly within the LeanBridge OI™ MVP Scope, FRD, and Canonical Schema definitions.

You do NOT invent logic.
You do NOT modify rules.
You do NOT generate new actions.
You do NOT expose internal rule logic.
You do NOT access external knowledge.
You only format and display structured KPI configuration data provided as input.

────────────────────────────────────────────
SYSTEM CONTEXT (MUST FOLLOW STRICTLY)
────────────────────────────────────────────

LeanBridge OI™ consists of TWO independent engines:

1. Monthly Orientation Engine (SI–TI)
   - Uses monthly_kpi_summary table only
   - Provides KPI value + MoM change
   - Provides AI insights only
   - NEVER generates actions
   - NO contributor analysis

2. Weekly Execution Engine (EI)
   - Uses raw canonical tables
   - Computes KPI using transactional data
   - Performs contributor concentration analysis
   - Always generates Top N actions (default 10, configurable)
   - Supports multi-table KPI logic
   - Includes reappearance tracking

You must respect engine separation at all times.

────────────────────────────────────────────
DATA HEALTH GATING (MANDATORY)
────────────────────────────────────────────

If input contains:
- data_health_status = "RED"

Then:
- Suppress all intelligence outputs
- Suppress action sections
- Display only:
  - KPI header
  - Data Health warning
  - Diagnostic explanation
Return no analysis or insights.

Never bypass Data Health gating.

────────────────────────────────────────────
INPUT FORMAT
────────────────────────────────────────────

You will receive structured JSON containing:

{
  "kpi_configuration": { ... full object ... }
}

This object may contain:
- configuration
- client mapping
- weekly analysis
- monthly analysis
- contributors
- rules
- actions
- lifecycle tracking
- calculation detail
- AI insights

You must NOT invent missing fields.
If a section is missing, return:
"section_status": "not_available"

────────────────────────────────────────────
OUTPUT REQUIREMENT (STRICT)
────────────────────────────────────────────

Return ONLY structured JSON.

Do NOT return markdown.
Do NOT return commentary.
Do NOT return explanations outside JSON.
Do NOT summarize.
Do NOT omit sections.

All 10 sections must exist in output in this exact order:

1. kpi_header
2. current_period_data
3. data_schema_mapping
4. contributor_concentration_analysis
5. rule_book_configuration
6. generated_actions
7. action_lifecycle_tracking
8. kpi_calculation_detail
9. ai_intelligence_insights
10. historical_action_effectiveness

If a section does not apply (example: monthly engine has no actions),
return:

{
  "section_status": "not_applicable"
}

────────────────────────────────────────────
SECTION RULES
────────────────────────────────────────────

SECTION 1 – KPI HEADER
Include:
- kpi_id
- kpi_name
- category
- evaluation_engines
- weekly_formula (if exists)
- monthly_formula (if exists)
- canonical_tables_used
- current_status
- threshold_reference

SECTION 2 – CURRENT PERIOD DATA
Display dual engine structure:

{
  "weekly_ei_analysis": { ... },
  "monthly_siti_analysis": { ... }
}

If engine not enabled → mark not_applicable.

SECTION 3 – DATA SCHEMA MAPPING
Include:
- canonical_tables
- client_excel_sheets
- column_mappings
- extraction_status
- last_extraction_timestamp

SECTION 4 – CONTRIBUTOR ANALYSIS
Only if weekly engine present.
Include:
- top_20_contributors
- reappearance_flags
- concentration_metrics
- actionability_assessment

SECTION 5 – RULE BOOK CONFIGURATION
Include:
- rule_id
- rule_name
- condition
- threshold
- priority
- execution_parameters
- reappearance_tracking
- version_metadata

DO NOT expose hidden rule logic beyond provided input.

SECTION 6 – GENERATED ACTIONS
Only for weekly engine.
Include:
- action_plan_id
- generation_timestamp
- triggered_rule
- top_n
- ranked_actions[]

Each action must include:
- contributor
- impact_score
- projected_benefit
- lifecycle_status
- reappearance_count
- escalation_flag (true/false)
- execution_metadata

Highlight re-advised actions using:
"readvised_flag": true

SECTION 7 – ACTION LIFECYCLE TRACKING
Include:
- current_week_summary
- historical_12_week_summary
- reappearance_analysis

SECTION 8 – KPI CALCULATION DETAIL
Include:
- timestamp
- mode
- formula_applied
- extraction_details
- numerator
- denominator
- result_decimal
- result_percentage
- rounding
- data_quality_scores

SECTION 9 – AI INTELLIGENCE INSIGHTS
Structure:

{
  "siti_monthly_insights": {
      "strategic_insights": [],
      "tactical_insights": [],
      "confidence_score": number
  },
  "ei_weekly_insights": {
      "execution_insights": [],
      "execution_recommendations": [],
      "confidence_score": number
  }
}

AI must only explain what exists in data.
No invented reasoning.
No causal claims beyond input.
No external context.

SECTION 10 – HISTORICAL ACTION EFFECTIVENESS
Include:
- last_12_weeks_summary
- acceptance_rate
- execution_rate
- avg_impact
- cumulative_kpi_improvement
- key_learnings (only if provided)

────────────────────────────────────────────
STRICT CONSTRAINTS
────────────────────────────────────────────

• Deterministic output only
• No probabilistic language
• No speculation
• No external benchmarking
• No new KPI creation
• No rule creation
• No autonomous decision making
• No cross-client inference
• No modification of lifecycle states
• No markdown formatting

If input violates MVP scope → respond:

{
  "error": "Out of MVP Scope"
}

────────────────────────────────────────────
PRIMARY OBJECTIVE
────────────────────────────────────────────

Your role is to format and display complete KPI configuration views
exactly as defined in LeanBridge OI™ architecture,
without altering logic, rules, or intelligence.

You are a display layer, not a reasoning layer.`;

export const generateKPIConfiguration = async (state: any) => {
  const model = "gemini-3-flash-preview";
  
  const inputContext = {
    kpi_configuration: {
      configuration: state.kpi_engine?.kpis[0],
      client_mapping: state.validation?.file_processing,
      weekly_analysis: state.kpi_engine?.kpis[0],
      monthly_analysis: state.kpi_engine?.kpis[0]?.trend?.monthly_trend,
      contributors: [], // Not fully implemented in POC yet
      rules: state.rules,
      actions: state.actions,
      lifecycle_tracking: {
        current_week_summary: state.actions.length,
        historical_12_week_summary: [],
        reappearance_analysis: {}
      },
      calculation_detail: {
        timestamp: new Date().toISOString(),
        mode: "weekly",
        formula_applied: state.kpi_engine?.kpis[0]?.metric === "Order_Cycle_Time" ? "AVG(completed_at - created_at)" : "N/A",
        numerator: state.kpi_engine?.kpis[0]?.volume?.completed_orders,
        denominator: state.kpi_engine?.kpis[0]?.volume?.total_orders,
        result_decimal: state.kpi_engine?.kpis[0]?.current_value?.average,
        data_quality_scores: state.validation?.data_quality_checks
      },
      ai_insights: state.kpi_engine?.executive_summary,
      data_health_status: state.validation?.overall_status
    }
  };

  const prompt = `
    INPUT CONTEXT:
    ${JSON.stringify(inputContext)}

    TASK: Generate the structured KPI Configuration JSON as the LeanBridge OI™ KPI Configuration Display Agent.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: KPI_CONFIG_DISPLAY_AGENT_PROMPT,
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("KPI Config generation failed", error);
    return null;
  }
};
