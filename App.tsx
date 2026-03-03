
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Activity, 
  BarChart3, 
  Database, 
  AlertTriangle, 
  CheckCircle2, 
  Play, 
  LayoutDashboard, 
  MessageSquare, 
  FileText, 
  Clock, 
  User, 
  Zap, 
  TrendingUp, 
  Settings2, 
  Send, 
  ArrowUpRight, 
  Target, 
  ShieldCheck, 
  BrainCircuit, 
  XCircle, 
  History, 
  Lightbulb, 
  ShieldAlert, 
  ListFilter, 
  ChevronRight, 
  Upload, 
  Download,
  Briefcase,
  ClipboardList,
  TrendingDown,
  Minus,
  X,
  Cpu,
  Network,
  ArrowDown,
  Layers,
  Calendar,
  Bell,
  Settings,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AgentWorkflowState, 
  HealthStatus, 
  ActionStatus, 
  ProposedAction, 
  GatingDecision,
  OrderCycleTimeKPI
} from './types';
import { 
  validateData, 
  calculateKPIs, 
  runRuleAndActionEngine, 
  getAIExplanation, 
  runFeedbackAnalysis,
  generateKPIConfiguration
} from './services/geminiService';

// --- Logo Component ---
const LeanBridgeLogo = () => (
  <div className="flex items-center gap-3">
    <div className="flex items-end gap-0.5 text-purple-600 shrink-0">
      <LeanBridgeLogoIcon />
    </div>
    <div className="w-[2px] h-10 bg-purple-600 rounded-full mx-1"></div>
    <div className="flex flex-col">
      <span className="text-2xl font-semibold tracking-tight text-slate-900 leading-none">LeanBridge</span>
      <span className="text-[7px] font-bold tracking-[0.15em] text-slate-800 mt-1 uppercase">Lean Thinking Real Results</span>
    </div>
  </div>
);

const LeanBridgeLogoIcon = () => (
  <svg width="42" height="32" viewBox="0 0 42 32" fill="currentColor">
    <circle cx="10" cy="8" r="3.5" />
    <path d="M4 14C4 14 6 12 10 12C14 12 16 14 16 14L14 26H6L4 14Z" />
    <circle cx="21" cy="6" r="4.5" />
    <path d="M13 13C13 13 16 10 21 10C26 10 29 13 29 13L26 28H16L13 13Z" />
    <circle cx="32" cy="8" r="3.5" />
    <path d="M26 14C26 14 28 12 32 12C36 12 38 14 38 14L36 26H28L26 14Z" />
  </svg>
);

