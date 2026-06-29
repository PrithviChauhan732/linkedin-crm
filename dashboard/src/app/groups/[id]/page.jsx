'use client';
import useSWR from 'swr';
import { fetcher } from '../../../lib/api';

const STATUS_COLORS = {
  new:         'bg-gray-100 text-gray-600',
  contacted:   'bg-blue-100 text-blue-700',
  replied:     'bg-green-100 text-green-700',
  not_replied: 'bg-yellow-100 text-yellow-700',
  converted:   'bg-purple-100 text-purple-700',
  archived:    'bg-gray-200 text-gray-500',
};

export default function GroupContactsPage({ params }) {
  const { id } = params;

  const { data: groupsData } = useSWR('/groups', fetcher);
  const { data }             = useSWR(`/groups/${id}/contacts`, fetcher);

  const contacts = data?.contacts || [];
  const group    = groupsData?.groups?.find(g => g._id === id);

  return (
    <div className="p-6 overflow-auto flex-1">
      <div className="mb-6">
        <a href="/groups" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          ← Back to Groups
        </a>
        <h1 className="text-xl font-semibold mt-2 flex items-center gap-2">
          {group && (
            <span
              className="w-3 h-3 rounded-full inline-block shrink-0"
              style={{ background: group.color }}
            />
          )}
          {group?.name ?? 'Group'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{contacts.length} contacts</p>
      </div>

      <div className="flex gap-3 mb-5">
        <a
          href={`/campaigns?group=${id}`}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create campaign for this group
        </a>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Name', 'Headline', 'Status', 'Last Message', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contacts.map(c => (
              <tr key={c._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <a
                    href={c.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:text-blue-600 transition-colors"
                  >
                    {c.name}
                  </a>
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{c.headline}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={c.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Open LinkedIn
                  </a>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No contacts in this group yet. Add contacts via the extension.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
