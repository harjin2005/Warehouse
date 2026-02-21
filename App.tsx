
import React, { useState, useRef } from 'react';
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
  Minus
} from 'lucide-react';
import { 
  AgentWorkflowState, 
  HealthStatus, 
  ActionStatus, 
  ProposedAction, 
  GatingDecision 
} from './types';
import { validateData, calculateKPIs, runRuleAndActionEngine, getAIExplanation, runFeedbackAnalysis } from './services/geminiService';

// --- Logo Component ---
const LeanBridgeLogo = () => (
  <div className="flex items-center gap-3">
    <div className="flex items-end gap-0.5 text-purple-600 shrink-0">
      <svg width="42" height="32" viewBox="0 0 42 32" fill="currentColor">
        <circle cx="10" cy="8" r="3.5" />
        <path d="M4 14C4 14 6 12 10 12C14 12 16 14 16 14L14 26H6L4 14Z" />
        <circle cx="21" cy="6" r="4.5" />
        <path d="M13 13C13 13 16 10 21 10C26 10 29 13 29 13L26 28H16L13 13Z" />
        <circle cx="32" cy="8" r="3.5" />
        <path d="M26 14C26 14 28 12 32 12C36 12 38 14 38 14L36 26H28L26 14Z" />
      </svg>
    </div>
    <div className="w-[2px] h-10 bg-purple-600 rounded-full mx-1"></div>
    <div className="flex flex-col">
      <span className="text-2xl font-semibold tracking-tight text-slate-900 leading-none">LeanBridge</span>
      <span className="text-[7px] font-bold tracking-[0.15em] text-slate-800 mt-1 uppercase">Lean Thinking Real Results</span>
    </div>
  </div>
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

export default function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'dashboard' | 'actions' | 'tuning' | 'chat' | 'strategic' | 'execution'>('upload');
  const [userRole, setUserRole] = useState<'Executive' | 'Supervisor'>('Supervisor');
  const [state, setState] = useState<AgentWorkflowState>({
    raw_data: '',
    validation: null,
    kpi_engine: null,
    rules: [],
    actions: [],
    feedback: null,
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
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setState(prev => ({ ...prev, raw_data: text }));
      };
      reader.readAsText(file);
    }
  };

  const handleRunWorkflow = async () => {
    if (!state.raw_data.trim()) return;
    setState(prev => ({ ...prev, isProcessing: true, error: null, validation: null, kpi_engine: null }));
    
    try {
      const validationResult = await validateData(state.raw_data);
      setState(prev => ({ ...prev, validation: validationResult }));

      if (validationResult.gating_decision === GatingDecision.BLOCK) {
        setState(prev => ({ ...prev, isProcessing: false, error: "Critical validation errors detected. Processing blocked." }));
        return;
      }

      const kpiEngineResult = await calculateKPIs(state.raw_data, validationResult.confidence_score);
      setState(prev => ({ ...prev, kpi_engine: kpiEngineResult }));

      if (kpiEngineResult.status === 'DISABLED') {
        setState(prev => ({ ...prev, isProcessing: false, error: kpiEngineResult.operator_view.simple_label }));
        return;
      }

      const ruleActionResult = await runRuleAndActionEngine(kpiEngineResult);
      setState(prev => ({
        ...prev,
        rules: ruleActionResult.rules,
        actions: ruleActionResult.actions,
        isProcessing: false,
      }));
      
      setActiveTab('dashboard');
    } catch (err) {
      setState(prev => ({ ...prev, isProcessing: false, error: "Modular pipeline failure. Please check data format." }));
    }
  };

  const updateActionStatus = async (actionId: string, newStatus: ActionStatus, reason?: string) => {
    setState(prev => ({
      ...prev,
      actions: prev.actions.map(a => a.action_id === actionId ? { ...a, status: newStatus, rejection_reason: reason } : a)
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
          
          <button disabled={!state.validation || state.validation.gating_decision === GatingDecision.BLOCK} onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${!state.validation || state.validation.gating_decision === GatingDecision.BLOCK ? 'opacity-30 cursor-not-allowed' : activeTab === 'dashboard' ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100 font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'}`}>
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-sm">OI Dashboard</span>
            </div>
            {activeTab === 'dashboard' && <ChevronRight className="w-4 h-4" />}
          </button>

          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-8 mb-3 px-3">Intelligence Views</p>
          
          <button 
            disabled={!state.kpi_engine || userRole !== 'Executive'} 
            onClick={() => setActiveTab('strategic')} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${!state.kpi_engine || userRole !== 'Executive' ? 'opacity-30 cursor-not-allowed' : activeTab === 'strategic' ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100 font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'}`}
          >
            <div className="flex items-center gap-3">
              <Briefcase className="w-4 h-4" />
              <span className="text-sm">SI-TI Strategic</span>
            </div>
            {activeTab === 'strategic' && <ChevronRight className="w-4 h-4" />}
          </button>

          <button 
            disabled={!state.kpi_engine} 
            onClick={() => setActiveTab('execution')} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${!state.kpi_engine ? 'opacity-30 cursor-not-allowed' : activeTab === 'execution' ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100 font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'}`}
          >
            <div className="flex items-center gap-3">
              <ClipboardList className="w-4 h-4" />
              <span className="text-sm">EI Execution</span>
            </div>
            {activeTab === 'execution' && <ChevronRight className="w-4 h-4" />}
          </button>

          <button disabled={!state.validation} onClick={() => setActiveTab('actions')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${!state.validation ? 'opacity-30 cursor-not-allowed' : activeTab === 'actions' ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100 font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'}`}>
            <div className="flex items-center gap-3">
              <Target className="w-4 h-4" />
              <span className="text-sm">Action Tracker</span>
            </div>
            {activeTab === 'actions' && <ChevronRight className="w-4 h-4" />}
          </button>

          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-8 mb-3 px-3">System Optimization</p>
          <button disabled={!state.validation} onClick={() => setActiveTab('tuning')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${!state.validation ? 'opacity-30 cursor-not-allowed' : activeTab === 'tuning' ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100 font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'}`}>
            <div className="flex items-center gap-3">
              <Settings2 className="w-4 h-4" />
              <span className="text-sm">System Tuning</span>
            </div>
            {activeTab === 'tuning' && <ChevronRight className="w-4 h-4" />}
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
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setUserRole('Executive');
                  if (activeTab === 'execution') setActiveTab('strategic');
                }} 
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${userRole === 'Executive' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
              >
                EXECUTIVE
              </button>
              <button 
                onClick={() => {
                  setUserRole('Supervisor');
                  if (activeTab === 'strategic') setActiveTab('execution');
                }} 
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${userRole === 'Supervisor' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
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
                <StatusBadge status={state.validation.validation_status} />
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
              <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/50 relative overflow-hidden">
                {/* Glow Background from Screenshot */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[80px] -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 blur-[80px] -ml-16 -mb-16"></div>

                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Data Intake</h3>
                    <p className="text-slate-500 text-sm">Synchronize your warehouse logs with LeanBridge's real-time engine.</p>
                  </div>
                  <div className="flex gap-3">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      className="hidden" 
                      accept=".csv,.txt"
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
                    placeholder="Paste CSV format: order_id, created_at, completed_at, zone, picker_id, quantity..."
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
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest flex items-center gap-2 px-6"
                    >
                        <Upload className="w-4 h-4" /> Upload
                    </button>
                    <button onClick={handleRunWorkflow} disabled={!state.raw_data || state.isProcessing} className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 text-white font-bold px-12 py-5 rounded-2xl shadow-xl shadow-purple-200 flex items-center gap-3 transition-all active:scale-95 group relative overflow-hidden">
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        <span className="relative z-10">{state.isProcessing ? "PROCESSING..." : "EXECUTE PIPELINE"}</span>
                        <Play className="w-4 h-4 fill-current group-hover:translate-x-1 transition-transform relative z-10" />
                    </button>
                  </div>
                </div>
              </div>

              {state.validation && (
                <div className={`p-10 rounded-[32px] border shadow-2xl animate-in slide-in-from-bottom-8 duration-700 ${state.validation.gating_decision === GatingDecision.BLOCK ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-start justify-between mb-10">
                    <div className="flex items-center gap-6">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${state.validation.gating_decision === GatingDecision.BLOCK ? 'bg-rose-600 text-white shadow-rose-200' : 'bg-emerald-600 text-white shadow-emerald-200'}`}>
                        {state.validation.gating_decision === GatingDecision.BLOCK ? <ShieldAlert className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
                      </div>
                      <div>
                        <h4 className="text-2xl font-bold">Ingestion Report</h4>
                        <div className="flex items-center gap-4 mt-2">
                          <StatusBadge status={state.validation.gating_decision} />
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Health Score: {state.validation.confidence_score}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-5xl font-bold tracking-tighter text-slate-900">{state.validation.total_rows}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Dataset Volume</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-2">
                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 h-fit">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-200 pb-2">Quality Audit</p>
                      <div className="space-y-4">
                        {Object.entries(state.validation.summary).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-xs text-slate-600 font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                            {typeof val === 'boolean' ? (val ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-rose-500" />) : <span className="text-xs font-bold text-slate-900">{val}%</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="lg:col-span-2 space-y-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Issues & Friction Points</p>
                      <div className="space-y-3">
                        {state.validation.issues_found.map((issue, idx) => (
                          <div key={idx} className={`flex items-start gap-5 p-5 rounded-2xl border transition-all hover:translate-x-1 ${issue.severity === 'CRITICAL' ? 'bg-rose-50 border-rose-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`p-2 rounded-xl shrink-0 ${issue.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                              <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{issue.issue} <span className="text-[10px] text-slate-500 font-bold ml-2">({issue.affected_rows} events affected)</span></p>
                              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">Resolution Recommendation: {issue.recommendation}</p>
                            </div>
                          </div>
                        ))}
                        {state.validation.issues_found.length === 0 && (
                          <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center space-y-4 bg-slate-50/50">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                            <p className="text-sm text-slate-500 font-medium italic">Dataset structural integrity verified. Phase 1 complete.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'strategic' && state.kpi_engine && userRole === 'Executive' && (
            <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">SI-TI Strategic Dashboard</h2>
                  <p className="text-slate-500 font-medium mt-1">Monthly Executive Performance Overview</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-white border border-slate-200 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Confidence: {state.kpi_engine.data_confidence_score}%</span>
                    <StatusBadge status={state.kpi_engine.data_confidence_label} />
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
                    {state.kpi_engine.executive_summary || "Operational efficiency is showing positive momentum with a steady decline in cycle times across primary zones."}
                  </h3>
                  <div className="flex gap-4">
                    <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/20 text-[10px] font-bold uppercase tracking-widest">
                      Grounded in {state.kpi_engine.volume.total_orders} Events
                    </div>
                    <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/20 text-[10px] font-bold uppercase tracking-widest">
                      Period: {state.kpi_engine.period.start} - {state.kpi_engine.period.end}
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI Strategic Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white border border-slate-200 p-10 rounded-[40px] shadow-xl shadow-slate-200/50 group hover:border-purple-200 transition-all">
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <p className="text-purple-600 text-[10px] font-bold uppercase tracking-widest mb-1">{state.kpi_engine.metric}</p>
                      <h4 className="text-2xl font-bold text-slate-900">{state.kpi_engine.display_name}</h4>
                    </div>
                    <StatusBadge status={state.kpi_engine.status} />
                  </div>
                  
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <p className="text-6xl font-black text-slate-900 tracking-tighter">
                        {state.kpi_engine.current_value.average?.toFixed(1)}<span className="text-xl font-bold text-slate-400 ml-1">{state.kpi_engine.unit}</span>
                      </p>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Current Monthly Average</p>
                    </div>
                    <div className="text-right">
                      <div className={`flex items-center gap-2 justify-end ${state.kpi_engine.trend.monthly_trend?.pattern === 'IMPROVING' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {state.kpi_engine.trend.monthly_trend?.pattern === 'IMPROVING' ? <TrendingDown className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
                        <span className="text-3xl font-black tracking-tighter">{state.kpi_engine.trend.monthly_trend?.mom_change_percent.toFixed(1)}%</span>
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Month-over-Month</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">
                      <span>4-Week Trend Pattern</span>
                      <span className={state.kpi_engine.trend.monthly_trend?.pattern === 'IMPROVING' ? 'text-emerald-600' : 'text-rose-600'}>{state.kpi_engine.trend.monthly_trend?.pattern}</span>
                    </div>
                    <div className="flex items-end gap-3 h-24">
                      {state.kpi_engine.trend.monthly_trend?.values.map((val, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                          <div 
                            className={`w-full rounded-t-xl transition-all duration-500 ${i === 3 ? 'bg-purple-600' : 'bg-slate-200 group-hover:bg-slate-300'}`}
                            style={{ height: `${(val / Math.max(...state.kpi_engine!.trend.monthly_trend!.values)) * 100}%` }}
                          ></div>
                          <span className="text-[9px] font-bold text-slate-400">W{i+1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 text-white p-10 rounded-[40px] shadow-xl relative overflow-hidden">
                  <div className="absolute bottom-0 right-0 p-10 opacity-10">
                    <Target className="w-48 h-48" />
                  </div>
                  <h4 className="text-xl font-bold mb-8 flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl"><Activity className="w-5 h-5" /></div>
                    Operational Throughput
                  </h4>
                  <div className="space-y-10 relative z-10">
                    <div>
                      <div className="flex justify-between items-end mb-3">
                        <p className="text-xs font-bold uppercase tracking-widest opacity-50">Completion Rate</p>
                        <p className="text-3xl font-bold">{state.kpi_engine.volume.completion_rate_percent.toFixed(1)}%</p>
                      </div>
                      <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                        <div className="bg-emerald-400 h-full" style={{ width: `${state.kpi_engine.volume.completion_rate_percent}%` }}></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Total Volume</p>
                        <p className="text-4xl font-black tracking-tighter">{state.kpi_engine.volume.total_orders}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Target SLA</p>
                        <p className="text-4xl font-black tracking-tighter">≤ 2.0h</p>
                      </div>
                    </div>
                    <div className="pt-6 border-t border-white/10">
                      <p className="text-xs font-medium opacity-70 leading-relaxed italic">
                        "Current performance is {state.kpi_engine.status === 'HEALTHY' ? 'within' : 'outside'} strategic target bands. Priority actions required for zone optimization."
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'execution' && state.kpi_engine && (
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
                        <p className="text-sm font-bold text-slate-800 leading-relaxed">{action.impact_prediction}</p>
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
          {activeTab === 'dashboard' && state.kpi_engine && (
            <div className="space-y-12 animate-in fade-in duration-700 max-w-6xl mx-auto">
              {/* Header / Summary Bar */}
              <div className="bg-purple-600 text-white rounded-[40px] p-10 flex flex-wrap items-center justify-between shadow-xl shadow-purple-200 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[80px] -mr-32 -mt-32"></div>
                 <div className="flex items-center gap-8 relative z-10">
                    <div>
                       <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Metric Status</p>
                       <div className="flex items-center gap-2">
                          <StatusBadge status={state.kpi_engine.status} />
                       </div>
                    </div>
                    <div className="h-10 w-px bg-white/20"></div>
                    <div>
                       <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Confidence</p>
                       <div className="flex items-center gap-2">
                          <StatusBadge status={state.kpi_engine.data_confidence_label} />
                          <span className="text-sm font-bold">{state.kpi_engine.data_confidence_score}%</span>
                       </div>
                    </div>
                    <div className="h-10 w-px bg-white/20"></div>
                    <div>
                       <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Period</p>
                       <p className="text-sm font-bold">{state.kpi_engine.period.start} to {state.kpi_engine.period.end}</p>
                    </div>
                 </div>
                 <div className="flex gap-4 relative z-10">
                    <button className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-2xl border border-white/20 flex items-center gap-2 transition-all">
                       <Download className="w-4 h-4" /> Export Report
                    </button>
                 </div>
              </div>

              {/* Main KPI Display */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Primary Metric Card */}
                <div className="lg:col-span-2 bg-white border border-slate-200 p-12 rounded-[48px] shadow-xl shadow-slate-200/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-12 opacity-[0.03] text-purple-600 pointer-events-none">
                    <Activity className="w-64 h-64" />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-10">
                      <div className="space-y-2">
                        <p className="text-purple-600 text-xs font-bold uppercase tracking-[0.2em]">{state.kpi_engine.metric.replace(/_/g, ' ')}</p>
                        <h2 className="text-5xl font-extrabold text-slate-900 tracking-tighter">{state.kpi_engine.display_name}</h2>
                      </div>
                      <div className="text-right">
                        <p className="text-7xl font-black text-slate-900 tracking-tighter">
                          {state.kpi_engine.current_value.average?.toFixed(1)}<span className="text-2xl font-bold text-slate-400 ml-1">{state.kpi_engine.unit}</span>
                        </p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Current Average</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                      {[
                        { label: 'Median', value: state.kpi_engine.current_value.median, unit: 'h' },
                        { label: 'P90', value: state.kpi_engine.current_value.p90, unit: 'h' },
                        { label: 'Min', value: state.kpi_engine.current_value.min, unit: 'h' },
                        { label: 'Max', value: state.kpi_engine.current_value.max, unit: 'h' },
                      ].map((stat, i) => (
                        <div key={i} className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                          <p className="text-xl font-bold text-slate-900">{stat.value?.toFixed(1)}{stat.unit}</p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-slate-900 text-white p-8 rounded-[32px] flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className={`p-4 rounded-2xl ${state.kpi_engine.trend.direction === 'DECREASING' ? 'bg-emerald-500/20 text-emerald-400' : state.kpi_engine.trend.direction === 'INCREASING' ? 'bg-rose-500/20 text-rose-400' : 'bg-white/10 text-white'}`}>
                          {state.kpi_engine.trend.direction === 'DECREASING' ? <TrendingDown className="w-6 h-6" /> : state.kpi_engine.trend.direction === 'INCREASING' ? <TrendingUp className="w-6 h-6" /> : <Minus className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Weekly Comparison</p>
                          <p className="text-lg font-bold">
                            {state.kpi_engine.trend.direction} 
                            <span className={`ml-2 font-medium ${state.kpi_engine.trend.direction === 'DECREASING' ? 'text-emerald-400' : state.kpi_engine.trend.direction === 'INCREASING' ? 'text-rose-400' : 'text-white'}`}>
                              ({state.kpi_engine.trend.change_absolute ? (state.kpi_engine.trend.change_absolute > 0 ? '+' : '') + state.kpi_engine.trend.change_absolute.toFixed(1) : '0.0'}h / {state.kpi_engine.trend.change_percent ? (state.kpi_engine.trend.change_percent > 0 ? '+' : '') + state.kpi_engine.trend.change_percent.toFixed(1) + '%' : '0.0%'})
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Previous Week</p>
                        <p className="text-lg font-bold">{state.kpi_engine.trend.previous_period_value?.toFixed(1) || 'N/A'}{state.kpi_engine.unit}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Volume & Operator View Card */}
                <div className="space-y-8">
                  <div className="bg-white border border-slate-200 p-10 rounded-[40px] shadow-lg">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" /> Volume Metrics
                    </p>
                    <div className="space-y-6">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-3xl font-bold text-slate-900">{state.kpi_engine.volume.total_orders}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Orders</p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-emerald-600">{state.kpi_engine.volume.completion_rate_percent.toFixed(1)}%</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completion Rate</p>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${state.kpi_engine.volume.completion_rate_percent}%` }}></div>
                      </div>
                      <p className="text-xs font-medium text-slate-500 italic text-center">
                        {state.kpi_engine.volume.completed_orders} of {state.kpi_engine.volume.total_orders} orders completed
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 p-10 rounded-[40px] shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-[0.05] text-purple-600">
                      <MessageSquare className="w-12 h-12" />
                    </div>
                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-6">Operator Insights</p>
                    <h5 className="text-lg font-bold text-slate-900 leading-snug mb-4">"{state.kpi_engine.operator_view.simple_label}"</h5>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Why it matters</p>
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">{state.kpi_engine.operator_view.why_it_matters}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stakeholders</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {state.kpi_engine.operator_view.who_should_care.map((role, i) => (
                            <span key={i} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">{role}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Thresholds Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-[32px] p-8 flex flex-wrap items-center justify-center gap-12">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Healthy: ≤ {state.kpi_engine.thresholds.healthy_max}h</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Warning: ≤ {state.kpi_engine.thresholds.warning_max}h</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Critical: &gt; {state.kpi_engine.thresholds.critical_above}h</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'actions' && (
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
                             <p className="text-base font-bold text-slate-800 leading-relaxed">{action.impact_prediction}</p>
                          </div>
                          <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                             <div className="flex items-center gap-3 mb-4 text-slate-500 uppercase font-bold text-[11px] tracking-widest"><Lightbulb className="w-5 h-5 text-purple-400" /> Logical Foundation</div>
                             <p className="text-xs text-slate-500 leading-relaxed font-semibold italic">"{action.reasoning}"</p>
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
        </div>
      </main>
    </div>
  );
}
