
export enum HealthStatus {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED'
}

export enum GatingDecision {
  PASS = 'PASS',
  WARN = 'WARN',
  BLOCK = 'BLOCK'
}

export enum FlowCategory {
  FRICTION = 'F',
  LOAD = 'L',
  OUTPUT = 'O',
  WASTE = 'W'
}

export enum ActionStatus {
  PROPOSED = 'PROPOSED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXECUTED = 'EXECUTED'
}

export enum ActionPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export interface ValidationIssue {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  issue: string;
  affected_rows: number;
  recommendation: string;
}

export interface DataValidationResult {
  validation_status: HealthStatus;
  confidence_score: number;
  gating_decision: GatingDecision;
  total_rows: number;
  issues_found: ValidationIssue[];
  summary: {
    required_columns_present: boolean;
    completeness_percentage: number;
    duplicate_rows: number;
    date_validation_pass: boolean;
    data_type_validation_pass: boolean;
  };
  metadata: {
    rows_processed: number;
    columns_found: string[];
    date_range: string;
    tenant_id: string;
  };
}

export interface OrderCycleTimeKPI {
  tenant_id: string;
  metric: string;
  display_name: string;
  unit: string;
  period: {
    start: string;
    end: string;
    granularity: string;
  };
  data_confidence_score: number;
  data_confidence_label: 'HIGH' | 'MEDIUM' | 'LOW';

  volume: {
    total_orders: number;
    completed_orders: number;
    completion_rate_percent: number;
  };

  current_value: {
    average: number | null;
    median: number | null;
    p90: number | null;
    min: number | null;
    max: number | null;
  };

  thresholds: {
    healthy_max: number;
    warning_max: number;
    critical_above: number;
  };

  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'DISABLED';

  trend: {
    previous_period_value: number | null;
    change_absolute: number | null;
    change_percent: number | null;
    direction: 'INCREASING' | 'DECREASING' | 'STABLE' | 'UNKNOWN';
    monthly_trend?: {
      values: number[];
      mom_change_percent: number;
      pattern: 'IMPROVING' | 'DEGRADING' | 'VOLATILE' | 'STABLE';
    };
  };

  executive_summary?: string;

  operator_view: {
    simple_label: string;
    why_it_matters: string;
    who_should_care: string[];
  };

  next_step_hint: string;
}

export type KPIEngineResult = OrderCycleTimeKPI;

export interface RuleHistoricalContext {
  trigger_frequency: string;
  recurrence_pattern: string;
  past_action_success_rate: string;
  successful_action_summary: string;
  recommendation: string;
}

export interface TriggeredRule {
  rule_id: string;
  rule_name: string;
  flow_category: FlowCategory;
  threshold: number;
  actual_value: number;
  breach_percentage: number;
  action_required: boolean;
  ai_context: string;
  historical_context?: RuleHistoricalContext;
}

export interface ProposedAction {
  action_id: string;
  status: ActionStatus;
  priority: ActionPriority;
  title: string;
  description: string;
  expected_impact: string;
  owner_role: string;
  rule_trigger_id: string;
  impact_prediction: string;
  reasoning: string;
  rejection_reason?: string;
}

export interface SystemFeedback {
  patterns_detected: string[];
  root_cause_analysis: string;
  rule_tuning_suggestions: string[];
}

export interface AgentWorkflowState {
  raw_data: string;
  validation: DataValidationResult | null;
  kpi_engine: KPIEngineResult | null;
  rules: TriggeredRule[];
  actions: ProposedAction[];
  feedback: SystemFeedback | null;
  isProcessing: boolean;
  error: string | null;
}
