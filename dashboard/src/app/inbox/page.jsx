'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher, patch } from '../../lib/api';

export default function InboxPage() {
  const { data: stats } = useSWR('/messages/stats', fetcher, { refreshInterval: 30000 });
  const { data, mutate } = useSWR('/contacts?status=replied', fetcher, { refreshInterval: 15000 });
  const { data: contacted } = useSWR('/contacts?status=contacted', fetcher, { refreshInterval: 15000 });

  const replied   = data?.contacts || [];
  const waiting   = contacted?.contacts || [];

  async function updateStatus(id, status) {
    await patch(`/contacts/${id}`, { status });
    mutate();
  }

  return (
    <div className="p-8 overflow-auto flex-1 max-w-7xl mx-auto w-full">
      <div className="mb-8 pb-6 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">CRM Inbox</h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">Active conversations and incoming prospect response log</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Messages Sent This Week', value: stats?.sent ?? '—' },
          { label: 'Responses Received',      value: stats?.replied ?? '—' },
          { label: 'Awaiting Response',       value: waiting.length },
          { label: 'Conversion Reply Rate',   value: stats?.sent > 0 ? `${Math.round((stats.replied / stats.sent) * 100)}%` : '—' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{s.label}</div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Replied */}
      <div className="mb-8 bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Prospect Replies ({replied.length})
          </h2>
        </div>
        {replied.length === 0
          ? <p className="text-xs text-slate-400 py-6 text-center">No prospect responses logged yet.</p>
          : <div className="space-y-3">
              {replied.map(c => (
                <div key={c._id} className="bg-slate-50/70 border border-slate-200 rounded-lg p-4 flex items-center justify-between shadow-xs hover:border-blue-300 transition-all">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <a href={c.profileUrl} target="_blank" rel="noreferrer"
                        className="font-bold text-xs hover:text-blue-600 text-slate-900">{c.name}</a>
                      {c.tags?.map(t => (
                        <span key={t} className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 font-medium">
                          #{t}
                        </span>
                      ))}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{c.headline}</div>
                    {c.replyPreview && (
                      <div className="text-xs text-slate-800 mt-2.5 bg-white border border-slate-200 rounded-md p-3 max-w-2xl font-medium shadow-xs leading-relaxed">
                        "{c.replyPreview}"
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 mt-2 font-medium">
                      Received {c.lastReplyAt ? new Date(c.lastReplyAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link href={`/compose?contactId=${c._id}`}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold shadow-xs">
                      Reply in Compose
                    </Link>
                    <button onClick={() => updateStatus(c._id, 'qualified')}
                      className="text-xs px-3 py-1.5 bg-purple-100 text-purple-800 rounded-md hover:bg-purple-200 font-semibold">
                      Mark Qualified
                    </button>
                    <button onClick={() => updateStatus(c._id, 'archived')}
                      className="text-xs px-3 py-1.5 bg-slate-200/70 text-slate-700 rounded-md hover:bg-slate-300/70 font-semibold">
                      Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Waiting */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Awaiting Response ({waiting.length})</h2>
        </div>
        {waiting.length === 0
          ? <p className="text-xs text-slate-400 py-6 text-center">No pending outreach conversations.</p>
          : <div className="space-y-3">
              {waiting.map(c => (
                <div key={c._id} className="bg-slate-50/50 border border-slate-200/80 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-900">{c.name}</span>
                    <div className="text-[11px] text-slate-500 mt-0.5">{c.headline}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-medium">
                      Messaged {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/compose?contactId=${c._id}`}
                      className="text-xs px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-100 font-semibold text-slate-700 bg-white">
                      Follow Up
                    </Link>
                    <button onClick={() => updateStatus(c._id, 'not_replied')}
                      className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 font-semibold">
                      Mark No Response
                    </button>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}
