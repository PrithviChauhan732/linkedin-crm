'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher } from '../lib/api';

export default function OverviewPage() {
  const { data: contactsData } = useSWR('/contacts?limit=200', fetcher, { refreshInterval: 15000 });
  const { data: campaignsData } = useSWR('/campaigns', fetcher, { refreshInterval: 15000 });
  const { data: stats } = useSWR('/messages/stats', fetcher, { refreshInterval: 30000 });

  const contacts = contactsData?.contacts || [];
  const campaigns = campaignsData?.campaigns || [];

  const totalContacts = contactsData?.total || contacts.length;
  const contactedCount = contacts.filter(c => c.status !== 'new').length;
  const repliedCount = contacts.filter(c => c.status === 'replied' || c.status === 'meeting_scheduled' || c.status === 'qualified' || c.status === 'closed_won').length;

  const replyRate = contactedCount > 0 ? Math.round((repliedCount / contactedCount) * 100) : 0;

  return (
    <div className="p-8 overflow-auto flex-1 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">CRM Dashboard Overview</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Outreach metrics, prospect pipeline status, and active campaign activity</p>
        </div>
        <div className="flex gap-3">
          <Link href="/compose" className="px-4 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition-all">
            + Compose Message
          </Link>
          <Link href="/campaigns" className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-all shadow-xs">
            Manage Campaigns
          </Link>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {[
          { label: 'Total CRM Contacts', value: totalContacts, border: 'border-l-slate-400' },
          { label: 'Prospects Contacted', value: contactedCount, border: 'border-l-blue-500' },
          { label: 'Engaged / Replied', value: repliedCount, border: 'border-l-emerald-500' },
          { label: 'Overall Reply Rate', value: `${replyRate}%`, border: 'border-l-purple-500' },
        ].map(kpi => (
          <div key={kpi.label} className={`bg-white rounded-xl border border-slate-200 border-l-4 p-5 shadow-xs ${kpi.border}`}>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{kpi.label}</div>
            <div className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Pipeline Summary */}
        <div className="col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pipeline Lead Breakdown</h2>
            <Link href="/pipeline" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
              View Pipeline Board &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Leads / New', count: contacts.filter(c => c.status === 'new').length },
              { label: 'Outreach Sent', count: contacts.filter(c => c.status === 'contacted').length },
              { label: 'Engaged / Replied', count: contacts.filter(c => c.status === 'replied').length },
              { label: 'Meetings Scheduled', count: contacts.filter(c => c.status === 'meeting_scheduled').length },
              { label: 'Qualified Opportunities', count: contacts.filter(c => c.status === 'qualified').length },
              { label: 'Closed / Won', count: contacts.filter(c => c.status === 'closed_won').length },
            ].map(stage => (
              <div key={stage.label} className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                <div className="text-xs text-slate-500 font-medium">{stage.label}</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{stage.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions Shortcuts */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 pb-3 border-b border-slate-100">CRM Navigation Shortcuts</h2>
            <div className="space-y-2.5">
              <Link href="/contacts" className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200/60 transition-all group">
                <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">Browse All Contacts</span>
                <span className="text-xs text-slate-400 font-bold">&rarr;</span>
              </Link>
              <Link href="/pipeline" className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200/60 transition-all group">
                <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">Manage Pipeline Board</span>
                <span className="text-xs text-slate-400 font-bold">&rarr;</span>
              </Link>
              <Link href="/inbox" className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200/60 transition-all group">
                <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">Review Inbox Replies</span>
                <span className="text-xs text-slate-400 font-bold">&rarr;</span>
              </Link>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center font-medium">
            System Operational & Syncing
          </div>
        </div>
      </div>

      {/* Active Campaigns List */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Active Outreach Campaigns</h2>
          <Link href="/campaigns" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">View All Campaigns &rarr;</Link>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No active outreach campaigns.</p>
        ) : (
          <div className="space-y-3">
            {campaigns.slice(0, 3).map(c => (
              <div key={c._id} className="flex items-center justify-between p-4 border border-slate-200/80 rounded-lg bg-slate-50/50">
                <div>
                  <div className="font-bold text-xs text-slate-900">{c.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Status: <span className="font-semibold text-slate-700 uppercase">{c.status}</span></div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-900">{c.stats?.sent ?? 0} / {c.stats?.total ?? 0} messages sent</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{c.stats?.replied ?? 0} responses recorded</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
