'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, patch, post } from '../../lib/api';

const STAGE_CONFIG = {
  'new':               { label: 'Lead / New',           color: 'bg-slate-100 text-slate-800 border-slate-300' },
  'connection_sent':   { label: 'Connection Sent',      color: 'bg-amber-50 text-amber-800 border-amber-300' },
  'connected':         { label: 'Connected',            color: 'bg-teal-50 text-teal-800 border-teal-300' },
  'contacted':         { label: 'Outreach Sent',        color: 'bg-blue-50 text-blue-800 border-blue-300' },
  'manual_validation': { label: 'Manual Validation',    color: 'bg-purple-50 text-purple-800 border-purple-300' },
  'interested':        { label: 'Interested / Engaged', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  'not_interested':    { label: 'Not Interested',       color: 'bg-rose-50 text-rose-800 border-rose-300' },
  'meeting_scheduled': { label: 'Meeting Scheduled',    color: 'bg-amber-50 text-amber-800 border-amber-300' },
  'closed_won':        { label: 'Closed / Won',         color: 'bg-indigo-50 text-indigo-800 border-indigo-300' },
};

export default function PipelinePage() {
  const { data: contactData, mutate: mutateContacts } = useSWR('/contacts?limit=500', fetcher, { refreshInterval: 10000 });
  const { data: campaignData } = useSWR('/campaigns', fetcher);

  const contacts = contactData?.contacts || [];
  const campaigns = campaignData?.campaigns || [];

  const [selectedStage, setSelectedStage] = useState(null);
  
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

  async function moveStage(contactId, newStatus) {
    await patch(`/contacts/${contactId}`, { status: newStatus });
    mutateContacts();
  }

  function getContacts(stageId) {
    return contacts.filter(c => (c.status || 'new') === stageId);
  }

  function Node({ id }) {
    const count = getContacts(id).length;
    const config = STAGE_CONFIG[id] || { label: id, color: 'bg-slate-100 border-slate-300 text-slate-800' };
    
    return (
      <div 
        onClick={() => setSelectedStage(id)}
        className={`relative z-10 w-48 p-4 rounded-2xl border-2 cursor-pointer transition-all hover:scale-105 hover:shadow-lg flex flex-col items-center justify-center text-center ${config.color} ${selectedStage === id ? 'ring-4 ring-blue-400 ring-offset-2' : 'shadow-sm'}`}
      >
        <span className="text-xs font-bold uppercase tracking-wider mb-2 opacity-80">{config.label}</span>
        <span className="text-3xl font-black">{count}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 font-sans">
      
      {/* ── Main Flowchart Area ────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-auto p-12">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Visual Pipeline</h1>
        <p className="text-sm text-slate-500 font-medium mb-12">Map your outreach flow and trigger campaigns dynamically.</p>
        
        {/* The Grid / Flow Container */}
        <div className="relative flex flex-col items-center max-w-4xl mx-auto space-y-12">
          
          {/* Phase 1: Entry */}
          <div className="flex items-center gap-12 relative w-full justify-center">
            <Node id="new" />
            <div className="w-12 h-0.5 bg-slate-300"></div>
            <Node id="connection_sent" />
            <div className="w-12 h-0.5 bg-slate-300"></div>
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
          <div className="w-0.5 h-12 bg-slate-300 relative left-[260px] top-[-50px] -mt-12 -mb-12"></div>

          {/* Phase 2: Outreach Sent */}
          <div className="flex justify-end w-full max-w-[800px] pr-[70px]">
            <Node id="contacted" />
          </div>

          {/* Vertical Arrow Down to ML Engine */}
          <div className="w-0.5 h-12 bg-slate-300 relative left-[260px] -mt-12 -mb-12"></div>

          {/* Phase 3: ML Intent Engine (Hub) */}
          <div className="flex justify-end w-full max-w-[800px] pr-[50px]">
            <div className="relative z-10 w-56 p-4 rounded-3xl bg-slate-900 border-4 border-slate-800 text-white flex flex-col items-center justify-center text-center shadow-2xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">ML Intent Engine</span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Auto-routes incoming replies</p>
            </div>
          </div>

          {/* Branching Arrows from ML Engine */}
          <div className="relative w-full max-w-[900px] h-12 mt-4">
             {/* Central drop */}
             <div className="absolute top-0 left-[660px] w-0.5 h-6 bg-slate-300"></div>
             {/* Horizontal Bar */}
             <div className="absolute top-6 left-[120px] right-[120px] h-0.5 bg-slate-300"></div>
             {/* Drops */}
             <div className="absolute top-6 left-[120px] w-0.5 h-6 bg-slate-300"></div>
             <div className="absolute top-6 left-[300px] w-0.5 h-6 bg-slate-300"></div>
             <div className="absolute top-6 left-[480px] w-0.5 h-6 bg-slate-300"></div>
             <div className="absolute top-6 left-[660px] w-0.5 h-6 bg-slate-300"></div>
             <div className="absolute top-6 left-[840px] w-0.5 h-6 bg-slate-300"></div>
          </div>

          {/* Phase 4: Outcomes Grid */}
          <div className="flex items-start justify-center gap-8 w-full max-w-[1000px] pt-4">
            <div className="flex flex-col items-center gap-8">
              <Node id="interested" />
            </div>
            <div className="flex flex-col items-center gap-8">
              <Node id="manual_validation" />
            </div>
            <div className="flex flex-col items-center gap-8">
              <Node id="meeting_scheduled" />
            </div>
            <div className="flex flex-col items-center gap-8">
              <Node id="not_interested" />
            </div>
            <div className="flex flex-col items-center gap-8">
              <Node id="closed_won" />
            </div>
          </div>
          
        </div>
      </div>

      {/* ── Side Panel Viewer ──────────────────────────────────────────────────── */}
      {selectedStage && (
        <div className="w-[400px] shrink-0 border-l border-slate-200 bg-white flex flex-col shadow-2xl h-full animate-in slide-in-from-right">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">{STAGE_CONFIG[selectedStage]?.label}</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">{getContacts(selectedStage).length} prospects in this stage</p>
            </div>
            <button 
              onClick={() => setSelectedStage(null)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
            >
              ✕
            </button>
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
                {contact.tags?.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mb-4">
                    {contact.tags.map(t => (
                      <span key={t} className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 font-bold tracking-wide">#{t}</span>
                    ))}
                  </div>
                )}
                <div className="pt-3 border-t border-slate-100">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Move to Stage</label>
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
            ))}
            
            {getContacts(selectedStage).length === 0 && (
              <div className="py-20 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                  <span className="text-2xl opacity-50">👻</span>
                </div>
                <p className="text-sm font-bold text-slate-400">No prospects here</p>
                <p className="text-xs text-slate-400 mt-1">This stage is currently empty.</p>
              </div>
            )}
          </div>
        </div>
      )}
      
    </div>
  );
}