const StatusBadge = ({ status }: { status: HealthStatus | string | null }) => {
  if (!status) return null;
  const colors: Record<string, string> = {
    GREEN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    YELLOW: 'bg-amber-50 text-amber-700 border-amber-200',
    RED: 'bg-rose-50 text-rose-700 border-rose-200',
    PASS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    WARN: 'bg-amber-50 text-amber-700 border-amber-200',
    BLOCK: 'bg-rose-600 text-white border-rose-700',
    HEALTHY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    WARNING: 'bg-amber-50 text-amber-700 border-amber-200',
    CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
    HIGH: 'bg-rose-50 text-rose-700 border-rose-200',
    MEDIUM: 'bg-orange-50 text-orange-700 border-orange-200',
    LOW: 'bg-purple-50 text-purple-700 border-purple-200',
    PROPOSED: 'bg-slate-50 text-slate-600 border-slate-200',
    ACCEPTED: 'bg-purple-100 text-purple-700 border-purple-200',
    EXECUTED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-slate-100 text-slate-400 border-slate-200',
    ACTIVE: 'bg-purple-50 text-purple-700 border-purple-200',
    DISABLED: 'bg-slate-100 text-slate-400 border-slate-200 grayscale',
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${colors[status] || colors['PROPOSED']}`}>
      {status}
    </span>
  );
};

const CANONICAL_KPIS = [
  {
    id: 'KPI_001',
    number: 1,
    name: 'Overtime %',
    category: 'Warehouse Operations',
    description: 'Percentage of overtime hours vs total work hours',
    formula: 'SUM(overtime_hours) / SUM(total_work_hours) × 100',
    frequency: ['weekly', 'monthly'],
    tables: ['labor_workforce (Weekly)', 'monthly_kpi_summary (Monthly)'],
    recommendation: '✅ Essential for labor cost management'
  },
  {
    id: 'KPI_002',
    number: 2,
    name: 'Labor Cost per Order',
    category: 'Warehouse Operations',
    description: 'Average labor cost per fulfilled order',
    formula: 'SUM(labor_cost) / COUNT(DISTINCT order_id)',
    frequency: ['weekly', 'monthly'],
    tables: ['labor_workforce + orders_outbound (Weekly)', 'monthly_kpi_summary (Monthly)'],
    recommendation: '✅ Essential for operational efficiency'
  },
  {
    id: 'KPI_003',
    number: 3,
    name: 'Order-to-Dispatch Lead Time',
    category: 'Warehouse Operations',
    description: 'Average time from order placement to dispatch',
    formula: 'AVG(dispatch_time - order_date)',
    frequency: ['weekly', 'monthly'],
    tables: ['orders_outbound (Weekly)', 'monthly_kpi_summary (Monthly)'],
    recommendation: '✅ Critical for customer satisfaction'
  },
  {
    id: 'KPI_004',
    number: 4,
    name: 'Peak-to-Average Load Ratio',
    category: 'Warehouse Operations',
    description: 'Ratio of maximum daily orders to average daily orders',
    formula: 'Max(Daily Orders) / Avg(Daily Orders)',
    frequency: ['weekly', 'monthly'],
    tables: ['orders_outbound (Weekly)', 'monthly_kpi_summary (Monthly)'],
    recommendation: '⚠️ Important for capacity planning'
  },
  {
    id: 'KPI_005',
    number: 5,
    name: 'Claim %',
    category: 'Warehouse Operations',
    description: 'Percentage of claimed items vs total shipped items',
    formula: 'SUM(claim_quantity) / SUM(quantity) × 100',
    frequency: ['weekly', 'monthly'],
    tables: ['claims + orders_outbound (Weekly)', 'monthly_kpi_summary (Monthly)'],
    recommendation: '✅ Critical for quality management'
  },
  {
    id: 'KPI_006',
    number: 6,
    name: 'Stockout / Backorder Rate',
    category: 'Warehouse Operations',
    description: 'Percentage of backordered orders vs total orders',
    formula: 'Backorder Orders / Total Orders × 100',
    frequency: ['weekly', 'monthly'],
    tables: ['orders_outbound (Weekly)', 'monthly_kpi_summary (Monthly)'],
    recommendation: '✅ Essential for inventory availability'
  },
  {
    id: 'KPI_007',
    number: 7,
    name: 'Operational Claim Rate %',
    category: 'Warehouse Operations',
    description: 'Percentage of operational claims (warehouse errors) vs total orders',
    formula: "SUM(claim_quantity WHERE claim_type = 'Operational') / Total Orders × 100",
    frequency: ['weekly', 'monthly'],
    tables: ['claims + orders_outbound (Weekly)', 'monthly_kpi_summary (Monthly)'],
    recommendation: '✅ Critical for process improvement'
  },
  {
    id: 'KPI_008',
    number: 8,
    name: 'Dock-to-Stock Cycle Time',
    category: 'Warehouse Operations',
    description: 'Average time from receipt to stock availability',
    formula: 'AVG(stock_available_time - receipt_time)',
    frequency: ['weekly', 'monthly'],
    tables: ['inbound_receipts (Weekly)', 'monthly_kpi_summary (Monthly)'],
    recommendation: '⚠️ Important for inbound efficiency'
  },
  {
    id: 'KPI_009',
    number: 9,
    name: 'Inventory Turnover',
    category: 'Inventory Management',
    description: 'How many times inventory is sold and replaced in a period',
    formula: 'total_cogs / average_inventory_value',
    frequency: ['weekly', 'monthly'],
    tables: ['inventory_snapshot (Weekly)', 'monthly_kpi_summary (Monthly)'],
    recommendation: '✅ Critical for cash flow management'
  },
  {
    id: 'KPI_010',
    number: 10,
    name: 'Inventory Carrying Cost Ratio',
    category: 'Inventory Management',
    description: 'Cost of holding inventory as percentage of total inventory value',
    formula: 'Carrying Cost / total_inventory_value × 100',
    frequency: ['monthly'],
    tables: ['monthly_kpi_summary (Monthly)'],
    recommendation: '✅ Essential for financial planning'
  },
  {
    id: 'KPI_011',
    number: 11,
    name: 'Inventory-to-Sales Ratio',
    category: 'Inventory Management',
    description: 'Inventory value as percentage of sales value',
    formula: 'total_inventory_value / total_sales_value',
    frequency: ['monthly'],
    tables: ['monthly_kpi_summary (Monthly)'],
    recommendation: '⚠️ Important for working capital management'
  },
  {
    id: 'KPI_012',
    number: 12,
    name: 'Inventory Shrinkage %',
    category: 'Inventory Management',
    description: 'Loss of inventory due to theft, damage, or errors',
    formula: '(Book - Physical) / Book × 100',
    frequency: ['weekly', 'monthly'],
    tables: ['cycle_count + inventory_snapshot (Weekly)', 'monthly_kpi_summary (Monthly)'],
    recommendation: '✅ Critical for loss prevention'
  },
  {
    id: 'KPI_013',
    number: 13,
    name: 'Cash-Tied Inventory Ratio',
    category: 'Inventory Management',
    description: 'Percentage of inventory value tied up in slow-moving items',
    formula: 'total_slow_moving_inventory_value / total_inventory_value × 100',
    frequency: ['weekly', 'monthly'],
    tables: ['inventory_snapshot (Weekly)', 'monthly_kpi_summary (Monthly)'],
    recommendation: '✅ Critical for liquidity management'
  },
  {
    id: 'KPI_014',
    number: 14,
    name: 'Low Inventory Risk Index',
    category: 'Inventory Management',
    description: 'Percentage of inventory below safety stock levels',
    formula: 'total_inventory_value_below_safety / total_inventory_value × 100',
    frequency: ['weekly', 'monthly'],
    tables: ['inventory_snapshot (Weekly)', 'monthly_kpi_summary (Monthly)'],
    recommendation: '✅ Essential for inventory availability'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'dashboard' | 'actions' | 'tuning' | 'chat' | 'strategic' | 'execution' | 'config' | 'architecture' | 'kpi_selection' | 'main_dashboard'>('main_dashboard');
  const [userRole, setUserRole] = useState<'LeanBridge Consultant' | 'Client Executive' | 'Client Manager' | 'Client Supervisor'>('Client Manager');
  const [selectedKPI, setSelectedKPI] = useState<OrderCycleTimeKPI | null>(null);
  const [uploadType, setUploadType] = useState<'weekly' | 'monthly' | null>(null);
  const [selectedKPIIds, setSelectedKPIIds] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [state, setState] = useState<AgentWorkflowState>({
    raw_data: '',
    quarantine: [],
    validation: null,
    kpi_engine: null,
    rules: [],
    actions: [],
    feedback: null,
    kpi_config: null,
    isProcessing: false,
    error: null,
  });

  const [chatQuestion, setChatQuestion] = useState('');
  const [chatResponse, setChatResponse] = useState<any>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const insertSampleData = () => {
    const sample = `order_id,customer_id,created_at,completed_at,zone,picker_id,quantity
ORD-1001,C-50,2024-06-01 08:00:00,2024-06-01 09:30:00,A,P-01,15
ORD-1002,C-12,2024-06-01 08:15:00,2024-06-01 09:10:00,B,P-02,5
ORD-1003,C-88,2024-06-01 09:00:00,2024-06-01 12:45:00,A,P-01,8
ORD-1004,C-50,2024-06-01 10:00:00,2024-06-01 10:45:00,C,P-03,2
ORD-1005,C-12,2024-06-01 11:30:00,2024-06-01 11:55:00,B,P-02,22
ORD-1006,C-99,2024-06-01 12:00:00,2024-06-01 16:30:00,A,P-01,12`;
    setState(prev => ({ ...prev, raw_data: sample }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileList: File[] = Array.from(files);
      let combinedData = '';
      let quarantine: { name: string; content: string }[] = [];
      let processedCount = 0;

      fileList.forEach(file => {
        const reader = new FileReader();
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

        reader.onload = (event) => {
          const data = event.target?.result;
          let fileContent = '';
          if (isExcel) {
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            fileContent = XLSX.utils.sheet_to_csv(worksheet);
          } else {
            fileContent = data as string;
          }

          quarantine.push({ name: file.name, content: fileContent });
          combinedData += `--- FILE: ${file.name} ---\n${fileContent}\n\n`;

          processedCount++;
          if (processedCount === fileList.length) {
            setState(prev => ({ ...prev, raw_data: combinedData, quarantine }));
          }
        };

        if (isExcel) {
          reader.readAsBinaryString(file);
        } else {
          reader.readAsText(file);
        }
      });
    }
  };

  const handleRunWorkflow = async () => {
    if (!state.raw_data.trim()) return;
    setState(prev => ({ ...prev, isProcessing: true, error: null, validation: null, kpi_engine: null }));
    setIsSuccess(false);
    
    try {
      const validationResult = await validateData(state.raw_data);
      setState(prev => ({ ...prev, validation: validationResult }));

      if (validationResult.gating_decision === GatingDecision.BLOCK) {
        setState(prev => ({ ...prev, isProcessing: false, error: "Critical validation errors detected. Processing blocked." }));
        return;
      }

      setState(prev => ({ ...prev, isProcessing: false }));
      setIsSuccess(true);
    } catch (err) {
      setState(prev => ({ ...prev, isProcessing: false, error: "Modular pipeline failure. Please check data format." }));
    }
  };

  const handleCalculateKPIs = async () => {
    if (selectedKPIIds.length === 0) return;
    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    
    try {
      const kpiEngineResult = await calculateKPIs(state.raw_data, state.validation?.overall_confidence_score || 0, selectedKPIIds);
      setState(prev => ({ ...prev, kpi_engine: kpiEngineResult }));

      if (kpiEngineResult.status === 'DISABLED') {
        setState(prev => ({ ...prev, isProcessing: false, error: "KPI Engine is disabled for this dataset." }));
        return;
      }

      const ruleActionResult = await runRuleAndActionEngine(kpiEngineResult, uploadType);
      
      const intermediateState = {
        ...state,
        kpi_engine: kpiEngineResult,
        rules: ruleActionResult.rules,
        actions: ruleActionResult.actions,
      };

      const kpiConfig = await generateKPIConfiguration(intermediateState);

      setState({
        ...intermediateState,
        kpi_config: kpiConfig,
        isProcessing: false,
      });
      
      setActiveTab(uploadType === 'weekly' ? 'dashboard' : 'strategic');
    } catch (err) {
      setState(prev => ({ ...prev, isProcessing: false, error: "KPI calculation failed. Please try again." }));
    }
  };

  const updateActionStatus = async (actionId: string, newStatus: ActionStatus, reason?: string) => {
    setState(prev => ({
      ...prev,
      actions: prev.actions.map(a => a.action_id === actionId ? { 
        ...a, 
        status: newStatus, 
        rejection_reason: reason,
        state_machine: a.state_machine ? {
          ...a.state_machine,
          current_state: newStatus
        } : undefined
      } : a)
    }));
  };

  const handleAnalyzeFeedback = async () => {
    const processedActions = state.actions.filter(a => a.status !== ActionStatus.PROPOSED);
    if (processedActions.length === 0) return;
    
    setState(prev => ({ ...prev, isProcessing: true }));
    const result = await runFeedbackAnalysis(processedActions);
    setState(prev => ({ ...prev, feedback: result, isProcessing: false }));
  };

  const handleAskAI = async () => {
    if (!chatQuestion.trim()) return;
    setIsChatLoading(true);
    try {
      const response = await getAIExplanation(chatQuestion, {
        validation: state.validation,
        kpi: state.kpi_engine,
        rules: state.rules,
        actions: state.actions,
        feedback: state.feedback
      });
      setChatResponse(response);
    } catch (err) {
      console.error(err);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 selection:bg-purple-200">
      {/* Sidebar */}
      <nav className="w-72 border-r border-slate-200 bg-white flex flex-col p-6 shrink-0 shadow-sm z-20">
        <div className="mb-10 pb-6 border-b border-slate-100">
          <LeanBridgeLogo />
        </div>

        <div className="space-y-1.5 flex-1 overflow-y-auto pr-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 px-3">Main Engine</p>
          <button onClick={() => setActiveTab('upload')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${activeTab === 'upload' ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100 font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'}`}>
            <div className="flex items-center gap-3">
              <Database className="w-4 h-4" />
              <span className="text-sm">Data Ingestion</span>
            </div>
            {activeTab === 'upload' && <ChevronRight className="w-4 h-4" />}
          </button>

          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-8 mb-3 px-3">Intelligence Views</p>
          
          <button 
            disabled={!state.kpi_engine} 
            onClick={() => setActiveTab('main_dashboard')} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${!state.kpi_engine ? 'opacity-30 cursor-not-allowed' : activeTab === 'main_dashboard' ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100 font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'}`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-sm">Main Dashboard</span>
            </div>
            {activeTab === 'main_dashboard' && <ChevronRight className="w-4 h-4" />}
          </button>

          <button 
            disabled={!state.kpi_engine || (userRole !== 'LeanBridge Consultant' && userRole !== 'Client Executive')} 
            onClick={() => setActiveTab('strategic')} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${!state.kpi_engine || (userRole !== 'LeanBridge Consultant' && userRole !== 'Client Executive') ? 'opacity-30 cursor-not-allowed' : activeTab === 'strategic' ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100 font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'}`}
          >
            <div className="flex items-center gap-3">
              <Briefcase className="w-4 h-4" />
              <span className="text-sm">SI-TI Strategic</span>
            </div>
            {activeTab === 'strategic' && <ChevronRight className="w-4 h-4" />}
          </button>

          <button 
            disabled={!state.kpi_engine || selectedKPIIds.length === 0 || (userRole !== 'LeanBridge Consultant' && userRole !== 'Client Manager' && userRole !== 'Client Supervisor')} 
            onClick={() => setActiveTab('dashboard')} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${!state.kpi_engine || selectedKPIIds.length === 0 || (userRole !== 'LeanBridge Consultant' && userRole !== 'Client Manager' && userRole !== 'Client Supervisor') ? 'opacity-30 cursor-not-allowed' : activeTab === 'dashboard' ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100 font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'}`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-sm">Weekly Dashboard</span>
            </div>
            {activeTab === 'dashboard' && <ChevronRight className="w-4 h-4" />}
          </button>

          <button 
            disabled={!state.validation || (userRole !== 'LeanBridge Consultant' && userRole !== 'Client Manager' && userRole !== 'Client Supervisor')} 
            onClick={() => setActiveTab('actions')} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${!state.validation || (userRole !== 'LeanBridge Consultant' && userRole !== 'Client Manager' && userRole !== 'Client Supervisor') ? 'opacity-30 cursor-not-allowed' : activeTab === 'actions' ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100 font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'}`}
          >
            <div className="flex items-center gap-3">
              <Target className="w-4 h-4" />
              <span className="text-sm">Action Tracker</span>
            </div>
            {activeTab === 'actions' && <ChevronRight className="w-4 h-4" />}
          </button>

          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-8 mb-3 px-3">System Optimization</p>
          <button 
            disabled={!state.validation || userRole !== 'LeanBridge Consultant'} 
            onClick={() => setActiveTab('tuning')} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${!state.validation || userRole !== 'LeanBridge Consultant' ? 'opacity-30 cursor-not-allowed' : activeTab === 'tuning' ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100 font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'}`}
          >
            <div className="flex items-center gap-3">
              <Settings2 className="w-4 h-4" />
              <span className="text-sm">System Tuning</span>
            </div>
            {activeTab === 'tuning' && <ChevronRight className="w-4 h-4" />}
          </button>

          <button 
            disabled={!state.kpi_config || userRole !== 'LeanBridge Consultant'} 
            onClick={() => setActiveTab('config')} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${!state.kpi_config || userRole !== 'LeanBridge Consultant' ? 'opacity-30 cursor-not-allowed' : activeTab === 'config' ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100 font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'}`}
          >
            <div className="flex items-center gap-3">
              <ListFilter className="w-4 h-4" />
              <span className="text-sm">KPI Config</span>
            </div>
            {activeTab === 'config' && <ChevronRight className="w-4 h-4" />}
          </button>

          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-8 mb-3 px-3">System Architecture</p>
          <button onClick={() => setActiveTab('architecture')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${activeTab === 'architecture' ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100 font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'}`}>
            <div className="flex items-center gap-3">
              <Cpu className="w-4 h-4" />
              <span className="text-sm">Architecture</span>
            </div>
            {activeTab === 'architecture' && <ChevronRight className="w-4 h-4" />}
          </button>

          <button disabled={!state.validation} onClick={() => setActiveTab('chat')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${!state.validation ? 'opacity-30 cursor-not-allowed' : activeTab === 'chat' ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100 font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'}`}>
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm">AI Explainer</span>
            </div>
            {activeTab === 'chat' && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        <div className="mt-auto bg-slate-50 rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Protocol Active</span>
          </div>
          <p className="text-[11px] text-slate-600 font-medium leading-relaxed">LeanBridge Guard v4.2.0 monitoring active operational streams.</p>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Current Role</p>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setUserRole('LeanBridge Consultant')} 
                className={`py-2 rounded-lg text-[10px] font-bold transition-all ${userRole === 'LeanBridge Consultant' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
              >
                CONSULTANT
              </button>
              <button 
                onClick={() => setUserRole('Client Executive')} 
                className={`py-2 rounded-lg text-[10px] font-bold transition-all ${userRole === 'Client Executive' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
              >
                EXECUTIVE
              </button>
              <button 
                onClick={() => setUserRole('Client Manager')} 
                className={`py-2 rounded-lg text-[10px] font-bold transition-all ${userRole === 'Client Manager' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
              >
                MANAGER
              </button>
              <button 
                onClick={() => setUserRole('Client Supervisor')} 
                className={`py-2 rounded-lg text-[10px] font-bold transition-all ${userRole === 'Client Supervisor' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
              >
                SUPERVISOR
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-y-auto">
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold tracking-tight text-slate-800 capitalize">{activeTab.replace('_', ' ')}</h2>
            {state.isProcessing && (
              <div className="flex items-center gap-2 text-purple-600 text-[11px] font-bold px-3 py-1 bg-purple-50 rounded-full border border-purple-100 animate-pulse">
                <Activity className="w-3 h-3 animate-spin" />
                ORCHESTRATING PIPELINE
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-6">
             {state.validation && (
              <div className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Validation Status</span>
                <StatusBadge status={state.validation.overall_status} />
              </div>
            )}
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-200">
               <span className="text-xs">LB</span>
            </div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto w-full">
          {activeTab === 'upload' && (
            <div className="space-y-10 animate-in fade-in duration-500">
              {!uploadType ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-20">
                  <button 
                    onClick={() => setUploadType('weekly')}
                    className="bg-white p-12 rounded-[50px] border-2 border-slate-100 hover:border-purple-600 transition-all shadow-xl shadow-slate-200/50 group text-left"
                  >
                    <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 mb-8 group-hover:scale-110 transition-transform">
                      <Zap className="w-8 h-8" />
                    </div>
                    <h4 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter">Weekly Execution</h4>
                    <p className="text-slate-500 font-medium leading-relaxed">Upload raw transactional data for immediate operational actions and granular analysis.</p>
                    <div className="mt-8 flex items-center gap-2 text-purple-600 font-bold text-sm">
                      <span>Proceed to Weekly Upload</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>

                  <button 
                    onClick={() => setUploadType('monthly')}
                    className="bg-white p-12 rounded-[50px] border-2 border-slate-100 hover:border-indigo-600 transition-all shadow-xl shadow-slate-200/50 group text-left"
                  >
                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-8 group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-8 h-8" />
                    </div>
                    <h4 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter">Monthly Strategic</h4>
                    <p className="text-slate-500 font-medium leading-relaxed">Upload aggregated monthly summaries for long-term orientation and tactical insights.</p>
                    <div className="mt-8 flex items-center gap-2 text-indigo-600 font-bold text-sm">
                      <span>Proceed to Monthly Upload</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                </div>
              ) : (
                <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/50 relative overflow-hidden">
                  {/* Glow Background from Screenshot */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[80px] -mr-16 -mt-16"></div>
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 blur-[80px] -ml-16 -mb-16"></div>

                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-6">
                      <button 
                        onClick={() => setUploadType(null)}
                        className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 rotate-180 text-slate-400" />
                      </button>
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">
                          {uploadType === 'weekly' ? 'Weekly Execution Data Intake' : 'Monthly Strategic Data Intake'}
                        </h3>
                        <p className="text-slate-500 text-sm">Synchronize your {uploadType} warehouse logs with LeanBridge's real-time engine.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        accept=".csv,.txt,.xlsx,.xls"
                        multiple
                      />
                      <button onClick={insertSampleData} className="text-xs font-bold text-purple-600 hover:text-purple-700 transition-colors uppercase tracking-widest flex items-center gap-2 bg-purple-50 px-4 py-2.5 rounded-xl border border-purple-100 shadow-sm">
                        <FileText className="w-4 h-4" /> USE DEMO LOGS
                      </button>
                    </div>
                  </div>

                  <div className="relative group z-10">
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-[34px] blur opacity-25 group-focus-within:opacity-100 transition duration-500"></div>
                    <textarea 
                      value={state.raw_data}
                      onChange={(e) => setState(prev => ({ ...prev, raw_data: e.target.value }))}
                      className="relative w-full h-80 bg-slate-50/50 border border-slate-200 rounded-3xl p-8 font-mono text-sm text-slate-800 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-50 transition-all placeholder:text-slate-400 shadow-inner"
                      placeholder={uploadType === 'weekly' ? "Paste Weekly CSV format: order_id, created_at, completed_at, zone, picker_id, quantity..." : "Paste Monthly Summary CSV format: monthyear, totalorders, totalunits, totalworkhours..."}
                    />
                    {/* Upload Label Suggestion from Screenshot */}
                    {!state.raw_data && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                            <div className="text-center">
                                <Upload className="w-10 h-10 text-purple-400 mx-auto mb-2" />
                                <p className="text-sm font-bold text-purple-500 uppercase tracking-widest">upload option should be there</p>
                            </div>
                        </div>
                    )}
                  </div>

                  <div className="mt-10 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-8">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         <ShieldCheck className="w-4 h-4 text-emerald-500" /> GROUNDING VERIFIED
                      </div>
                      {state.quarantine.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quarantine:</span>
                          <div className="flex -space-x-2">
                            {state.quarantine.map((f, i) => (
                              <div key={i} title={f.name} className="w-6 h-6 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center shadow-sm">
                                <FileText className="w-3 h-3 text-purple-600" />
                              </div>
                            ))}
                          </div>
                          <span className="text-[10px] font-bold text-purple-600 ml-2">{state.quarantine.length} Files Staged</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest flex items-center gap-2 px-6"
                      >
                          <Upload className="w-4 h-4" /> Upload
                      </button>
                      <button onClick={handleRunWorkflow} disabled={!state.raw_data || state.isProcessing} className={`font-bold px-12 py-5 rounded-2xl shadow-xl flex items-center gap-3 transition-all active:scale-95 group relative overflow-hidden ${isSuccess ? 'bg-emerald-600 shadow-emerald-200 text-white' : 'bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 text-white shadow-purple-200'}`}>
                          <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                          <span className="relative z-10">
                            {state.isProcessing ? "PROCESSING..." : isSuccess ? "REPORT GENERATED" : "EXECUTE PIPELINE"}
                          </span>
                          {isSuccess ? <CheckCircle2 className="w-4 h-4 relative z-10" /> : <Play className="w-4 h-4 fill-current group-hover:translate-x-1 transition-transform relative z-10" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {state.validation && (
                <div className={`p-10 rounded-[32px] border shadow-2xl animate-in slide-in-from-bottom-8 duration-700 ${state.validation.gating_decision === GatingDecision.BLOCK ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-start justify-between mb-10">
                    <div className="flex items-center gap-6">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${state.validation.gating_decision === GatingDecision.BLOCK ? 'bg-rose-600 text-white shadow-rose-200' : 'bg-emerald-600 text-white shadow-emerald-200'}`}>
                        {state.validation.gating_decision === GatingDecision.BLOCK ? <ShieldAlert className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
                      </div>
                      <div>
                        <h4 className="text-2xl font-bold">Multi-File Ingestion Report</h4>
                        <div className="flex items-center gap-4 mt-2">
                          <StatusBadge status={state.validation.overall_status} />
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Confidence Score: {state.validation.overall_confidence_score}%</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Files: {state.validation.files_received}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-5xl font-bold tracking-tighter text-slate-900">
                        {state.validation.merged_dataset.total_orders + state.validation.merged_dataset.total_picks + state.validation.merged_dataset.total_skus}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Records Merged</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-10">
                    {state.validation.file_processing.map((file, idx) => (
                      <div key={idx} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 relative overflow-hidden group hover:border-purple-200 transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                            <FileText className="w-4 h-4 text-purple-600" />
                          </div>
                          <StatusBadge status={file.mapping_status} />
                        </div>
                        <p className="text-sm font-bold text-slate-900 truncate mb-1">{file.file_name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{file.file_type} • {file.rows} ROWS</p>
                        <div className="flex items-center gap-2">
                           <div className="h-1 flex-1 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-purple-500" 
                                style={{ width: `${(file.mapped_columns / (file.mapped_columns + file.unmapped_columns + file.missing_required || 1)) * 100}%` }}
                              ></div>
                           </div>
                           <span className="text-[10px] font-bold text-slate-500">{file.mapped_columns} Mapped</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="space-y-6">
                       <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Database className="w-3 h-3" /> Mapping Summary
                          </p>
                          <div className="space-y-3">
                             <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-600 font-medium">Total Files</span>
                                <span className="text-xs font-bold text-slate-900">{state.validation.column_mapping_summary.total_files}</span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-600 font-medium">Fully Mapped</span>
                                <span className="text-xs font-bold text-emerald-600">{state.validation.column_mapping_summary.fully_mapped}</span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-600 font-medium">Mapping Completeness</span>
                                <span className="text-xs font-bold text-purple-600">{state.validation.column_mapping_summary.mapping_completeness_percent}%</span>
                             </div>
                          </div>
                       </div>

                       <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Zap className="w-3 h-3" /> Merged Dataset
                          </p>
                          <div className="space-y-3">
                             <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-600 font-medium">Total Orders</span>
                                <span className="text-xs font-bold text-slate-900">{state.validation.merged_dataset.total_orders}</span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-600 font-medium">Total Picks</span>
                                <span className="text-xs font-bold text-slate-900">{state.validation.merged_dataset.total_picks}</span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-600 font-medium">Total SKU Items</span>
                                <span className="text-xs font-bold text-slate-900">{state.validation.merged_dataset.total_skus}</span>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                             <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completeness</span>
                                <StatusBadge status={state.validation.data_quality_checks.completeness_check.status} />
                             </div>
                             <p className="text-2xl font-bold text-slate-900">{state.validation.data_quality_checks.completeness_check.score}%</p>
                             <p className="text-[10px] text-slate-500 mt-1">Missing: {state.validation.data_quality_checks.completeness_check.missing_values_percent}%</p>
                          </div>

                          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                             <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type Validation</span>
                                <StatusBadge status={state.validation.data_quality_checks.data_type_validation.status} />
                             </div>
                             <p className="text-2xl font-bold text-slate-900">{state.validation.data_quality_checks.data_type_validation.score}%</p>
                             <p className="text-[10px] text-slate-500 mt-1">Errors: {state.validation.data_quality_checks.data_type_validation.type_errors}</p>
                          </div>

                          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                             <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cross-File Sync</span>
                                <StatusBadge status={state.validation.data_quality_checks.cross_file_consistency.status} />
                             </div>
                             <p className="text-2xl font-bold text-slate-900">{state.validation.data_quality_checks.cross_file_consistency.score}%</p>
                             <p className="text-[10px] text-slate-500 mt-1">Orphaned Picks: {state.validation.data_quality_checks.cross_file_consistency.orphaned_picks}</p>
                          </div>

                          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                             <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date Logic</span>
                                <StatusBadge status={state.validation.data_quality_checks.date_logic_validation.status} />
                             </div>
                             <p className="text-2xl font-bold text-slate-900">{state.validation.data_quality_checks.date_logic_validation.score}%</p>
                             <p className="text-[10px] text-slate-500 mt-1">Logic Violations: {state.validation.data_quality_checks.date_logic_validation.negative_durations}</p>
                          </div>
                       </div>

                       <div className="space-y-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Critical Issues & Recommendations</p>
                          {state.validation.issues_found.map((issue, idx) => (
                            <div key={idx} className={`flex items-start gap-5 p-5 rounded-2xl border transition-all hover:translate-x-1 ${issue.severity === 'CRITICAL' ? 'bg-rose-50 border-rose-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                              <div className={`p-2 rounded-xl shrink-0 ${issue.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                <AlertTriangle className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900">
                                  {issue.file && <span className="text-purple-600 mr-2">[{issue.file}]</span>}
                                  {issue.issue}
                                </p>
                                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">Recommendation: {issue.recommendation}</p>
                              </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {isSuccess && (
                <div className="flex justify-center animate-in zoom-in duration-500 mt-10">
                  <button 
                    onClick={() => setActiveTab('kpi_selection')}
                    className="bg-slate-900 text-white px-12 py-6 rounded-[32px] font-black text-xl shadow-2xl shadow-slate-200 flex items-center gap-6 hover:scale-105 transition-all active:scale-95 group"
                  >
                    <span>SHOULD WE PROCEED TOWARDS BUILDING ITS KPI?</span>
                    <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:translate-x-2 transition-transform">
                      <ChevronRight className="w-6 h-6" />
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'strategic' && state.kpi_engine && (userRole === 'LeanBridge Consultant' || userRole === 'Client Executive') && (
            <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">SI-TI Strategic Dashboard</h2>
                  <p className="text-slate-500 font-medium mt-1">Monthly Executive Performance Overview</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-white border border-slate-200 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Confidence: {state.kpi_engine?.data_confidence_score || 0}%</span>
                    <StatusBadge status={state.kpi_engine?.data_confidence_label || 'MEDIUM'} />
                  </div>
                </div>
              </div>

              {/* Executive Summary Card */}
              <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-12 rounded-[48px] shadow-2xl shadow-purple-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10">
                  <BrainCircuit className="w-64 h-64" />
                </div>
                <div className="relative z-10 max-w-3xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">AI Executive Synthesis</span>
                  </div>
                  <h3 className="text-3xl font-bold leading-tight mb-6">
                    {state.kpi_engine.executive_summary}
                  </h3>
                  <div className="flex gap-4">
                    <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/20 text-[10px] font-bold uppercase tracking-widest">
                      Grounded in {state.kpi_engine.kpis[0]?.volume?.total_orders || 0} Events
                    </div>
                    <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/20 text-[10px] font-bold uppercase tracking-widest">
                      Period: {state.kpi_engine.kpis[0]?.period?.start || 'N/A'} - {state.kpi_engine.kpis[0]?.period?.end || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI Strategic Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {state.kpi_engine?.kpis && state.kpi_engine.kpis.length > 0 ? (
                  state.kpi_engine.kpis
                    .filter(kpi => selectedKPIIds.includes(kpi.metric))
                    .map((kpi, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 p-10 rounded-[40px] shadow-xl shadow-slate-200/50 group hover:border-purple-200 transition-all">
                      <div className="flex justify-between items-start mb-10">
                        <div>
                          <p className="text-purple-600 text-[10px] font-bold uppercase tracking-widest mb-1">{kpi.metric?.replace(/_/g, ' ') || 'METRIC'}</p>
                          <h4 className="text-2xl font-bold text-slate-900">{kpi.display_name}</h4>
                        </div>
                        <StatusBadge status={kpi.status} />
                      </div>
                      
                      <div className="flex items-center justify-between mb-10">
                        <div>
                          <p className="text-6xl font-black text-slate-900 tracking-tighter">
                            {kpi.current_value?.average?.toFixed(1) || '0.0'}<span className="text-xl font-bold text-slate-400 ml-1">{kpi.unit}</span>
                          </p>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Current Monthly Average</p>
                        </div>
                        <div className="text-right">
                          <div className={`flex items-center gap-2 justify-end ${kpi.trend?.monthly_trend?.pattern === 'IMPROVING' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {kpi.trend?.monthly_trend?.pattern === 'IMPROVING' ? <TrendingDown className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
                            <span className="text-3xl font-black tracking-tighter">{kpi.trend?.monthly_trend?.mom_change_percent?.toFixed(1) || '0.0'}%</span>
                          </div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Month-over-Month</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">
                          <span>4-Week Trend Pattern</span>
                          <span className={kpi.trend?.monthly_trend?.pattern === 'IMPROVING' ? 'text-emerald-600' : 'text-rose-600'}>{kpi.trend?.monthly_trend?.pattern || 'STABLE'}</span>
                        </div>
                        <div className="flex items-end gap-3 h-24">
                          {kpi.trend?.monthly_trend?.values.map((val, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                              <div 
                                className={`w-full rounded-t-xl transition-all duration-500 ${i === 3 ? 'bg-purple-600' : 'bg-slate-200 group-hover:bg-slate-300'}`}
                                style={{ height: `${(val / (Math.max(...(kpi.trend?.monthly_trend?.values || [1])) || 1)) * 100}%` }}
                              ></div>
                              <span className="text-[9px] font-bold text-slate-400">W{i+1}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 font-bold">No strategic KPIs available.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'execution' && state.kpi_engine && (userRole === 'LeanBridge Consultant' || userRole === 'Client Manager' || userRole === 'Client Supervisor') && (
            <div className="max-w-6xl mx-auto space-y-12 animate-in slide-in-from-bottom-8 duration-700">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">EI Execution Intelligence</h2>
                  <p className="text-slate-500 font-medium mt-1">Weekly Operational Action Tracker</p>
                </div>
                <div className="flex gap-3">
                  <div className="bg-white border border-slate-200 px-5 py-2.5 rounded-2xl flex items-center gap-3 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Live Engine Active</span>
                  </div>
                </div>
              </div>

              {/* Action Status Tracker */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Proposed', count: state.actions.filter(a => a.status === ActionStatus.PROPOSED).length, color: 'bg-slate-100 text-slate-600' },
                  { label: 'Accepted', count: state.actions.filter(a => a.status === ActionStatus.ACCEPTED).length, color: 'bg-purple-100 text-purple-600' },
                  { label: 'Executed', count: state.actions.filter(a => a.status === ActionStatus.EXECUTED).length, color: 'bg-emerald-100 text-emerald-600' },
                  { label: 'Rejected', count: state.actions.filter(a => a.status === ActionStatus.REJECTED).length, color: 'bg-rose-100 text-rose-600' },
                ].map((group, i) => (
                  <div key={i} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{group.label}</p>
                      <p className="text-3xl font-black text-slate-900">{group.count}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${group.color}`}>
                      {group.label[0]}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Cards Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {state.actions.length > 0 ? (
                  state.actions.map((action, idx) => (
                    <div key={idx} className={`bg-white border border-slate-200 rounded-[40px] p-10 shadow-xl shadow-slate-200/50 relative overflow-hidden transition-all hover:shadow-2xl hover:border-purple-200 ${action.status === ActionStatus.REJECTED ? 'opacity-50' : ''}`}>
                      <div className="flex justify-between items-start mb-8">
                        <div className="flex gap-2">
                          <StatusBadge status={action.priority} />
                          <StatusBadge status={action.status} />
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <Clock className="w-3.5 h-3.5" /> 3 Days Left
                        </div>
                      </div>

                      <h4 className="text-2xl font-bold text-slate-900 mb-4 leading-tight">{action.title}</h4>
                      <p className="text-slate-600 text-sm leading-relaxed mb-8 line-clamp-2">{action.description}</p>

                      <div className="bg-slate-50 rounded-[32px] p-6 mb-8 border border-slate-100">
                        <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Zap className="w-4 h-4" /> Expected Impact
                        </p>
                        <p className="text-sm font-bold text-slate-800 leading-relaxed">{action.expected_impact}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                            <div className="bg-purple-500 h-full" style={{ width: `${action.context.confidence_estimate}%` }}></div>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400">{action.context.confidence_estimate}% Confidence</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                            <User className="w-5 h-5 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assigned Owner</p>
                            <p className="text-xs font-bold text-slate-900">{action.owner_role}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {action.status === ActionStatus.PROPOSED && (
                            <button onClick={() => updateActionStatus(action.action_id, ActionStatus.ACCEPTED)} className="px-6 py-3 bg-purple-600 text-white rounded-2xl text-xs font-bold shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all active:scale-95">
                              Accept
                            </button>
                          )}
                          {action.status === ActionStatus.ACCEPTED && (
                            <button onClick={() => updateActionStatus(action.action_id, ActionStatus.EXECUTED)} className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95">
                              Execute
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="lg:col-span-2 py-24 text-center bg-slate-50 rounded-[48px] border-2 border-dashed border-slate-200">
                    <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-6" />
                    <h5 className="text-xl font-bold text-slate-400">No active operational actions</h5>
                    <p className="text-slate-400 text-sm mt-2">Execute the pipeline to generate intelligence-driven actions.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'kpi_selection' && (
            <div className="max-w-6xl mx-auto space-y-12 animate-in slide-in-from-bottom-8 duration-700 pb-20">
              <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-2xl shadow-slate-200/50">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-200">
                      <Settings2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">KPI Configuration Module</h2>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold uppercase tracking-widest">
                          File Type: {uploadType?.toUpperCase() || 'N/A'}
                        </span>
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                          Client: LeanBridge Global
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setSelectedKPIIds(CANONICAL_KPIS.map(k => k.id))}
                      className="px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Select All
                    </button>
                    <button 
                      onClick={() => setSelectedKPIIds([])}
                      className="px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                    >
                      <X className="w-4 h-4" /> Deselect All
                    </button>
                    <button 
                      onClick={() => setSelectedKPIIds(['KPI_001', 'KPI_002', 'KPI_003', 'KPI_005', 'KPI_007', 'KPI_009', 'KPI_012', 'KPI_013', 'KPI_014'])}
                      className="px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" /> Reset to Default
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 mb-12">
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                    <span className="font-bold text-slate-900">Instructions:</span> Select which KPIs you want to enable for analysis. You can enable/disable KPIs individually based on your operational needs. Enabled KPIs will be calculated and displayed on the dashboard.
                  </p>
                </div>

                <div className="space-y-16">
                  {/* Warehouse Operations KPIs */}
                  <div>
                    <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-4">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Warehouse Operations KPIs</h3>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">(8 KPIs)</span>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                      {CANONICAL_KPIS.filter(k => k.category === 'Warehouse Operations').map((kpi) => (
                        <div 
                          key={kpi.id}
                          onClick={() => {
                            setSelectedKPIIds(prev => 
                              prev.includes(kpi.id) 
                                ? prev.filter(id => id !== kpi.id) 
                                : [...prev, kpi.id]
                            );
                          }}
                          className={`p-8 rounded-[32px] border-2 transition-all cursor-pointer group relative overflow-hidden ${selectedKPIIds.includes(kpi.id) ? 'bg-white border-purple-600 shadow-xl shadow-purple-100' : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'}`}
                        >
                          <div className="flex items-start gap-6">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedKPIIds.includes(kpi.id) ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                              {selectedKPIIds.includes(kpi.id) ? <CheckCircle2 className="w-6 h-6" /> : <div className="w-4 h-4 border-2 border-slate-300 rounded" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-lg font-bold text-slate-900">KPI #{kpi.number}: {kpi.name}</h4>
                                <div className="flex items-center gap-2">
                                  {kpi.frequency.map(f => (
                                    <span key={f} className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <p className="text-sm text-slate-500 mb-4">{kpi.description}</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Formula</p>
                                  <code className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-1 rounded">{kpi.formula}</code>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tables Required</p>
                                  <p className="text-xs text-slate-600 font-medium">{kpi.tables.join(', ')}</p>
                                </div>
                              </div>
                              <div className="mt-4 flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recommendation:</span>
                                <span className="text-[10px] font-bold text-slate-900">{kpi.recommendation}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Inventory Management KPIs */}
                  <div>
                    <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-4">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Inventory Management KPIs</h3>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">(6 KPIs)</span>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                      {CANONICAL_KPIS.filter(k => k.category === 'Inventory Management').map((kpi) => (
                        <div 
                          key={kpi.id}
                          onClick={() => {
                            setSelectedKPIIds(prev => 
                              prev.includes(kpi.id) 
                                ? prev.filter(id => id !== kpi.id) 
                                : [...prev, kpi.id]
                            );
                          }}
                          className={`p-8 rounded-[32px] border-2 transition-all cursor-pointer group relative overflow-hidden ${selectedKPIIds.includes(kpi.id) ? 'bg-white border-purple-600 shadow-xl shadow-purple-100' : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'}`}
                        >
                          <div className="flex items-start gap-6">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedKPIIds.includes(kpi.id) ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                              {selectedKPIIds.includes(kpi.id) ? <CheckCircle2 className="w-6 h-6" /> : <div className="w-4 h-4 border-2 border-slate-300 rounded" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-lg font-bold text-slate-900">KPI #{kpi.number}: {kpi.name}</h4>
                                <div className="flex items-center gap-2">
                                  {kpi.frequency.map(f => (
                                    <span key={f} className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <p className="text-sm text-slate-500 mb-4">{kpi.description}</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Formula</p>
                                  <code className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-1 rounded">{kpi.formula}</code>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tables Required</p>
                                  <p className="text-xs text-slate-600 font-medium">{kpi.tables.join(', ')}</p>
                                </div>
                              </div>
                              <div className="mt-4 flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recommendation:</span>
                                <span className="text-[10px] font-bold text-slate-900">{kpi.recommendation}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-16 pt-10 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold uppercase tracking-widest">
                      Selected: {selectedKPIIds.length} / 14 KPIs
                    </div>
                    {selectedKPIIds.length < 5 && (
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Recommended: Enable at least 5 KPIs
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setActiveTab('upload')}
                      className="px-10 py-5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      disabled={selectedKPIIds.length === 0 || state.isProcessing}
                      onClick={handleCalculateKPIs}
                      className="bg-slate-900 disabled:bg-slate-200 text-white px-12 py-5 rounded-2xl font-bold text-sm shadow-xl shadow-slate-200 flex items-center gap-4 hover:scale-105 transition-all active:scale-95 group"
                    >
                      <span>{state.isProcessing ? 'Calculating...' : 'Save Configuration & Proceed'}</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'main_dashboard' && state.kpi_engine && (
            <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
              {/* SECTION 1: HEADER & SYSTEM STATUS */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Welcome, {userRole}</h1>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-slate-500 font-medium text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Week 09, 2026 (Feb 23 - Mar 01)</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Last Updated: {new Date().toLocaleTimeString()} IST</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-2xl">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">All Systems Operational</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors relative">
                      <Bell className="w-5 h-5 text-slate-600" />
                      <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                    </button>
                    <button className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                      <Settings className="w-5 h-5 text-slate-600" />
                    </button>
                    <button className="px-6 py-3 bg-purple-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all">
                      Generate Report
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 2: EXECUTIVE SUMMARY CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'HEALTHY', count: state.kpi_engine.kpis.filter(k => k.status === 'HEALTHY').length, sub: 'All Good', color: 'emerald', icon: CheckCircle2 },
                  { label: 'WARNING', count: state.kpi_engine.kpis.filter(k => k.status === 'WARNING').length, sub: 'Needs Attention', color: 'amber', icon: AlertCircle },
                  { label: 'CRITICAL', count: state.kpi_engine.kpis.filter(k => k.status === 'CRITICAL').length, sub: 'Immediate Action', color: 'rose', icon: AlertTriangle },
                  { label: 'TREND', count: '+4.2%', sub: 'Monthly Change', color: 'purple', icon: TrendingUp },
                ].map((card, i) => (
                  <div key={i} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all">
                    <div className={`absolute top-0 right-0 w-24 h-24 bg-${card.color}-500/5 blur-[40px] -mr-8 -mt-8`}></div>
                    <div className="flex justify-between items-start mb-6">
                      <div className={`p-3 bg-${card.color}-50 rounded-2xl`}>
                        <card.icon className={`w-6 h-6 text-${card.color}-600`} />
                      </div>
                      <span className={`text-[10px] font-black text-${card.color}-600 uppercase tracking-widest`}>{card.label}</span>
                    </div>
                    <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-1">{card.count}</h3>
                    <p className="text-slate-500 font-medium text-sm">{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* SECTION 3: KPI STATUS GRID (All 14 KPIs) */}
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase tracking-widest">Warehouse Operations KPIs</h2>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">8 Metrics Tracked</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {state.kpi_engine.kpis.slice(0, 8).map((kpi, i) => (
                    <div key={i} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-purple-200 transition-all">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 font-black text-xl group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                          {i + 1}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-lg tracking-tight">{kpi.display_name}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <StatusBadge status={kpi.status} />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                              Threshold: {kpi.thresholds.healthy_max} {kpi.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">
                          {kpi.current_value?.average?.toFixed(1) || '0.0'}{kpi.unit === 'Percentage' ? '%' : kpi.unit === 'Hours' ? 'h' : ''}
                        </p>
                        <div className={`flex items-center justify-end gap-1 font-bold text-xs mt-1 ${kpi.trend.direction === 'IMPROVING' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {kpi.trend.direction === 'IMPROVING' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                          <span>{Math.abs(kpi.trend.change_percent || 0).toFixed(1)}% WoW</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-10">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase tracking-widest">Inventory Management KPIs</h2>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">6 Metrics Tracked</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {state.kpi_engine.kpis.slice(8, 14).map((kpi, i) => (
                    <div key={i} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-purple-200 transition-all">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 font-black text-xl group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                          {i + 9}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-lg tracking-tight">{kpi.display_name}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <StatusBadge status={kpi.status} />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                              Threshold: {kpi.thresholds.healthy_max} {kpi.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">
                          {kpi.current_value?.average?.toFixed(1) || '0.0'}{kpi.unit === 'Percentage' ? '%' : ''}
                        </p>
                        <div className={`flex items-center justify-end gap-1 font-bold text-xs mt-1 ${kpi.trend.direction === 'IMPROVING' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {kpi.trend.direction === 'IMPROVING' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                          <span>{Math.abs(kpi.trend.change_percent || 0).toFixed(1)}% MoM</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 4: CRITICAL ALERTS & ISSUES (Top 3) */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase tracking-widest flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-rose-500" /> Issues Requiring Immediate Attention
                  </h2>
                  {state.kpi_engine.kpis.filter(k => k.status === 'CRITICAL').length > 3 && (
                    <button className="text-xs font-bold text-purple-600 uppercase tracking-widest hover:underline">View All Alerts</button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {state.kpi_engine.kpis.filter(k => k.status === 'CRITICAL').slice(0, 3).length > 0 ? (
                    state.kpi_engine.kpis.filter(k => k.status === 'CRITICAL').slice(0, 3).map((kpi, i) => (
                      <div key={i} className="bg-white border-2 border-rose-100 rounded-[40px] p-10 shadow-xl shadow-rose-500/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 blur-[80px] -mr-32 -mt-32"></div>
                        <div className="flex flex-col lg:flex-row gap-10 relative z-10">
                          <div className="lg:w-1/3 space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white font-black">
                                {i + 1}
                              </div>
                              <span className="text-xs font-black text-rose-600 uppercase tracking-widest">Critical Alert</span>
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                              {kpi.display_name} - Threshold Breach Detected
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Value</p>
                                <p className="text-xl font-black text-slate-900">{kpi.current_value?.average?.toFixed(1) || '0.0'}{kpi.unit === 'Percentage' ? '%' : ''}</p>
                              </div>
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Threshold</p>
                                <p className="text-xl font-black text-slate-900">{kpi.thresholds.healthy_max}{kpi.unit === 'Percentage' ? '%' : ''}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Root Cause Analysis (SI-TI)</p>
                                <p className="text-slate-600 font-medium leading-relaxed italic">
                                  "Historical patterns suggest this breach is correlated with {kpi.category === 'Volume' ? 'unplanned promotional spikes' : 'labor shortages in Zone B'}. Reappearance tracking shows this is the 3rd occurrence in 12 weeks."
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Actionable Recommendation</p>
                                <p className="text-slate-900 font-bold leading-relaxed">
                                  {kpi.next_step_hint || 'Redistribute workload from Zone B to Zone A and initiate temporary labor request for next shift.'}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-slate-100">
                              <button className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all">View KPI Details</button>
                              <button onClick={() => setActiveTab('actions')} className="px-8 py-4 bg-purple-600 text-white rounded-2xl font-bold text-sm hover:bg-purple-700 transition-all shadow-lg shadow-purple-200">View Actions</button>
                              <button className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all">Acknowledge Alert</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-emerald-50 border-2 border-emerald-100 rounded-[40px] p-12 text-center">
                      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <h3 className="text-2xl font-black text-emerald-900 tracking-tight mb-2">No Critical Issues</h3>
                      <p className="text-emerald-700 font-medium max-w-md mx-auto">All KPIs are within acceptable ranges or in warning zone only. Continue monitoring weekly execution progress.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 5: WEEKLY TREND COMPARISON (Last 4 Weeks) */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase tracking-widest flex items-center gap-3">
                    <History className="w-6 h-6 text-purple-600" /> KPI Performance Trends (Last 4 Weeks)
                  </h2>
                  <div className="flex items-center gap-3">
                    <button className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                      <Download className="w-4 h-4 text-slate-600" />
                    </button>
                    <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                      Compare Custom Periods
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">KPI Name</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">W-3</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">W-2</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">W-1</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">W-0 (Current)</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {state.kpi_engine.kpis.slice(0, 6).map((kpi, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-6">
                            <p className="font-bold text-slate-900">{kpi.display_name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{kpi.unit}</p>
                          </td>
                          <td className="px-8 py-6 font-medium text-slate-500">{(kpi.current_value?.average || 0 * 0.9).toFixed(1)}</td>
                          <td className="px-8 py-6 font-medium text-slate-500">{(kpi.current_value?.average || 0 * 1.1).toFixed(1)}</td>
                          <td className="px-8 py-6 font-medium text-slate-500">{(kpi.current_value?.average || 0 * 0.95).toFixed(1)}</td>
                          <td className="px-8 py-6">
                            <span className={`font-black text-lg ${kpi.status === 'CRITICAL' ? 'text-rose-600' : kpi.status === 'WARNING' ? 'text-amber-600' : 'text-slate-900'}`}>
                              {kpi.current_value?.average?.toFixed(1) || '0.0'}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <div className={`flex items-center gap-2 font-bold text-sm ${kpi.trend.direction === 'IMPROVING' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {kpi.trend.direction === 'IMPROVING' ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                              <span>{Math.abs(kpi.trend.change_percent || 0).toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-6 bg-slate-50 border-t border-slate-200 text-center">
                    <button className="text-xs font-bold text-purple-600 uppercase tracking-widest hover:underline flex items-center gap-2 mx-auto">
                      <BarChart3 className="w-4 h-4" /> View Detailed Charts
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 6: ACTION STATUS OVERVIEW */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase tracking-widest">Action Status Overview</h2>
                    <button onClick={() => setActiveTab('actions')} className="text-xs font-bold text-purple-600 uppercase tracking-widest hover:underline">Manage Actions</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                      { label: 'Proposed', count: state.actions.filter(a => a.status === 'PROPOSED').length, color: 'slate' },
                      { label: 'Accepted', count: state.actions.filter(a => a.status === 'ACCEPTED').length, color: 'purple' },
                      { label: 'WIP', count: state.actions.filter(a => a.status === 'WIP').length, color: 'amber' },
                      { label: 'Completed', count: state.actions.filter(a => a.status === 'COMPLETED').length, color: 'emerald' },
                    ].map((stat, i) => (
                      <div key={i} className={`p-6 bg-${stat.color}-50 rounded-3xl border border-${stat.color}-100`}>
                        <p className={`text-[10px] font-black text-${stat.color}-600 uppercase tracking-widest mb-2`}>{stat.label}</p>
                        <p className="text-3xl font-black text-slate-900">{stat.count}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-10 pt-10 border-t border-slate-100 flex flex-wrap gap-10">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Acceptance Rate</p>
                      <div className="flex items-end gap-2">
                        <span className="text-2xl font-black text-slate-900">
                          {state.actions.length > 0 ? ((state.actions.filter(a => a.status !== 'PROPOSED').length / state.actions.length) * 100).toFixed(0) : 0}%
                        </span>
                        <span className="text-xs font-bold text-emerald-600 mb-1">+5% vs LW</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Reappearance Rate</p>
                      <div className="flex items-end gap-2">
                        <span className="text-2xl font-black text-slate-900">12%</span>
                        <span className="text-xs font-bold text-rose-600 mb-1">+2% vs LW</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Avg. Resolution Time</p>
                      <div className="flex items-end gap-2">
                        <span className="text-2xl font-black text-slate-900">4.2 Days</span>
                        <span className="text-xs font-bold text-emerald-600 mb-1">-0.5d vs LW</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 p-10 rounded-[40px] text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] -mr-32 -mt-32"></div>
                  <h2 className="text-xl font-black uppercase tracking-widest mb-8 relative z-10">Action Lifecycle</h2>
                  <div className="space-y-8 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-[10px] font-black">1</div>
                      <div>
                        <p className="text-xs font-bold text-purple-300 uppercase tracking-widest">Proposed</p>
                        <p className="text-sm font-medium text-slate-400">AI identifies bottleneck and suggests fix</p>
                      </div>
                    </div>
                    <div className="w-px h-6 bg-slate-800 ml-4"></div>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black">2</div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Accepted</p>
                        <p className="text-sm font-medium text-slate-400">Manager reviews and approves action</p>
                      </div>
                    </div>
                    <div className="w-px h-6 bg-slate-800 ml-4"></div>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black">3</div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Execution</p>
                        <p className="text-sm font-medium text-slate-400">WIP tracking and completion verification</p>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('actions')} className="w-full mt-10 py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl font-bold text-sm transition-all">
                    View Full Lifecycle
                  </button>
                </div>
              </div>

              {/* SECTION 7 & 8: ENGINE STATUS & SYSTEM INFO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm">
                  <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase tracking-widest mb-8 flex items-center gap-3">
                    <Cpu className="w-5 h-5 text-purple-600" /> Engine Status
                  </h2>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          <Zap className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">EI Execution Engine</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Weekly Cycle</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">Active</span>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">Last Run: 2h ago</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          <BrainCircuit className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">SI-TI Strategic Engine</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monthly Cycle</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">Active</span>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">Last Run: 4d ago</p>
                      </div>
                    </div>
                    <div className="pt-4 flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-500">Rule-Book Version</p>
                      <p className="text-xs font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">v2.4.0-stable</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm">
                  <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase tracking-widest mb-8 flex items-center gap-3">
                    <Layers className="w-5 h-5 text-slate-600" /> System Information
                  </h2>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tenant ID</p>
                        <p className="font-bold text-slate-900">DEMO-TENANT-001</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Environment</p>
                        <p className="font-bold text-slate-900 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Production
                        </p>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Platform Version</p>
                        <p className="font-bold text-slate-900">LeanBridge OI™ v1.2.5</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data Region</p>
                        <p className="font-bold text-slate-900">Asia-Southeast1</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-10 pt-10 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-slate-600" />
                      </div>
                      <span className="text-xs font-bold text-slate-600">SOC2 Type II Compliant</span>
                    </div>
                    <button className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">System Logs</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (userRole === 'LeanBridge Consultant' || userRole === 'Client Manager' || userRole === 'Client Supervisor') && (
            <div className="space-y-12 animate-in fade-in duration-700 max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {uploadType === 'weekly' ? 'Weekly Execution Dashboard' : 'Monthly Strategic Dashboard'}
                </h2>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setActiveTab('kpi_selection')}
                    className="bg-white border border-slate-200 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-sm hover:bg-slate-50 transition-all font-bold text-slate-600 text-xs"
                  >
                    <Settings2 className="w-4 h-4" />
                    <span>Modify Selection</span>
                  </button>
                  <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Validation Status</span>
                    <StatusBadge status={state.validation?.overall_status || 'GREEN'} />
                  </div>
                  <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
                    <LeanBridgeLogoIcon />
                  </div>
                </div>
              </div>
              {!state.kpi_engine ? (
                <div className="py-32 text-center bg-white border border-slate-200 rounded-[50px] shadow-xl shadow-slate-200/50">
                  <Activity className="w-20 h-20 text-slate-200 mx-auto mb-8" />
                  <h3 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Intelligence Pipeline Idle</h3>
                  <p className="text-slate-500 text-lg max-w-md mx-auto font-medium">Please upload and validate your warehouse data to generate operational KPIs.</p>
                </div>
              ) : (
                <>
                  {/* Header / Summary Bar */}
                  <div className="bg-purple-600 text-white rounded-[40px] p-10 flex flex-wrap items-center justify-between shadow-xl shadow-purple-200 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[80px] -mr-32 -mt-32"></div>
                 <div className="flex items-center gap-8 relative z-10">
                    <div>
                       <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Overall Status</p>
                       <div className="flex items-center gap-2">
                          <StatusBadge status={state.kpi_engine?.status || 'HEALTHY'} />
                       </div>
                    </div>
                    <div className="h-10 w-px bg-white/20"></div>
                    <div>
                       <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Confidence</p>
                       <div className="flex items-center gap-2">
                          <StatusBadge status={state.kpi_engine?.data_confidence_label || 'MEDIUM'} />
                          <span className="text-sm font-bold">{state.kpi_engine?.data_confidence_score || 0}%</span>
                       </div>
                    </div>
                    <div className="h-10 w-px bg-white/20"></div>
                    <div>
                       <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">KPIs Tracked</p>
                       <p className="text-sm font-bold">{selectedKPIIds.length} Metrics Selected</p>
                    </div>
                 </div>
                 <div className="flex gap-4 relative z-10">
                    <button className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-2xl border border-white/20 flex items-center gap-2 transition-all">
                       <Download className="w-4 h-4" /> Export Report
                    </button>
                 </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {state.kpi_engine.kpis && state.kpi_engine.kpis.length > 0 ? (
                  state.kpi_engine.kpis
                    .filter(kpi => selectedKPIIds.includes(kpi.metric))
                    .map((kpi, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedKPI(kpi)}
                      className="bg-white border border-slate-200 p-8 rounded-[32px] shadow-sm hover:shadow-xl hover:border-purple-200 transition-all group cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-purple-50 transition-colors">
                          <Activity className="w-5 h-5 text-purple-600" />
                        </div>
                        <StatusBadge status={kpi.status} />
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{kpi.metric?.replace(/_/g, ' ') || 'METRIC'}</p>
                      <h4 className="text-lg font-bold text-slate-900 mb-4">{kpi.display_name}</h4>
                      <div className="flex items-end gap-2 mb-6">
                        <span className="text-3xl font-black text-slate-900 tracking-tighter">{kpi.current_value?.average?.toFixed(1) || '0.0'}</span>
                        <span className="text-xs font-bold text-slate-400 mb-1">{kpi.unit}</span>
                      </div>
                      <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                        <div className={`flex items-center gap-1 text-[10px] font-bold ${kpi.trend?.direction === 'DECREASING' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {kpi.trend?.direction === 'DECREASING' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                          {kpi.trend?.change_percent?.toFixed(1) || '0.0'}%
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">vs Prev Week</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 font-bold">No KPIs generated for this dataset.</p>
                  </div>
                )}
                {state.kpi_engine.kpis.filter(kpi => selectedKPIIds.includes(kpi.metric)).length === 0 && (
                   <div className="col-span-full py-20 text-center bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 font-bold">No KPIs selected for display.</p>
                    <button onClick={() => setActiveTab('kpi_selection')} className="text-purple-600 font-bold hover:underline mt-2">Select KPIs</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

          {activeTab === 'actions' && (userRole === 'LeanBridge Consultant' || userRole === 'Client Manager' || userRole === 'Client Supervisor') && (
            <div className="max-w-6xl mx-auto space-y-10 animate-in slide-in-from-right-8 duration-500">
              <div className="mb-4">
                <h3 className="text-3xl font-bold text-slate-900 tracking-tight">LeanBridge Action Center</h3>
                <p className="text-slate-500 text-lg mt-1 font-medium italic">Validated corrective pathways synthesized by Module 3.</p>
              </div>
              
              {state.actions.map((action, idx) => (
                <div key={idx} className={`bg-white border border-slate-200 rounded-[40px] overflow-hidden transition-all duration-300 shadow-xl shadow-slate-200/50 ${action.status === ActionStatus.REJECTED ? 'opacity-40 grayscale scale-[0.98]' : 'hover:shadow-2xl hover:border-purple-200 hover:shadow-purple-50'}`}>
                  <div className="p-12 flex flex-col lg:flex-row gap-16">
                    <div className="lg:w-1/4 space-y-8 shrink-0">
                      <div className="flex gap-2"><StatusBadge status={action.priority} /><StatusBadge status={action.status} /></div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 px-1">Assignment Domain</p>
                        <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                          <User className="w-5 h-5 text-purple-600" />
                          <span className="text-sm font-bold text-slate-900 uppercase tracking-tighter">{action.owner_role}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 space-y-10">
                       <h4 className="text-3xl font-bold text-slate-900 tracking-tight leading-tight">{action.title}</h4>
                       <p className="text-slate-600 leading-relaxed text-lg font-medium">{action.description}</p>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="bg-purple-50/50 border border-purple-100 p-8 rounded-[32px]">
                             <div className="flex items-center gap-3 mb-4 text-purple-600 uppercase font-bold text-[11px] tracking-widest"><TrendingUp className="w-5 h-5" /> Expected Outcome</div>
                             <p className="text-base font-bold text-slate-800 leading-relaxed">{action.expected_impact}</p>
                             <div className="mt-4 flex items-center gap-3">
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Confidence</span>
                               <div className="flex-1 h-1.5 bg-purple-100 rounded-full overflow-hidden">
                                 <div className="bg-purple-500 h-full" style={{ width: `${action.confidence?.score || 0}%` }}></div>
                               </div>
                               <span className="text-[10px] font-bold text-purple-600">{action.confidence?.score || 0}%</span>
                             </div>
                          </div>
                          <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                             <div className="flex items-center gap-3 mb-4 text-slate-500 uppercase font-bold text-[11px] tracking-widest"><Lightbulb className="w-5 h-5 text-purple-400" /> Operational Context</div>
                             <div className="space-y-2">
                               <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                 <span>KPI: {action.context.kpi_name}</span>
                                 <span>Breach: {action.context.breach_percent.toFixed(1)}%</span>
                               </div>
                               <p className="text-xs text-slate-500 leading-relaxed font-semibold italic">"Calculated breach of {action.context.breach_absolute.toFixed(2)} units against threshold of {action.context.threshold}. Target reduction: {action.context.target_reduction}."</p>
                             </div>
                          </div>
                       </div>
                    </div>
                    <div className="lg:w-64 flex lg:flex-col gap-4 justify-center">
                       {action.status === ActionStatus.PROPOSED && (
                         <>
                           <button onClick={() => updateActionStatus(action.action_id, ActionStatus.ACCEPTED)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 rounded-3xl shadow-xl shadow-purple-200 transition-all active:scale-95 text-base">Approve Action</button>
                           <button onClick={() => {const r = prompt("Enter rejection reason:"); if(r) updateActionStatus(action.action_id, ActionStatus.REJECTED, r)}} className="bg-white hover:bg-slate-50 text-slate-500 font-bold py-6 rounded-3xl border border-slate-200 transition-all text-base">Ignore</button>
                         </>
                       )}
                       {action.status === ActionStatus.ACCEPTED && <button onClick={() => updateActionStatus(action.action_id, ActionStatus.EXECUTED)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 rounded-3xl shadow-xl shadow-emerald-100 transition-all text-base">Mark Executed</button>}
                       {action.status === ActionStatus.EXECUTED && <div className="text-center py-6 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-600 text-[11px] font-bold uppercase tracking-widest">Workflow Verified</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tuning' && (
            <div className="max-w-5xl mx-auto space-y-12 animate-in zoom-in duration-500">
               <div className="bg-white border border-slate-200 p-16 rounded-[50px] shadow-2xl shadow-slate-200/50 relative overflow-hidden text-center">
                  <div className="absolute -top-10 -right-10 p-16 opacity-[0.03] text-purple-600"><LeanBridgeLogo /></div>
                  <h3 className="text-4xl font-bold text-slate-900 mb-6 tracking-tight">LeanBridge Tuner</h3>
                  <p className="text-slate-500 text-xl mb-12 max-w-2xl mx-auto leading-relaxed font-medium">Analyzing patterns in manager feedback to auto-optimize operational thresholds and rules.</p>
                  <button onClick={handleAnalyzeFeedback} disabled={state.isProcessing || state.actions.filter(a => a.status !== ActionStatus.PROPOSED).length === 0} className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold px-16 py-7 rounded-[32px] shadow-2xl shadow-purple-200 flex items-center gap-5 mx-auto transition-all active:scale-95">
                    <BrainCircuit className="w-7 h-7" /> INITIATE SYSTEM SYNTHESIS
                  </button>
               </div>

               {state.feedback && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-in slide-in-from-bottom-10 duration-700">
                     <div className="bg-white border border-slate-200 p-12 rounded-[40px] space-y-10 shadow-xl shadow-slate-200/50">
                        <h4 className="text-[11px] font-bold text-purple-600 uppercase tracking-[0.2em] flex items-center gap-4"><TrendingUp className="w-5 h-5" /> Decision Archetypes</h4>
                        <div className="space-y-8">
                           {state.feedback.patterns_detected.map((p, i) => (
                              <div key={i} className="flex gap-6 items-start">
                                 <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 shadow-sm border border-purple-100">{i+1}</div>
                                 <p className="text-slate-700 font-bold text-lg leading-relaxed">{p}</p>
                              </div>
                           ))}
                        </div>
                     </div>
                     <div className="bg-white border border-slate-200 p-12 rounded-[40px] space-y-10 shadow-xl shadow-slate-200/50">
                        <h4 className="text-[11px] font-bold text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-4"><ShieldCheck className="w-5 h-5" /> System Threshold Proposals</h4>
                        <div className="space-y-8">
                           {state.feedback.rule_tuning_suggestions.map((s, i) => (
                              <div key={i} className="flex gap-6 items-start">
                                 <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 shadow-sm border border-emerald-100"><ArrowUpRight className="w-5 h-5" /></div>
                                 <p className="text-slate-700 font-bold text-lg leading-relaxed">{s}</p>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               )}
            </div>
          )}

          {activeTab === 'architecture' && (
            <div className="max-w-6xl mx-auto space-y-16 animate-in fade-in duration-700">
              <div className="mb-12">
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter">LeanBridge OI™ Architecture</h2>
                <p className="text-slate-500 text-xl font-medium mt-2">Dual-Engine Intelligence Framework v1.0</p>
              </div>

              {/* ENGINE COORDINATION MODEL */}
              <div className="bg-white border border-slate-200 rounded-[50px] p-12 shadow-2xl shadow-slate-200/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 text-purple-600">
                  <Network className="w-64 h-64" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-slate-900 mb-12 flex items-center gap-4">
                    <div className="p-3 bg-purple-600 rounded-2xl text-white shadow-lg shadow-purple-200">
                      <Layers className="w-6 h-6" />
                    </div>
                    Engine Coordination Model
                  </h3>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-[40px] p-16">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-20 relative">
                      {/* Connector Lines (Visual Only) */}
                      <div className="absolute inset-0 hidden md:flex items-center justify-center pointer-events-none">
                        <div className="w-px h-full bg-slate-200"></div>
                      </div>

                      {/* Engine A */}
                      <div className="space-y-8">
                        <div className="bg-white border-2 border-purple-200 rounded-[32px] p-10 shadow-xl shadow-purple-50 relative">
                          <div className="absolute -top-4 left-10 bg-purple-600 text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Engine A</div>
                          <h4 className="text-xl font-black text-slate-900 mb-6">MONTHLY SI-TI ENGINE</h4>
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                              <p className="text-sm font-bold text-slate-600"><span className="text-slate-400 font-medium">Purpose:</span> Long-term orientation</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                              <p className="text-sm font-bold text-slate-600"><span className="text-slate-400 font-medium">Frequency:</span> Monthly</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                              <p className="text-sm font-bold text-slate-600"><span className="text-slate-400 font-medium">Actions:</span> NO</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-center text-slate-300">
                          <ArrowDown className="w-10 h-10" />
                        </div>
                        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Insights inform strategic view</p>
                      </div>

                      {/* Engine B */}
                      <div className="space-y-8">
                        <div className="bg-white border-2 border-indigo-200 rounded-[32px] p-10 shadow-xl shadow-indigo-50 relative">
                          <div className="absolute -top-4 left-10 bg-indigo-600 text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Engine B</div>
                          <h4 className="text-xl font-black text-slate-900 mb-6">WEEKLY EI ENGINE</h4>
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                              <p className="text-sm font-bold text-slate-600"><span className="text-slate-400 font-medium">Purpose:</span> Immediate execution</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                              <p className="text-sm font-bold text-slate-600"><span className="text-slate-400 font-medium">Frequency:</span> Weekly</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                              <p className="text-sm font-bold text-slate-600"><span className="text-slate-400 font-medium">Actions:</span> YES (Top N)</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-center text-slate-300">
                          <ArrowDown className="w-10 h-10" />
                        </div>
                        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions executed and tracked</p>
                      </div>
                    </div>

                    <div className="mt-16 flex flex-col items-center">
                      <div className="bg-slate-900 text-white rounded-[32px] px-20 py-10 shadow-2xl border border-white/10 text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <h4 className="text-2xl font-black tracking-[0.2em] mb-2 relative z-10">RULE BOOK</h4>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.4em] relative z-10">Control Layer Protocol</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ENGINE A DETAILS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="bg-white border border-slate-200 rounded-[50px] p-12 shadow-xl shadow-slate-200/50 space-y-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-slate-900">Engine A: SI-TI</h4>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Monthly Orientation Engine</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Input Specification</h5>
                    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">Input Type</span>
                        <span className="text-xs font-black text-slate-900">Aggregated Monthly Summary</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">Canonical Table</span>
                        <code className="text-[10px] bg-white px-2 py-1 rounded border border-slate-200 font-mono text-purple-600">monthlykpisummary</code>
                      </div>
                      <div className="pt-4 space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Required Fields (Pre-Aggregated):</p>
                        <div className="flex flex-wrap gap-2">
                          {['monthyear', 'totalorders', 'totalunits', 'totalworkhours', 'totallaborcost', 'avgleadtime', 'totalcogs'].map(f => (
                            <span key={f} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold text-slate-600">{f}</span>
                          ))}
                          <span className="text-[9px] font-bold text-slate-400">+ 13 more</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Output Specification</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 bg-purple-50 rounded-2xl border border-purple-100">
                        <h6 className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-2">KPI Computation</h6>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">14 Canonical KPIs with MoM trend analysis.</p>
                      </div>
                      <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <h6 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2">AI Insights</h6>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">Strategic (SI) + Tactical (TI) root cause synthesis.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Characteristics</h5>
                    <ul className="space-y-3">
                      {[
                        'Aggregated Data Only (No raw transactions)',
                        'No Contributor Analysis (No SKU/Picker drill-down)',
                        'No Action Generation (Orientation only)',
                        'AI Insights Only (Trend & Pattern focus)'
                      ].map((c, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-600">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* ENGINE B DETAILS */}
                <div className="bg-white border border-slate-200 rounded-[50px] p-12 shadow-xl shadow-slate-200/50 space-y-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-slate-900">Engine B: EI</h4>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Execution Intelligence Engine</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Input Specification</h5>
                    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">Input Type</span>
                        <span className="text-xs font-black text-slate-900">Raw Transactional Multi-Sheet</span>
                      </div>
                      <div className="pt-4 space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Required Sheets (Raw Data):</p>
                        <div className="grid grid-cols-2 gap-2">
                          {['Orders', 'Claims', 'Labor', 'InventorySnapshot', 'Inbound', 'CycleCount'].map(s => (
                            <div key={s} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl">
                              <FileText className="w-3 h-3 text-indigo-400" />
                              <span className="text-[10px] font-bold text-slate-600">{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Output Specification</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <h6 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Action Generation</h6>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">Top N executable actions with priority & ownership.</p>
                      </div>
                      <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100">
                        <h6 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Contributor Analysis</h6>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">Granular drill-down to SKU, Picker, and Zone level.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Characteristics</h5>
                    <ul className="space-y-3">
                      {[
                        'Raw Transactional Data (Every order/claim)',
                        'Granular Analysis (SKU/Picker/Zone level)',
                        'Weekly Execution Focus (7-day window)',
                        'Multi-Table KPI Computation'
                      ].map((c, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-600">
                          <CheckCircle2 className="w-4 h-4 text-indigo-500" /> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* DATA FLOW SECTION */}
              <div className="bg-slate-900 rounded-[50px] p-16 text-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(147,51,234,0.1),transparent)] pointer-events-none"></div>
                <div className="relative z-10">
                  <h3 className="text-3xl font-black tracking-tighter mb-12 text-center">System Data Flow</h3>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    {[
                      { step: 1, label: 'Upload', desc: 'Client provides Excel data' },
                      { step: 2, label: 'Ingest', desc: 'Agent extracts to canonical tables' },
                      { step: 3, label: 'Analyze', desc: 'SI-TI & EI Engines process data' },
                      { step: 4, label: 'Synthesize', desc: 'Rule Book applies control layer' },
                      { step: 5, label: 'Display', desc: 'Dashboard & Reports generated' },
                    ].map((s, i) => (
                      <React.Fragment key={i}>
                        <div className="flex flex-col items-center text-center space-y-4 flex-1">
                          <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center font-black text-lg shadow-lg shadow-purple-500/20">{s.step}</div>
                          <div>
                            <p className="text-sm font-black uppercase tracking-widest mb-1">{s.label}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{s.desc}</p>
                          </div>
                        </div>
                        {i < 4 && <div className="hidden md:block text-slate-700"><ChevronRight className="w-6 h-6" /></div>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'chat' && (
             <div className="max-w-5xl mx-auto h-[800px] flex flex-col bg-white border border-slate-200 rounded-[50px] overflow-hidden shadow-2xl shadow-slate-200/50 animate-in fade-in duration-500">
                <div className="p-12 border-b border-slate-100 bg-slate-50 flex items-center gap-10">
                   <div className="w-20 h-20 bg-purple-600 rounded-[32px] flex items-center justify-center shadow-xl shadow-purple-200 shrink-0"><BrainCircuit className="w-12 h-12 text-white" /></div>
                   <div>
                      <h3 className="text-3xl font-bold text-slate-900 tracking-tight">Validated Oracle</h3>
                      <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-1">LeanBridge Knowledge Protocol v5</p>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-12 space-y-12 scroll-smooth bg-white">
                   {!chatResponse && !isChatLoading && (
                      <div className="text-center py-20 opacity-30 flex flex-col items-center">
                        <MessageSquare className="w-20 h-20 mb-8 text-purple-400" />
                        <h4 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Awaiting Operational Inquiry</h4>
                        <p className="text-slate-500 max-w-sm text-lg font-medium">Ask questions about ingestion metrics, historical breaches, or predicted impacts.</p>
                      </div>
                   )}

                   {isChatLoading && <div className="flex gap-10 animate-pulse"><div className="w-14 h-14 rounded-2xl bg-slate-100 shrink-0"></div><div className="space-y-5 flex-1"><div className="h-5 bg-slate-100 rounded-[10px] w-3/4"></div><div className="h-5 bg-slate-100 rounded-[10px] w-1/2"></div></div></div>}

                   {chatResponse && (
                      <div className="space-y-16 animate-in slide-in-from-top-4 duration-500">
                         <div className="flex justify-end"><div className="bg-purple-600 text-white px-10 py-6 rounded-[40px] rounded-tr-none font-bold text-lg shadow-xl shadow-purple-100">{chatQuestion}</div></div>
                         <div className="flex gap-10">
                            <div className="w-16 h-16 rounded-[24px] bg-purple-100 flex items-center justify-center shadow-sm shrink-0 border border-purple-200"><Zap className="w-8 h-8 text-purple-600" /></div>
                            <div className="flex-1 space-y-10">
                               <div className="bg-slate-50 border border-slate-200 p-12 rounded-[50px] rounded-tl-none shadow-inner leading-relaxed text-slate-800 font-semibold text-lg whitespace-pre-wrap">{chatResponse.explanation}</div>
                               <div className="flex flex-wrap gap-5 items-center px-6">
                                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mr-2">Grounded In:</span>
                                  {chatResponse.sources.map((s: string, i: number) => <span key={i} className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[11px] font-bold text-purple-600 shadow-sm">{s}</span>)}
                                  <span className="ml-auto text-[11px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 animate-pulse">{chatResponse.confidence}% Grounded</span>
                               </div>
                            </div>
                         </div>
                      </div>
                   )}
                </div>

                <div className="p-12 bg-slate-50 border-t border-slate-200">
                   <div className="relative group flex items-center">
                      <input type="text" value={chatQuestion} onChange={(e) => setChatQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAskAI()} placeholder="Consult Module 5 on operational vectors..." className="w-full bg-white border border-slate-200 rounded-[40px] py-8 pl-10 pr-28 text-slate-900 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 shadow-lg transition-all font-bold text-lg placeholder:text-slate-300" />
                      <button onClick={handleAskAI} disabled={!chatQuestion.trim() || isChatLoading} className="absolute right-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 w-20 h-20 rounded-[32px] flex items-center justify-center text-white transition-all shadow-xl shadow-purple-200 active:scale-90"><Send className="w-8 h-8" /></button>
                   </div>
                </div>
             </div>
          )}
          {activeTab === 'config' && state.kpi_config && (
            <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">KPI Configuration Display</h2>
                  <p className="text-slate-500 font-medium mt-1">LeanBridge OI™ Canonical Schema View</p>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(state.kpi_config, null, 2));
                    alert('Configuration JSON copied to clipboard');
                  }}
                  className="bg-white border border-slate-200 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-sm hover:bg-slate-50 transition-all font-bold text-slate-600"
                >
                  <Download className="w-5 h-5" />
                  <span>Copy JSON</span>
                </button>
              </div>

              <div className="bg-slate-900 rounded-[48px] p-12 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-12 opacity-10 text-white">
                  <Settings2 className="w-64 h-64" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                      <FileText className="w-6 h-6 text-purple-400" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.4em] text-slate-400">System Output Protocol</span>
                  </div>
                  
                  <div className="bg-black/40 rounded-[32px] p-8 border border-white/10 font-mono text-sm text-emerald-400 overflow-x-auto max-h-[800px] scrollbar-thin scrollbar-thumb-white/10">
                    <pre>{JSON.stringify(state.kpi_config, null, 2)}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {selectedKPI && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedKPI(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            />
            <KPIDetailPanel kpi={selectedKPI} onClose={() => setSelectedKPI(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- KPI Detail Panel Component ---
const KPIDetailPanel = ({ kpi, onClose }: { kpi: OrderCycleTimeKPI, onClose: () => void }) => {
  const chartData = kpi.trend?.monthly_trend?.values.map((val, i) => ({
    week: `W${i + 1}`,
    value: val
  })) || [];

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed top-0 right-0 h-full w-full md:w-[500px] bg-white shadow-2xl z-50 overflow-y-auto border-l border-slate-200"
    >
      <div className="p-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-2xl">
            <Activity className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">{kpi.display_name}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{kpi.metric.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      <div className="p-8 space-y-10">
        {/* Status & Main Metric */}
        <div className="flex items-center justify-between bg-slate-50 p-6 rounded-[32px] border border-slate-100">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Value</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-slate-900 tracking-tighter">{kpi.current_value?.average?.toFixed(2) || '0.00'}</span>
              <span className="text-sm font-bold text-slate-400 mb-1">{kpi.unit}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Health Status</p>
            <StatusBadge status={kpi.status} />
          </div>
        </div>

        {/* Trend Chart */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" /> 4-Week Trend
            </h4>
            <div className={`text-xs font-bold ${kpi.trend.direction === 'DECREASING' ? 'text-emerald-500' : 'text-rose-500'}`}>
              {kpi.trend.direction === 'DECREASING' ? 'Improving' : 'Degrading'} ({kpi.trend.change_percent?.toFixed(1)}%)
            </div>
          </div>
          <div className="h-64 w-full bg-slate-50 rounded-[32px] p-6 border border-slate-100">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="week" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  hide 
                  domain={['auto', 'auto']}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontWeight: 'bold'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#9333ea" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operator View / Why it matters */}
        <div className="bg-purple-600 text-white p-8 rounded-[40px] shadow-xl shadow-purple-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Lightbulb className="w-24 h-24" />
          </div>
          <div className="relative z-10 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">Operational Context</h4>
            <p className="text-xl font-bold leading-tight">{kpi.operator_view.why_it_matters}</p>
            <div className="pt-4 flex flex-wrap gap-2">
              {kpi.operator_view.who_should_care.map((role, i) => (
                <span key={i} className="px-3 py-1 bg-white/20 rounded-lg text-[10px] font-bold uppercase tracking-widest">{role}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Thresholds */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-600" /> Threshold Reference
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Healthy</p>
              <p className="text-sm font-black text-emerald-700">≤{kpi.thresholds.healthy_max}</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-center">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Warning</p>
              <p className="text-sm font-black text-amber-700">≤{kpi.thresholds.warning_max}</p>
            </div>
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 text-center">
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Critical</p>
              <p className="text-sm font-black text-rose-700">&gt;{kpi.thresholds.critical_above}</p>
            </div>
          </div>
        </div>

        {/* AI Insights */}
        {kpi.executive_summary && (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-purple-600" /> AI Synthesis
            </h4>
            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 text-slate-600 font-medium leading-relaxed">
              {kpi.executive_summary}
            </div>
          </div>
        )}

        <div className="pt-10">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </motion.div>
  );
};
