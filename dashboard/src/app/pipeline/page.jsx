'use client';
import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher, patch, post } from '../../lib/api';

const COLOR_OPTIONS = [
  { label: 'Slate Gray',    class: 'border-t-slate-400 bg-slate-100/40' },
  { label: 'Ocean Blue',    class: 'border-t-blue-500 bg-blue-50/30' },
  { label: 'Emerald Green', class: 'border-t-emerald-500 bg-emerald-50/30' },
  { label: 'Amber Orange',  class: 'border-t-amber-500 bg-amber-50/30' },
  { label: 'Purple Gem',    class: 'border-t-purple-500 bg-purple-50/30' },
  { label: 'Indigo Velvet', class: 'border-t-indigo-600 bg-indigo-50/40' },
  { label: 'Rose Red',      class: 'border-t-rose-500 bg-rose-50/30' },
  { label: 'Teal Cyan',     class: 'border-t-teal-500 bg-teal-50/30' },
];

const INTENT_BRANCHES = [
  {
    intent: 'Interested',
    tag: '#Interested',
    stat: 'interested',
    action: 'Move to Engaged / Replied stage',
    next: 'Send follow-up template',
    color: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400', label: 'text-emerald-400' },
  },
  {
    intent: 'Form Request',
    tag: '#FormRequest',
    stat: 'form_request',
    action: 'Tag contact & send questionnaire',
    next: 'Await form completion',
    color: { border: 'border-cyan-500/30', bg: 'bg-cyan-500/5', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', dot: 'bg-cyan-400', label: 'text-cyan-400' },
  },
  {
    intent: 'Not Hiring',
    tag: '#NotHiring',
    stat: 'not_hiring',
    action: 'Pause campaigns for contact',
    next: 'Schedule re-engage in 90 days',
    color: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30', dot: 'bg-amber-400', label: 'text-amber-400' },
  },
  {
    intent: 'Referral Redirect',
    tag: '#Referral',
    stat: 'referral',
    action: 'Tag & queue referral template',
    next: 'Open connection to referred contact',
    color: { border: 'border-blue-500/30', bg: 'bg-blue-500/5', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30', dot: 'bg-blue-400', label: 'text-blue-400' },
  },
  {
    intent: 'Inquiry / Question',
    tag: '#Inquiry',
    stat: 'question',
    action: 'Tag & flag for manual review',
    next: 'Review in Inbox & respond',
    color: { border: 'border-purple-500/30', bg: 'bg-purple-500/5', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30', dot: 'bg-purple-400', label: 'text-purple-400' },
  },
  {
    intent: 'Out of Office',
    tag: '#OutOfOffice',
    stat: 'ooo',
    action: 'Delay follow-up by 14 days',
    next: 'Auto re-queue when period ends',
    color: { border: 'border-slate-500/30', bg: 'bg-slate-500/5', badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30', dot: 'bg-slate-400', label: 'text-slate-400' },
  },
];

export default function PipelinePage() {
  const { data: pipelineData, mutate: mutatePipelines } = useSWR('/pipelines', fetcher);
  const { data: contactData, mutate: mutateContacts } = useSWR('/contacts?limit=200', fetcher, { refreshInterval: 10000 });

  const pipelines = pipelineData?.pipelines || [];
  const contacts  = contactData?.contacts  || [];

  const [activePipelineId, setActivePipelineId] = useState(null);
  const [activeTab,        setActiveTab]        = useState('kanban');
  const [showCreateModal,  setShowCreateModal]  = useState(false);
  const [showEditModal,    setShowEditModal]    = useState(false);

  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelineDesc, setNewPipelineDesc] = useState('');
  const [editingStages,   setEditingStages]   = useState([]);
  const [newStageLabel,   setNewStageLabel]   = useState('');
  const [newStageColor,   setNewStageColor]   = useState(COLOR_OPTIONS[0].class);

  const activePipeline = pipelines.find(p => p._id === activePipelineId) || pipelines[0] || { stages: [] };

  const mlStats = {
    interested:   contacts.filter(c => c.tags?.includes('Interested')   || c.status === 'replied').length,
    form_request: contacts.filter(c => c.tags?.includes('FormRequest')).length,
    not_hiring:   contacts.filter(c => c.tags?.includes('NotHiring')).length,
    referral:     contacts.filter(c => c.tags?.includes('Referral')).length,
    question:     contacts.filter(c => c.tags?.includes('Inquiry')).length,
    ooo:          contacts.filter(c => c.tags?.includes('OutOfOffice')).length,
  };

  const totalML = Object.values(mlStats).reduce((a, b) => a + b, 0);

  async function handleCreatePipeline(e) {
    e.preventDefault();
    if (!newPipelineName.trim()) return;
    const res = await post('/pipelines', { name: newPipelineName, description: newPipelineDesc });
    setNewPipelineName(''); setNewPipelineDesc('');
    setShowCreateModal(false);
    mutatePipelines();
    if (res.pipeline) setActivePipelineId(res.pipeline._id);
  }

  function openEditModal() {
    setEditingStages([...(activePipeline.stages || [])]);
    setShowEditModal(true);
  }

  function handleAddStage() {
    if (!newStageLabel.trim()) return;
    setEditingStages([...editingStages, {
      id:    newStageLabel.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4),
      label: newStageLabel,
      color: newStageColor,
      order: editingStages.length,
    }]);
    setNewStageLabel('');
  }

  async function handleSaveStages() {
    await patch(`/pipelines/${activePipeline._id}`, { stages: editingStages });
    setShowEditModal(false);
    mutatePipelines();
  }

  async function moveStage(contactId, newStatus) {
    await patch(`/contacts/${contactId}`, { status: newStatus });
    mutateContacts();
  }

  const { data: campaignData } = useSWR('/campaigns', fetcher);
  const campaigns = campaignData?.campaigns || [];

  async function executeCampaign(contactIds) {
    const campaignId = document.getElementById('run-campaign-select')?.value;
    if (!campaignId) return alert('Select a campaign first');
    
    // Call build-queue with specific contact IDs
    const res = await post(`/campaigns/${campaignId}/build-queue`, { contactIds });
    if (res.queue) {
      alert(`Queued ${res.queue.length} contacts! Open the extension to start sending.`);
      // Optionally move them to 'contacted' status locally to update UI immediately
      contactIds.forEach(id => {
        patch(`/contacts/${id}`, { status: 'contacted' });
      });
      setTimeout(mutateContacts, 1000);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden font-sans">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-5 border-b border-slate-200 bg-white shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pipeline Management</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Track prospect flows, monitor ML intent routing, and manage outreach stages
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Segmented Tab Toggle */}
            <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab('kanban')}
                className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'kanban'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Kanban Board
              </button>
              <button
                onClick={() => setActiveTab('routing')}
                className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'routing'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                ML Routing Map
              </button>
            </div>

            <div className="w-px h-6 bg-slate-200 mx-1" />

            {/* Pipeline Select */}
            <select
              value={activePipeline._id || ''}
              onChange={e => setActivePipelineId(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-xl px-3 py-2 outline-none shadow-xs cursor-pointer"
            >
              {pipelines.map(p => (
                <option key={p._id} value={p._id}>{p.name}{p.isDefault ? ' (Default)' : ''}</option>
              ))}
            </select>

            <Link
              href="/pipeline/builder"
              className="text-xs px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold shadow transition-all"
            >
              Studio Builder
            </Link>
            <button
              onClick={openEditModal}
              className="text-xs px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all"
            >
              Edit Stages
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all"
            >
              + New Pipeline
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">

        {/* ─── KANBAN VIEW ─────────────────────────────────────────── */}
        {activeTab === 'kanban' && (
          <div className="h-full flex gap-4 overflow-x-auto p-8 items-start">
            {(activePipeline.stages || []).map(stage => {
              const stageContacts = contacts.filter(c => (c.status || 'new') === stage.id);
              return (
                <div
                  key={stage.id}
                  className={`w-72 shrink-0 rounded-xl border border-slate-200 border-t-4 flex flex-col h-full max-h-[calc(100vh-200px)] ${stage.color || 'border-t-slate-400 bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-slate-200/70">
                    <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider truncate">{stage.label}</h2>
                    <span className="text-[11px] px-2.5 py-0.5 bg-white border border-slate-200 rounded-full font-bold text-slate-600 shadow-xs">{stageContacts.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {stageContacts.map(contact => (
                      <div key={contact._id} className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs hover:border-blue-300 hover:shadow transition-all">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h3 className="font-bold text-xs text-slate-900 leading-snug">{contact.name}</h3>
                          {contact.company && (
                            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-semibold shrink-0">{contact.company}</span>
                          )}
                        </div>
                        {contact.headline && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 mb-2 leading-relaxed">{contact.headline}</p>
                        )}
                        {contact.tags?.length > 0 && (
                          <div className="flex gap-1 flex-wrap mb-2.5">
                            {contact.tags.map(t => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100 font-medium">#{t}</span>
                            ))}
                          </div>
                        )}
                        <div className="pt-2 border-t border-slate-100">
                          <select
                            value={contact.status || 'new'}
                            onChange={e => moveStage(contact._id, e.target.value)}
                            className="text-[11px] w-full py-1.5 px-2 border border-slate-200 rounded-md bg-slate-50 text-slate-700 outline-none cursor-pointer focus:border-blue-400 font-medium"
                          >
                            {(activePipeline.stages || []).map(s => (
                              <option key={s.id} value={s.id}>Move to: {s.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                    {stageContacts.length === 0 && (
                      <div className="py-12 text-center text-[11px] font-medium text-slate-400 border border-dashed border-slate-300 rounded-lg bg-white/50">
                        No leads in this stage
                      </div>
                    )}
                    
                    {/* Trigger Campaign for Connected Stage */}
                    {stage.id === 'connected' && stageContacts.length > 0 && (
                      <div className="mt-2 pt-3 border-t border-slate-200">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Trigger Campaign</label>
                        <div className="flex gap-1.5">
                          <select id="run-campaign-select" className="flex-1 text-[11px] bg-white border border-slate-300 rounded outline-none p-1.5">
                            <option value="">-- Select --</option>
                            {campaigns.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                          </select>
                          <button 
                            onClick={() => executeCampaign(stageContacts.map(c => c._id))}
                            className="text-[11px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 rounded shadow-xs transition-colors"
                          >
                            Run
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {(activePipeline.stages || []).length === 0 && (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400 font-medium">
                No stages configured. Click &ldquo;Edit Stages&rdquo; to set up your pipeline.
              </div>
            )}
          </div>
        )}

        {/* ─── ML ROUTING MAP VIEW ─────────────────────────────────── */}
        {activeTab === 'routing' && (
          <div className="h-full overflow-y-auto bg-[#080c14] p-8">
            {/* Dot-grid background */}
            <div className="fixed inset-0 pointer-events-none opacity-30"
              style={{ backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)', backgroundSize: '24px 24px' }}
            />

            <div className="relative z-10 max-w-5xl mx-auto space-y-10">

              {/* Section Header */}
              <div>
                <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-purple-300 uppercase tracking-widest">Live ML Routing Workflow</span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">Intent Classification Pipeline</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Every inbound LinkedIn reply is classified in real-time, then routed to a pipeline action based on intent.
                </p>
              </div>

              {/* ── Flow Diagram ─────────────────────────────────────── */}
              <div className="flex items-stretch gap-0">
                {/* Step 1 */}
                <div className="flex-1 border border-blue-500/25 bg-slate-900/80 rounded-2xl p-6 flex flex-col gap-3">
                  <div className="self-start text-[10px] font-bold text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full tracking-widest uppercase">Step 1 — Trigger</div>
                  <div className="text-base font-bold text-white mt-1">LinkedIn Reply Received</div>
                  <p className="text-slate-400 text-xs leading-relaxed">Chrome Extension detects a new inbound DM and forwards it to the WarmDM backend for processing.</p>
                  <div className="mt-auto flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-[11px] text-blue-300 font-semibold">Real-time sync</span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center px-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-px bg-gradient-to-r from-blue-500 to-purple-500" />
                    <svg className="w-2.5 h-2.5 text-purple-400 -mr-1" fill="currentColor" viewBox="0 0 6 10">
                      <path d="M0 0l6 5-6 5V0z" />
                    </svg>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex-1 border border-purple-500/25 bg-slate-900/80 rounded-2xl p-6 flex flex-col gap-3">
                  <div className="self-start text-[10px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full tracking-widest uppercase">Step 2 — Classify</div>
                  <div className="text-base font-bold text-white mt-1">WarmDM ML Classifier</div>
                  <p className="text-slate-400 text-xs leading-relaxed">FastAPI microservice runs a TF-IDF vectorizer + Logistic Regression pipeline to produce an intent score in under 10ms.</p>
                  <div className="mt-auto grid grid-cols-2 gap-1.5">
                    {['TF-IDF Vectorizer', 'Log-Regression', 'Confidence Score', 'Top Tokens'].map(t => (
                      <span key={t} className="text-[10px] bg-purple-500/10 border border-purple-500/15 text-purple-300 rounded px-2 py-0.5 font-mono font-semibold text-center">{t}</span>
                    ))}
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center px-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-px bg-gradient-to-r from-purple-500 to-indigo-500" />
                    <svg className="w-2.5 h-2.5 text-indigo-400 -mr-1" fill="currentColor" viewBox="0 0 6 10">
                      <path d="M0 0l6 5-6 5V0z" />
                    </svg>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex-1 border border-indigo-500/25 bg-slate-900/80 rounded-2xl p-6 flex flex-col gap-3">
                  <div className="self-start text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full tracking-widest uppercase">Step 3 — Route</div>
                  <div className="text-base font-bold text-white mt-1">Conditional Routing</div>
                  <p className="text-slate-400 text-xs leading-relaxed">Based on the classified intent, an if-else routing engine applies tags, updates the pipeline stage, and triggers follow-up actions.</p>
                  <div className="mt-auto flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    <span className="text-[11px] text-indigo-300 font-semibold">{totalML} contacts classified</span>
                  </div>
                </div>
              </div>

              {/* ── Funnel Stats Bar ─────────────────────────────────── */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {INTENT_BRANCHES.map(b => (
                  <div key={b.intent} className={`border ${b.color.border} ${b.color.bg} rounded-xl p-4 text-center`}>
                    <div className={`text-2xl font-black ${b.color.label}`}>{mlStats[b.stat]}</div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-1 leading-tight">{b.intent}</div>
                  </div>
                ))}
              </div>

              {/* ── If / Else Branch Cards ───────────────────────────── */}
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-3">IF / ELSE Routing Branches</span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                <div className="space-y-3">
                  {INTENT_BRANCHES.map((b, i) => (
                    <div key={b.intent} className={`border ${b.color.border} ${b.color.bg} rounded-2xl p-5 flex items-center gap-6`}>

                      {/* Condition */}
                      <div className="shrink-0 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-slate-400">
                        {i + 1}
                      </div>

                      {/* IF */}
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">IF intent =</div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold text-white`}>{b.intent}</span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 border rounded font-bold ${b.color.badge}`}>{b.tag}</span>
                        </div>
                      </div>

                      <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>

                      {/* THEN — Immediate Action */}
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">THEN (action)</div>
                        <div className="text-xs text-white font-semibold">{b.action}</div>
                      </div>

                      <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>

                      {/* NEXT STEP */}
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">NEXT STEP</div>
                        <div className="text-xs text-slate-300 font-medium">{b.next}</div>
                      </div>

                      {/* Live Count */}
                      <div className="shrink-0 text-right border-l border-slate-700/50 pl-5">
                        <div className={`text-2xl font-black ${b.color.label}`}>{mlStats[b.stat]}</div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Active</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ── Create Pipeline Modal ────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Create Pipeline</h2>
            <form onSubmit={handleCreatePipeline} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Pipeline Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Executive Sales, Investor Outreach"
                  value={newPipelineName}
                  onChange={e => setNewPipelineName(e.target.value)}
                  className="w-full text-sm p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Description</label>
                <input
                  type="text"
                  placeholder="Brief workflow summary"
                  value={newPipelineDesc}
                  onChange={e => setNewPipelineDesc(e.target.value)}
                  className="w-full text-sm p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="text-xs px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200">Cancel</button>
                <button type="submit" className="text-xs px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700">Create Pipeline</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Stages Modal ────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Customize Stages</h2>
                <p className="text-xs text-slate-500 mt-0.5">{activePipeline.name}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {editingStages.map((st, idx) => (
                <div key={st.id || idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}.</span>
                    <input
                      type="text"
                      value={st.label}
                      onChange={e => {
                        const updated = [...editingStages];
                        updated[idx].label = e.target.value;
                        setEditingStages(updated);
                      }}
                      className="text-sm font-semibold text-slate-800 bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none px-1 py-0.5"
                    />
                  </div>
                  <button type="button" onClick={() => setEditingStages(editingStages.filter((_, i) => i !== idx))} className="text-xs text-rose-500 hover:text-rose-700 font-bold">Delete</button>
                </div>
              ))}
              {editingStages.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">No stages yet. Add one below.</div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-700">Add New Stage</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Stage label (e.g. Interview Scheduled)"
                  value={newStageLabel}
                  onChange={e => setNewStageLabel(e.target.value)}
                  className="flex-1 text-sm p-2.5 border border-slate-300 rounded-xl outline-none focus:border-blue-500"
                />
                <select value={newStageColor} onChange={e => setNewStageColor(e.target.value)} className="text-xs p-2.5 border border-slate-300 rounded-xl outline-none bg-white">
                  {COLOR_OPTIONS.map(c => <option key={c.label} value={c.class}>{c.label}</option>)}
                </select>
                <button type="button" onClick={handleAddStage} className="text-xs px-4 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700">Add</button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button onClick={() => setShowEditModal(false)} className="text-xs px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200">Cancel</button>
              <button onClick={handleSaveStages} className="text-xs px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700">Save Stages</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
