
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
  OVERSTRETCH = 'O',
  WASTE = 'W'
}

export enum ActionStatus {
  PROPOSED = 'PROPOSED',
  ACCEPTED = 'ACCEPTED',
  EXECUTED = 'EXECUTED',
  NOT_EXECUTED = 'NOT_EXECUTED',
  VALIDATED = 'VALIDATED'
}

export enum ActionPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export interface FileProcessingResult {
  file_name: string;
  file_type: 'ORDERS' | 'PICKS' | 'INVENTORY';
  rows: number;
  columns_found: string[];
  mapping_status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  mapped_columns: number;
  unmapped_columns: number;
  missing_required: number;
  missing_columns?: string[];
}

export interface DataValidationResult {
  tenant_id: string;
  ingestion_timestamp: string;
  files_received: number;
  
  file_processing: FileProcessingResult[];
  
  column_mapping_summary: {
    total_files: number;
    fully_mapped: number;
    partially_mapped: number;
    failed_mapping: number;
    mapping_completeness_percent: number;
  };
  
  data_quality_checks: {
    completeness_check: {
      status: HealthStatus;
      score: number;
      missing_values_percent: number;
      critical_columns_complete: boolean;
    };
    data_type_validation: {
      status: HealthStatus;
      score: number;
      type_errors: number;
    };
    cross_file_consistency: {
      status: HealthStatus;
      score: number;
      orders_with_picks: string;
      orphaned_picks: number;
    };
    date_logic_validation: {
      status: HealthStatus;
      score: number;
      negative_durations: number;
      future_dates: number;
    };
    duplicate_detection: {
      duplicate_orders: number;
      duplicate_picks: number;
      duplicate_skus: number;
    };
  };
  
  overall_confidence_score: number;
  overall_status: HealthStatus;
  gating_decision: GatingDecision;
  
  merged_dataset: {
    total_orders: number;
    total_picks: number;
    total_skus: number;
    ready_for_kpi_calculation: boolean;
  };
  
  issues_found: {
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    file?: string;
    issue: string;
    affected_rows: number;
    recommendation: string;
  }[];
  
  next_step: string;
  kpis_available: string[];
  kpis_disabled: string[];
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

export interface KPIEngineResult {
  tenant_id: string;
  data_confidence_score: number;
  data_confidence_label: 'HIGH' | 'MEDIUM' | 'LOW';
  executive_summary: string;
  kpis: OrderCycleTimeKPI[];
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'DISABLED';
}

export interface RuleActionTemplate {
  title: string;
  description: string;
  expected_impact: string;
}

export interface TriggeredRule {
  rule_id: string;
  rule_name: string;
  triggered: boolean;
  flow_dimension: FlowCategory;
  breach_absolute: number;
  breach_percent: number;
  calculated_severity: 'SEVERE' | 'HIGH' | 'MEDIUM' | 'LOW';
  rule_severity: string;
  target_reduction: number;
  action_template: RuleActionTemplate;
}

export interface NonTriggeredRule {
  rule_id: string;
  rule_name: string;
  triggered: boolean;
  reason: string;
}

export interface RuleEngineResult {
  tenant_id: string;
  kpi_analyzed: string;
  current_value: number;
  threshold: number;
  triggered_rules: TriggeredRule[];
  non_triggered_rules: NonTriggeredRule[];
  summary: {
    total_rules_evaluated: number;
    rules_triggered: number;
    rules_not_triggered: number;
    highest_severity_triggered: string;
    flow_dimensions_triggered: string[];
    recommended_action_priority: ActionPriority;
  };
  next_step: string;
}

export interface ActionContext {
  kpi_name: string;
  current_value: number;
  threshold: number;
  breach_absolute: number;
  breach_percent: number;
  target_reduction: number;
  target_value: number;
  data_confidence_score: number;
  zone: string;
  confidence_estimate?: number;
}

export interface ActionConfidence {
  score: number;
  level: string;
  reasoning: string;
}

export interface ActionStateMachine {
  current_state: ActionStatus;
  available_transitions: ActionStatus[];
  requires_approval: boolean;
  approval_role: string;
  next_state_on_approval: ActionStatus;
  next_state_on_rejection: ActionStatus;
}

export interface ActionExecutionTracking {
  assigned_to_supervisor: string | null;
  execution_start: string | null;
  execution_end: string | null;
  execution_results: string | null;
  feedback_reason: string | null;
}

export interface ProposedAction {
  action_id: string;
  rule_trigger_id: string;
  rule_name: string;
  flow_dimension: FlowCategory;
  flow_description?: string;
  
