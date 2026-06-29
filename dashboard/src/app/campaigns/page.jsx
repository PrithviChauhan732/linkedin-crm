'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, post, patch } from '../../lib/api';
import { sendToExtension } from '../../lib/extension';

const STATUS_BADGE = {
  draft:    'bg-gray-100 text-gray-600',
  running:  'bg-blue-100 text-blue-700',
  paused:   'bg-yellow-100 text-yellow-700',
  complete: 'bg-green-100 text-green-700',
};

export default function CampaignsPage() {
  const { data, mutate }      = useSWR('/campaigns', fetcher);
  const { data: groupsData }  = useSWR('/groups', fetcher);
  const { data: tmplData }    = useSWR('/templates', fetcher);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', groupId: '', templateId: '' });
  const [running, setRunning] = useState(null);

  const campaigns = data?.campaigns || [];
  const groups    = groupsData?.groups || [];
  const templates = tmplData?.templates || [];

  async function createCampaign(e) {
    e.preventDefault();
    await post('/campaigns', form);
    setForm({ name: '', groupId: '', templateId: '' });
    setCreating(false);
    mutate();
  }

  async function startCampaign(campaign) {
    setRunning(campaign._id);
    try {
      const { queue } = await post(`/campaigns/${campaign._id}/build-queue`, {});

      const res = await sendToExtension({ type: 'FORWARD_TO_CONTENT', payload: { type: 'START_CAMPAIGN', queue } });
      if (!res) {
        alert('Extension not detected. Install the LinkedIn CRM extension and reload this page.');
      }
      mutate();
    } finally {
      setRunning(null);
    }
  }

  async function pauseCampaign(id) {
    await patch(`/campaigns/${id}/pause`, {});
    sendToExtension({ type: 'FORWARD_TO_CONTENT', payload: { type: 'STOP_CAMPAIGN' } });
    mutate();
  }

  async function resetCampaign(id) {
    await patch(`/campaigns/${id}`, { status: 'draft' });
    mutate();
  }

  return (
    <div className="p-6 overflow-auto flex-1">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Send templated messages to groups and track replies</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          + New Campaign
        </button>
      </div>

      {creating && (
        <form onSubmit={createCampaign} className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold mb-4">Create Campaign</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Campaign Name *</label>
              <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="e.g. PM Outreach — June" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Group *</label>
              <select required value={form.groupId} onChange={e => setForm(p => ({ ...p, groupId: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white">
                <option value="">Select group</option>
                {groups.map(g => <option key={g._id} value={g._id}>{g.name} ({g.contactCount} contacts)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Template *</label>
              <select required value={form.templateId} onChange={e => setForm(p => ({ ...p, templateId: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white">
                <option value="">Select template</option>
                {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Create</button>
            <button type="button" onClick={() => setCreating(false)}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {campaigns.map(c => {
          const replyRate = c.stats.sent > 0 ? Math.round((c.stats.replied / c.stats.sent) * 100) : 0;
          return (
            <div key={c._id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{c.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status]}`}>{c.status}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Group: {c.group?.name} · Template: {c.template?.name}
                  </div>
                </div>
                <div className="flex gap-2">
                  {c.status === 'draft' && (
                    <button onClick={() => startCampaign(c)} disabled={running === c._id}
                      className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {running === c._id ? 'Starting...' : '▶ Start'}
                    </button>
                  )}
                  {c.status === 'running' && (
                    <button onClick={() => pauseCampaign(c._id)}
                      className="text-sm px-4 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200">
                      ⏸ Pause
                    </button>
                  )}
                  {(c.status === 'paused' || c.status === 'complete') && (
                    <button onClick={() => resetCampaign(c._id)}
                      className="text-sm px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                      ↺ Reset to draft
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{c.stats.sent} / {c.stats.total} sent</span>
                  <span>{replyRate}% reply rate</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${c.stats.total > 0 ? (c.stats.sent / c.stats.total) * 100 : 0}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  ['Total', c.stats.total],
                  ['Sent', c.stats.sent],
                  ['Replied', c.stats.replied],
                  ['Failed', c.stats.failed],
                ].map(([label, val]) => (
                  <div key={label} className="bg-gray-50 rounded-lg py-2">
                    <div className="font-semibold text-sm">{val}</div>
                    <div className="text-xs text-gray-400">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {campaigns.length === 0 && (
          <p className="text-sm text-gray-400">No campaigns yet. Create a group and a template first.</p>
        )}
      </div>
    </div>
  );
}
