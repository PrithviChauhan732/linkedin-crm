'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, post, del } from '../../lib/api';

export default function GroupsPage() {
  const { data, mutate } = useSWR('/groups', fetcher);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: '#0a66c2' });

  const groups = data?.groups || [];

  async function createGroup(e) {
    e.preventDefault();
    await post('/groups', form);
    setForm({ name: '', description: '', color: '#0a66c2' });
    setCreating(false);
    mutate();
  }

  async function deleteGroup(id) {
    if (!confirm('Delete this group? Contacts will not be deleted.')) return;
    await del(`/groups/${id}`);
    mutate();
  }

  return (
    <div className="p-6 overflow-auto flex-1">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Groups</h1>
          <p className="text-sm text-gray-500 mt-0.5">Organize contacts into segments for targeted outreach</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          + New Group
        </button>
      </div>

      {/* Create Form */}
      {creating && (
        <form onSubmit={createGroup} className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold mb-4">Create Group</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Group Name *</label>
              <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="e.g. PM Recruiters, IIT Alumni" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Color</label>
              <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                className="h-9 w-full rounded-lg border border-gray-200 cursor-pointer" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="Optional" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Create</button>
            <button type="button" onClick={() => setCreating(false)}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
          </div>
        </form>
      )}

      {/* Groups Grid */}
      <div className="grid grid-cols-3 gap-4">
        {groups.map(g => (
          <div key={g._id} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full" style={{ background: g.color }} />
              <h3 className="font-semibold text-sm">{g.name}</h3>
            </div>
            {g.description && <p className="text-xs text-gray-500 mb-3">{g.description}</p>}
            <div className="text-xs text-gray-400 mb-4">{g.contactCount ?? 0} contacts</div>
            <div className="flex gap-2">
              <a href={`/groups/${g._id}`}
                className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                View contacts
              </a>
              <a href={`/campaigns?group=${g._id}`}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                Campaign
              </a>
              <button onClick={() => deleteGroup(g._id)}
                className="text-xs px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg ml-auto">
                Delete
              </button>
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-sm text-gray-400 col-span-3">No groups yet. Create one to start segmenting your contacts.</p>
        )}
      </div>
    </div>
  );
}