  title: string;
  description: string;
  expected_impact: string;
  
  status: ActionStatus;
  priority: ActionPriority;
  owner_role: string;
  executor_role: string;
  created_at: string;
  created_by: string;
  
  context: ActionContext;
  confidence: ActionConfidence;
  state_machine?: ActionStateMachine;
  execution_tracking?: ActionExecutionTracking;
  
  // Keep these for backward compatibility or internal use if needed, 
  // but the new structure is the primary focus.
  impact_prediction?: string;
  reasoning?: string;
  rejection_reason?: string;
}

export interface SystemFeedback {
  patterns_detected: string[];
  root_cause_analysis: string;
  rule_tuning_suggestions: string[];
}

export interface KPIConfiguration {
  kpi_header: {
    kpi_id: string;
    kpi_name: string;
    category: string;
    evaluation_engines: string[];
    weekly_formula?: string;
    monthly_formula?: string;
    canonical_tables_used: string[];
    current_status: string;
    threshold_reference: string;
  } | { section_status: 'not_available' | 'not_applicable' };
  current_period_data: {
    weekly_ei_analysis: any;
    monthly_siti_analysis: any;
  } | { section_status: 'not_available' | 'not_applicable' };
  data_schema_mapping: {
    canonical_tables: string[];
    client_excel_sheets: string[];
    column_mappings: any;
    extraction_status: string;
    last_extraction_timestamp: string;
  } | { section_status: 'not_available' | 'not_applicable' };
  contributor_concentration_analysis: {
    top_20_contributors: any[];
    reappearance_flags: any;
    concentration_metrics: any;
    actionability_assessment: string;
  } | { section_status: 'not_available' | 'not_applicable' };
  rule_book_configuration: {
    rule_id: string;
    rule_name: string;
    condition: string;
    threshold: number;
    priority: string;
    execution_parameters: any;
    reappearance_tracking: any;
    version_metadata: any;
  }[] | { section_status: 'not_available' | 'not_applicable' };
  generated_actions: {
    action_plan_id: string;
    generation_timestamp: string;
    triggered_rule: string;
    top_n: number;
    ranked_actions: any[];
  } | { section_status: 'not_available' | 'not_applicable' };
  action_lifecycle_tracking: {
    current_week_summary: any;
    historical_12_week_summary: any;
    reappearance_analysis: any;
  } | { section_status: 'not_available' | 'not_applicable' };
  kpi_calculation_detail: {
    timestamp: string;
    mode: string;
    formula_applied: string;
    extraction_details: any;
    numerator: number;
    denominator: number;
    result_decimal: number;
    result_percentage: number;
    rounding: string;
    data_quality_scores: any;
  } | { section_status: 'not_available' | 'not_applicable' };
  ai_intelligence_insights: {
    siti_monthly_insights: {
      strategic_insights: string[];
      tactical_insights: string[];
      confidence_score: number;
    };
    ei_weekly_insights: {
      execution_insights: string[];
      execution_recommendations: string[];
      confidence_score: number;
    };
  } | { section_status: 'not_available' | 'not_applicable' };
  historical_action_effectiveness: {
    last_12_weeks_summary: any;
    acceptance_rate: number;
    execution_rate: number;
    avg_impact: number;
    cumulative_kpi_improvement: number;
    key_learnings?: string[];
  } | { section_status: 'not_available' | 'not_applicable' };
}

export interface AgentWorkflowState {
  raw_data: string;
  quarantine: { name: string; content: string }[];
  validation: DataValidationResult | null;
  kpi_engine: KPIEngineResult | null;
  rules: TriggeredRule[];
  actions: ProposedAction[];
  feedback: SystemFeedback | null;
  kpi_config: KPIConfiguration | null;
  isProcessing: boolean;
  error: string | null;
}
