'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, patch } from '../../lib/api';

const STAGES = [
  { id: 'new',               label: 'Lead / New',           color: 'border-t-slate-400 bg-slate-100/40' },
  { id: 'contacted',         label: 'Outreach Sent',        color: 'border-t-blue-500 bg-blue-50/30' },
  { id: 'replied',           label: 'Engaged / Replied',     color: 'border-t-emerald-500 bg-emerald-50/30' },
  { id: 'meeting_scheduled', label: 'Meeting Scheduled',   color: 'border-t-amber-500 bg-amber-50/30' },
  { id: 'qualified',         label: 'Qualified Opportunity', color: 'border-t-purple-500 bg-purple-50/30' },
  { id: 'closed_won',        label: 'Closed / Won',         color: 'border-t-indigo-600 bg-indigo-50/40' },
];

export default function PipelinePage() {
  const { data, mutate } = useSWR('/contacts?limit=200', fetcher, { refreshInterval: 15000 });
  const contacts = data?.contacts || [];

  async function moveStage(contactId, newStatus) {
    await patch(`/contacts/${contactId}`, { status: newStatus });
    mutate();
  }

  return (
    <div className="p-8 flex flex-col h-full overflow-hidden max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pipeline Management</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Track and progress prospects across qualified deal stages
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-3.5 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold shadow-xs">
            Total Active Leads: {contacts.length}
          </span>
        </div>
      </div>

      {/* Pipeline Columns */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4 items-start">
        {STAGES.map(stage => {
          const stageContacts = contacts.filter(c => (c.status || 'new') === stage.id);
          return (
            <div
              key={stage.id}
              className={`w-72 shrink-0 rounded-xl border border-slate-200 border-t-4 p-4 flex flex-col max-h-full ${stage.color}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3.5 shrink-0 pb-2 border-b border-slate-200/60">
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {stage.label}
                </h2>
                <span className="text-[11px] px-2 py-0.5 bg-white border border-slate-300 rounded-full font-bold text-slate-700 shadow-xs">
                  {stageContacts.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {stageContacts.map(contact => (
                  <div
                    key={contact._id}
                    className="bg-white border border-slate-200/90 rounded-lg p-4 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <h3 className="font-bold text-xs text-slate-900 leading-snug">
                        {contact.name}
                      </h3>
                      {contact.company && (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-semibold shrink-0 ml-1">
                          {contact.company}
                        </span>
                      )}
                    </div>

                    {contact.headline && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 mb-2.5 leading-relaxed">
                        {contact.headline}
                      </p>
                    )}

                    {/* Tags */}
                    {contact.tags?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mb-3">
                        {contact.tags.map(t => (
                          <span key={t} className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100/80 font-medium">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Stage mover selector */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <select
                        value={contact.status || 'new'}
                        onChange={e => moveStage(contact._id, e.target.value)}
                        className="text-[11px] py-1.5 px-2 border border-slate-200 rounded-md bg-slate-50 text-slate-700 outline-none cursor-pointer focus:border-blue-500 font-medium w-full"
                      >
                        {STAGES.map(s => (
                          <option key={s.id} value={s.id}>
                            Move to: {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}

                {stageContacts.length === 0 && (
                  <div className="py-10 text-center text-[11px] font-medium text-slate-400 border border-dashed border-slate-300 rounded-lg bg-white/40">
                    No leads in this stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
