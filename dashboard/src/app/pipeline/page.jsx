'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, patch, post, del } from '../../lib/api';

const STAGE_CONFIG = {
  'new':               { label: 'Lead / New',           color: 'bg-slate-100 text-slate-800 border-slate-300' },
  'connection_sent':   { label: 'Connection Sent',      color: 'bg-amber-50 text-amber-800 border-amber-300' },
  'connected':         { label: 'Connected',            color: 'bg-teal-50 text-teal-800 border-teal-300' },
  'contacted':         { label: 'Outreach Sent',        color: 'bg-blue-50 text-blue-800 border-blue-300' },
  'interested':        { label: 'Interested',           color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  'form_request':      { label: 'Form Request',         color: 'bg-cyan-50 text-cyan-800 border-cyan-300' },
  'not_hiring':        { label: 'Not Hiring',           color: 'bg-orange-50 text-orange-800 border-orange-300' },
  'not_interested':    { label: 'Not Interested',       color: 'bg-rose-50 text-rose-800 border-rose-300' },
  'referral':          { label: 'Referral',             color: 'bg-blue-50 text-blue-800 border-blue-300' },
  'question':          { label: 'Question',             color: 'bg-purple-50 text-purple-800 border-purple-300' },
  'ooo':               { label: 'Out of Office',        color: 'bg-slate-100 text-slate-600 border-slate-300' },
};

export default function PipelinePage() {
  const { data: pipelineData, mutate: mutatePipelines } = useSWR('/pipelines', fetcher);
  const { data: campaignData } = useSWR('/campaigns', fetcher);

  const pipelines = pipelineData?.pipelines || [];
  const campaigns = campaignData?.campaigns || [];

  const [activePipelineId, setActivePipelineId] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  
  // Pipeline Create State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  
  // ML Playground State
  const [mlTestInput, setMlTestInput] = useState('');
  const [mlTestResult, setMlTestResult] = useState(null);
  const [isTestingMl, setIsTestingMl] = useState(false);

  const activePipeline = pipelines.find(p => p._id === activePipelineId) || pipelines[0] || {};

  // Fetch contacts scoped by the active pipeline
  const contactsQueryUrl = activePipeline._id
    ? `/contacts?limit=500&pipelineId=${activePipeline._id}&isDefault=${!!activePipeline.isDefault}`
    : null;

  const { data: contactData, mutate: mutateContacts } = useSWR(contactsQueryUrl, fetcher, { refreshInterval: 10000 });
  const contacts = contactData?.contacts || [];

  async function handleCreatePipeline(e) {
    e.preventDefault();
    if (!newPipelineName.trim()) return;
    const res = await post('/pipelines', { name: newPipelineName, description: 'Visual Pipeline' });
    setNewPipelineName('');
    setShowCreateModal(false);
    mutatePipelines();
    if (res.pipeline) setActivePipelineId(res.pipeline._id);
  }

  async function executeCampaign(contactIds) {
    const campaignId = document.getElementById('run-campaign-select')?.value;
    if (!campaignId) return alert('Select a campaign first');
    
    const res = await post(`/campaigns/${campaignId}/build-queue`, { contactIds });
    if (res.queue) {
      alert(`Queued ${res.queue.length} contacts! Open the extension to start sending.`);
      contactIds.forEach(id => {
        patch(`/contacts/${id}`, { status: 'contacted' });
      });
      setTimeout(mutateContacts, 1000);
    }
  }

  async function executeStepCampaign(stageId, campaignId) {
    const contactIds = getContacts(stageId).map(c => c._id);
    if (contactIds.length === 0) return alert('No contacts in this stage to trigger outreach.');
    
    const res = await post(`/campaigns/${campaignId}/build-queue`, { contactIds });
    if (res.queue) {
      alert(`Queued ${res.queue.length} contacts! Open the extension to start sending.`);
      contactIds.forEach(id => {
        patch(`/contacts/${id}`, { status: 'contacted' });
      });
      setTimeout(mutateContacts, 1000);
    }
  }

  async function moveStage(contactId, newStatus) {
    await patch(`/contacts/${contactId}`, { status: newStatus });
    mutateContacts();
  }

  async function movePipeline(contactId, targetPipelineId) {
    await patch(`/contacts/${contactId}`, { pipelineId: targetPipelineId });
    mutateContacts();
  }

  async function addStep(stageId) {
    const step = prompt("Enter the follow-up step description (e.g. 'Send Calendar Link'):");
    if (!step || !step.trim()) return;
    await post(`/pipelines/${activePipeline._id}/stages/${stageId}/steps`, { step: step.trim() });
    mutatePipelines();
  }

  async function removeStep(stageId, index) {
    if (!confirm("Are you sure you want to remove this step?")) return;
    await del(`/pipelines/${activePipeline._id}/stages/${stageId}/steps/${index}`);
    mutatePipelines();
  }

  async function testMlEngine() {
    if (!mlTestInput.trim()) return;
    setIsTestingMl(true);
    setMlTestResult(null);
    try {
      const res = await post('/messages/test-ml', { text: mlTestInput });
      if (res.error) {
        setMlTestResult({ error: res.error });
      } else {
        setMlTestResult(res);
      }
    } catch (e) {
      setMlTestResult({ error: 'Engine offline' });
    }
    setIsTestingMl(false);
  }

  function getContacts(stageId) {
    return contacts.filter(c => (c.status || 'new') === stageId);
  }

  function Node({ id }) {
    const count = getContacts(id).length;
    const config = STAGE_CONFIG[id] || { label: id, color: 'bg-slate-100 border-slate-300 text-slate-800' };
    
    return (
      <div className="flex flex-col items-center">
        <div 
          onClick={() => setSelectedStage(id)}
          className={`relative z-10 w-44 p-3 rounded-2xl border-2 cursor-pointer transition-all hover:scale-105 hover:shadow-lg flex flex-col items-center justify-center text-center ${config.color} ${selectedStage === id ? 'ring-4 ring-blue-400 ring-offset-2' : 'shadow-sm'}`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider mb-1.5 opacity-80">{config.label}</span>
          <span className="text-3xl font-black">{count}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-50 font-sans">
      
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="px-8 pt-5 pb-3 bg-white shrink-0 flex items-center justify-between z-20">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Visual Pipeline</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Manage flows and ML intent routing</p>
        </div>
      </div>

      {/* ── Horizontal Pipeline Switching Tabs ────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-8 py-3 overflow-x-auto shrink-0 z-10">
        {pipelines.map(p => (
          <button
            key={p._id}
            onClick={() => {
              setActivePipelineId(p._id);
              setSelectedStage(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all border whitespace-nowrap shadow-sm ${
              activePipeline._id === p._id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {p.name}{p.isDefault ? ' (Default)' : ''}
          </button>
        ))}
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-50 border border-dashed border-blue-300 rounded-xl transition-all shadow-sm"
        >
          + New Pipeline
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Main Flowchart Area ─────────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-auto p-12">
          
          <div className="relative flex flex-col items-center max-w-5xl mx-auto space-y-10">
            
            {/* Phase 1: Entry */}
            <div className="flex items-center gap-8 relative w-full justify-center">
              <Node id="new" />
              <div className="w-8 h-0.5 bg-slate-300"></div>
              <Node id="connection_sent" />
              <div className="w-8 h-0.5 bg-slate-300"></div>
              <div className="flex flex-col items-center gap-3">
                <Node id="connected" />
                
                {/* Embedded Trigger */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm w-56">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 text-center">Trigger Campaign</label>
                  <div className="flex flex-col gap-2">
                    <select id="run-campaign-select" className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none p-2 focus:border-blue-400">
                      <option value="">-- Select Campaign --</option>
                      {campaigns.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                    <button 
                      onClick={() => executeCampaign(getContacts('connected').map(c => c._id))}
                      className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg shadow-sm transition-colors"
                    >
                      Run Outreach ({getContacts('connected').length})
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Vertical Arrow Down */}
            <div className="w-0.5 h-10 bg-slate-300 relative left-[295px] top-[-40px] -mt-10 -mb-10"></div>

            {/* Phase 2: Outreach Sent */}
            <div className="flex justify-end w-full max-w-[800px] pr-[10px]">
              <Node id="contacted" />
            </div>

            {/* Vertical Arrow Down to ML Engine */}
            <div className="w-0.5 h-10 bg-slate-300 relative left-[295px] -mt-10 -mb-10"></div>

            {/* Phase 3: ML Intent Engine (Hub) */}
            <div className="flex justify-end w-full max-w-[800px] pr-[-10px]">
              <div 
                onClick={() => setSelectedStage('ml_engine')}
                className={`relative z-10 w-56 p-4 rounded-3xl bg-slate-900 border-4 border-slate-800 text-white flex flex-col items-center justify-center text-center shadow-2xl cursor-pointer hover:scale-105 transition-all ${selectedStage === 'ml_engine' ? 'ring-4 ring-purple-500 ring-offset-2' : ''}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">ML Intent Engine</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Auto-routes incoming replies</p>
              </div>
            </div>

            {/* Branching Arrows from ML Engine */}
            <div className="relative w-full max-w-[1000px] h-10 mt-2">
               {/* Central drop */}
               <div className="absolute top-0 left-[750px] w-0.5 h-5 bg-slate-300"></div>
               {/* Horizontal Bar */}
               <div className="absolute top-5 left-[60px] right-[60px] h-0.5 bg-slate-300"></div>
               {/* Drops */}
               <div className="absolute top-5 left-[60px] w-0.5 h-5 bg-slate-300"></div>
               <div className="absolute top-5 left-[200px] w-0.5 h-5 bg-slate-300"></div>
               <div className="absolute top-5 left-[340px] w-0.5 h-5 bg-slate-300"></div>
               <div className="absolute top-5 left-[480px] w-0.5 h-5 bg-slate-300"></div>
               <div className="absolute top-5 left-[620px] w-0.5 h-5 bg-slate-300"></div>
               <div className="absolute top-5 left-[760px] w-0.5 h-5 bg-slate-300"></div>
               <div className="absolute top-5 left-[900px] w-0.5 h-5 bg-slate-300"></div>
            </div>

            {/* Phase 4: Outcomes Grid (7 ML Intents) with follow-up steps */}
            <div className="flex items-start justify-center gap-[40px] w-full max-w-[1100px] pt-2">
              {[
                'interested', 
                'form_request', 
                'referral', 
                'question', 
                'not_hiring', 
                'not_interested', 
                'ooo'
              ].map(intent => {
                const steps = activePipeline.followUps?.[intent] || [];
                return (
                  <div key={intent} className="flex flex-col items-center shrink-0 w-44">
                    <Node id={intent} />
                    
                    {/* Visual custom follow-up chains */}
                    {steps.map((step, idx) => {
                      const selectId = `campaign-select-${intent}-${idx}`;
                      const count = getContacts(intent).length;
                      return (
                        <div key={idx} className="flex flex-col items-center w-full animate-in slide-in-from-top-3 duration-250">
                          {/* vertical line */}
                          <div className="w-0.5 h-4 bg-slate-300"></div>
                          {/* Step Card */}
                          <div className="relative group bg-white border border-slate-200 rounded-xl p-3 shadow-sm w-44 flex flex-col gap-2">
                            {/* Header & Delete */}
                            <div className="flex items-start justify-between gap-1">
                              <span className="text-[10px] font-bold text-slate-700 leading-snug truncate" title={step}>{step}</span>
                              <button
                                onClick={() => removeStep(intent, idx)}
                                className="text-[9px] text-slate-400 hover:text-red-500 font-bold cursor-pointer shrink-0"
                                title="Remove Step"
                              >
                                ✕
                              </button>
                            </div>
                            
                            {/* Campaign Selector & Trigger */}
                            <select 
                              id={selectId} 
                              className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded-lg outline-none p-1.5 focus:border-blue-400"
                            >
                              <option value="">-- Select Campaign --</option>
                              {campaigns.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                            <button 
                              onClick={() => {
                                const selectEl = document.getElementById(selectId);
                                const campaignId = selectEl?.value;
                                if (!campaignId) return alert('Select a campaign first');
                                executeStepCampaign(intent, campaignId);
                              }}
                              className="w-full text-[9px] bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded-lg shadow-sm transition-colors"
                            >
                              Run Outreach ({count})
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add Step visual placeholder */}
                    <div className="w-0.5 h-4 bg-slate-200 mt-2"></div>
                    <button 
                      onClick={() => addStep(intent)}
                      className="text-[9px] font-black text-slate-400 uppercase tracking-wider border border-dashed border-slate-300 rounded px-2 py-1.5 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                      + Add Step
                    </button>
                  </div>
                );
              })}
            </div>
            
          </div>
        </div>

        {/* ── Side Panel Viewer ────────────────────────────────────────────────── */}
        {selectedStage && (
          <div className="w-[400px] shrink-0 border-l border-slate-200 bg-white flex flex-col shadow-2xl h-full animate-in slide-in-from-right">
            
            {/* ML TESTING PLAYGROUND */}
            {selectedStage === 'ml_engine' ? (
              <>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-900">
                  <div>
                    <h2 className="text-lg font-black text-white tracking-tight">ML Playground</h2>
                    <p className="text-xs text-slate-400 font-medium mt-1">Test the Python Intent Classifier</p>
                  </div>
                  <button onClick={() => setSelectedStage(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700">✕</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Incoming Reply</label>
                    <textarea 
                      value={mlTestInput}
                      onChange={e => setMlTestInput(e.target.value)}
                      placeholder="Type a mock reply from a prospect..."
                      className="w-full h-32 p-3 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none resize-none transition-all"
                    />
                    <button 
                      onClick={testMlEngine}
                      disabled={isTestingMl || !mlTestInput.trim()}
                      className="mt-3 w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold py-2.5 rounded-xl shadow-sm transition-all"
                    >
                      {isTestingMl ? 'Processing (Sub-10ms)...' : 'Test Engine'}
                    </button>
                  </div>

                  {mlTestResult && !mlTestResult.error && (
                    <div className="border border-purple-200 bg-purple-50 rounded-2xl p-5 animate-in fade-in zoom-in-95">
                      <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-4">Live Classification Result</div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-slate-500 font-semibold mb-1">Detected Intent</div>
                          <div className="text-lg font-black text-slate-900 capitalize">{mlTestResult.intent.replace('_', ' ')}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 font-semibold mb-1">Confidence Score</div>
                          <div className={`text-lg font-black ${mlTestResult.confidence >= 0.7 ? 'text-emerald-600' : 'text-amber-500'}`}>
                            {(mlTestResult.confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-purple-200/50">
                        <div className="text-xs text-slate-500 font-semibold mb-1.5">Action & Routing</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-1 bg-purple-200 text-purple-800 rounded">{mlTestResult.recommended_tag}</span>
                          <span className="text-xs font-semibold text-slate-600">➔ routes to</span>
                          <span className="text-xs font-bold px-2 py-1 bg-slate-200 text-slate-700 rounded uppercase">{mlTestResult.recommended_stage}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {mlTestResult?.error && (
                    <div className="text-sm font-bold text-rose-500 bg-rose-50 p-4 rounded-xl border border-rose-200">
                      Error: {mlTestResult.error}. Make sure the ML service is running on port 8000.
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* REGULAR STAGE CONTACTS VIEWER */
              <>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">{STAGE_CONFIG[selectedStage]?.label}</h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">{getContacts(selectedStage).length} prospects in this stage</p>
                  </div>
                  <button onClick={() => setSelectedStage(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors">✕</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {getContacts(selectedStage).map(contact => (
                    <div key={contact._id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-bold text-sm text-slate-900 leading-snug">{contact.name}</h3>
                        {contact.company && (
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-bold shrink-0 border border-slate-200">{contact.company}</span>
                        )}
                      </div>
                      {contact.headline && (
                        <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">{contact.headline}</p>
                      )}
                      
                      <div className="pt-3 border-t border-slate-100 flex flex-col gap-3">
                        {/* Move Pipeline Mover dropdown */}
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Move to Pipeline</label>
                          <select
                            value={contact.pipelineId || (pipelines.find(p => p.isDefault)?._id || '')}
                            onChange={e => movePipeline(contact._id, e.target.value)}
                            className="text-xs w-full py-2 px-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 outline-none cursor-pointer focus:border-blue-400 focus:ring-2 focus:ring-blue-100 font-medium transition-all"
                          >
                            {pipelines.map(p => (
                              <option key={p._id} value={p._id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Move to Stage</label>
                          <select
                            value={contact.status || 'new'}
                            onChange={e => moveStage(contact._id, e.target.value)}
                            className="text-xs w-full py-2 px-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 outline-none cursor-pointer focus:border-blue-400 focus:ring-2 focus:ring-blue-100 font-medium transition-all"
                          >
                            {Object.entries(STAGE_CONFIG).map(([key, val]) => (
                              <option key={key} value={key}>{val.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {getContacts(selectedStage).length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4"><span className="text-2xl opacity-50">👻</span></div>
                      <p className="text-sm font-bold text-slate-400">No prospects here</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Create Pipeline Modal ──────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <form onSubmit={handleCreatePipeline} className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Create New Pipeline</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Pipeline Name</label>
                <input
                  autoFocus
                  type="text"
                  required
                  value={newPipelineName}
                  onChange={e => setNewPipelineName(e.target.value)}
                  placeholder="e.g. Q3 Sales Outreach"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none text-sm font-medium"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900">Cancel</button>
              <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm">Create Pipeline</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
