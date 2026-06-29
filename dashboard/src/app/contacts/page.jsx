'use client';
import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { fetcher, patch, post, del } from '../../lib/api';

const STATUS_COLORS = {
  new:         'bg-gray-100 text-gray-500',
  contacted:   'bg-blue-100 text-blue-700',
  replied:     'bg-green-100 text-green-700',
  not_replied: 'bg-amber-100 text-amber-700',
  converted:   'bg-purple-100 text-purple-700',
  archived:    'bg-gray-200 text-gray-500',
};
const STATUS_DOT = {
  new:         'bg-gray-400',
  contacted:   'bg-blue-500',
  replied:     'bg-green-500',
  not_replied: 'bg-amber-500',
  converted:   'bg-purple-500',
  archived:    'bg-gray-400',
};
const STATUSES = ['new', 'contacted', 'replied', 'not_replied', 'converted', 'archived'];

const TAG_PALETTE = [
  '#0a66c2','#7c3aed','#db2777','#dc2626','#d97706',
  '#16a34a','#0891b2','#64748b',
];

function initials(name = '') {
  return name.split(/[\s-]+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}
function avatarColor(name = '') {
  const colors = ['#0a66c2','#7c3aed','#db2777','#16a34a','#d97706','#0891b2'];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return colors[h % colors.length];
}

export default function ContactsPage() {
  const [search, setSearch]         = useState('');
  const [status, setStatus]         = useState('');
  const [group, setGroup]           = useState('');
  const [tag, setTag]               = useState('');
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState(null);  // contact detail panel
  const [newTag, setNewTag]         = useState('');
  const [addingTag, setAddingTag]   = useState(false);
  const [newGlobalTag, setNewGlobalTag] = useState('');

  const params = new URLSearchParams({ page, limit: 50 });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (group)  params.set('group', group);
  if (tag)    params.set('tag', tag);

  const { data, mutate }      = useSWR(`/contacts?${params}`, fetcher, { refreshInterval: 30000 });
  const { data: groupsData }  = useSWR('/groups', fetcher);
  const { data: tagsData, mutate: mutateTags } = useSWR('/contacts/tags', fetcher);

  const contacts = data?.contacts || [];
  const groups   = groupsData?.groups || [];
  const allTags  = tagsData?.tags || [];

  // Refresh selected contact when list changes
  const refreshSelected = useCallback(async (id) => {
    const res = await fetcher(`/contacts/${id}`);
    setSelected(res.contact);
  }, []);

  async function updateStatus(id, newStatus) {
    await patch(`/contacts/${id}`, { status: newStatus });
    mutate();
    if (selected?._id === id) refreshSelected(id);
  }

  async function updateNotes(id, notes) {
    await patch(`/contacts/${id}`, { notes });
    if (selected?._id === id) setSelected(s => ({ ...s, notes }));
  }

  async function addTag(contactId, tag) {
    if (!tag.trim()) return;
    const { contact } = await post(`/contacts/${contactId}/tags`, { tag: tag.trim() });
    mutate(); mutateTags();
    if (selected?._id === contactId) setSelected(contact);
  }

  async function removeTag(contactId, tag) {
    const { contact } = await del(`/contacts/${contactId}/tags/${encodeURIComponent(tag)}`);
    mutate(); mutateTags();
    if (selected?._id === contactId) setSelected(contact);
  }

  async function deleteContact(id) {
    if (!confirm('Delete this contact? This cannot be undone.')) return;
    await del(`/contacts/${id}`);
    mutate();
    if (selected?._id === id) setSelected(null);
  }

  async function openDetail(c) {
    const res = await fetcher(`/contacts/${c._id}`);
    setSelected(res.contact);
  }

  return (
    <div className="flex h-full">
      {/* ── Main list ── */}
      <div className={`flex-1 min-w-0 p-6 overflow-auto transition-all ${selected ? 'pr-3' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold">Contacts</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {data?.total ?? 0} total · visit a LinkedIn profile to add contacts automatically
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 w-56"
            placeholder="Search name, headline…"
          />
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-400">
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select value={group} onChange={e => { setGroup(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-400">
            <option value="">All groups</option>
            {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
          </select>
          {allTags.length > 0 && (
            <select value={tag} onChange={e => { setTag(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-400">
              <option value="">All tags</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {(search || status || group || tag) && (
            <button onClick={() => { setSearch(''); setStatus(''); setGroup(''); setTag(''); setPage(1); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2">
              ✕ Clear
            </button>
          )}
        </div>

        {/* Tag pill strip */}
        {allTags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-4">
            {allTags.map(t => (
              <button key={t} onClick={() => setTag(tag === t ? '' : t)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  tag === t
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                }`}>
                # {t}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Contact', 'Status', 'Tags', 'Last activity', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map(c => (
                <tr key={c._id}
                  onClick={() => openDetail(c)}
                  className={`cursor-pointer transition-colors ${
                    selected?._id === c._id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}>
                  {/* Contact */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                        style={{ background: avatarColor(c.name) }}>
                        {initials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[200px]">{c.headline}</div>
                      </div>
                    </div>
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <select value={c.status}
                      onChange={e => updateStatus(c._id, e.target.value)}
                      className={`text-xs px-2.5 py-1 rounded-full border-0 cursor-pointer outline-none font-medium ${STATUS_COLORS[c.status]}`}>
                      {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  {/* Tags */}
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {c.tags?.map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  {/* Last activity */}
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {c.lastMessageAt
                      ? new Date(c.lastMessageAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })
                      : '—'}
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => deleteContact(c._id)}
                      className="text-xs text-red-400 hover:text-red-600">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No contacts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data?.pages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: data.pages }, (_, i) => (
              <button key={i + 1} onClick={() => setPage(i + 1)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  page === i + 1 ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 hover:bg-gray-50'
                }`}>
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Detail panel ── */}
      {selected && (
        <DetailPanel
          contact={selected}
          groups={groups}
          allTags={allTags}
          onClose={() => setSelected(null)}
          onStatusChange={updateStatus}
          onNotesChange={updateNotes}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          onDelete={deleteContact}
        />
      )}
    </div>
  );
}

/* ── Detail slide-over panel ─────────────────────────────────────────────── */
function DetailPanel({ contact, groups, allTags, onClose, onStatusChange, onNotesChange, onAddTag, onRemoveTag, onDelete }) {
  const [notes, setNotes]         = useState(contact.notes || '');
  const [notesDirty, setNotesDirty] = useState(false);
  const [tagInput, setTagInput]   = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  // Sync notes when contact changes
  if (notes !== (contact.notes || '') && !notesDirty) {
    setNotes(contact.notes || '');
  }

  async function saveNotes() {
    await onNotesChange(contact._id, notes);
    setNotesDirty(false);
  }

  async function submitTag(e) {
    e.preventDefault();
    if (!tagInput.trim()) return;
    await onAddTag(contact._id, tagInput.trim());
    setTagInput('');
    setShowTagInput(false);
  }

  const c = contact;
  const initStr = initials(c.name);
  const bgColor = avatarColor(c.name);

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-base flex-shrink-0"
              style={{ background: bgColor }}>
              {initStr}
            </div>
            <div>
              <h2 className="font-semibold text-sm leading-tight">{c.name}</h2>
              {c.company && <p className="text-xs text-gray-500 mt-0.5">{c.company}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        {c.headline && (
          <p className="text-xs text-gray-500 leading-relaxed mb-3">{c.headline}</p>
        )}

        <div className="flex gap-2 flex-wrap">
          <a href={c.profileUrl} target="_blank" rel="noreferrer"
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
            <span>LinkedIn ↗</span>
          </a>
          <select value={c.status} onChange={e => onStatusChange(c._id, e.target.value)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border-0 cursor-pointer outline-none font-medium ${STATUS_COLORS[c.status]}`}>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Tags */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tags</span>
            <button onClick={() => setShowTagInput(!showTagInput)}
              className="text-xs text-blue-600 hover:text-blue-700">
              + Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {c.tags?.length > 0 ? c.tags.map(t => (
              <span key={t} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 flex items-center gap-1 group">
                {t}
                <button onClick={() => onRemoveTag(c._id, t)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 hover:text-indigo-600 leading-none">
                  ×
                </button>
              </span>
            )) : <span className="text-xs text-gray-400">No tags</span>}
          </div>
          {showTagInput && (
            <form onSubmit={submitTag} className="mt-2 flex gap-1.5">
              <input
                autoFocus
                list="tag-suggestions"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="e.g. investor, warm lead…"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400"
              />
              <datalist id="tag-suggestions">
                {allTags.filter(t => !c.tags?.includes(t)).map(t => <option key={t} value={t} />)}
              </datalist>
              <button type="submit" className="text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Add
              </button>
            </form>
          )}
        </div>

        {/* Groups */}
        {c.groups?.length > 0 && (
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Groups</span>
            <div className="flex flex-wrap gap-1.5">
              {c.groups.map(g => (
                <span key={g._id} className="text-xs px-2 py-0.5 rounded-full text-white"
                  style={{ background: g.color }}>
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Activity</span>
          <div className="space-y-2">
            {c.lastReplyAt && (
              <TimelineItem
                color="bg-green-500"
                label="Replied"
                date={c.lastReplyAt}
                preview={c.replyPreview}
              />
            )}
            {c.lastMessageAt && (
              <TimelineItem
                color="bg-blue-500"
                label="Messaged"
                date={c.lastMessageAt}
              />
            )}
            <TimelineItem
              color="bg-gray-300"
              label="Added to CRM"
              date={c.createdAt}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</span>
            {notesDirty && (
              <button onClick={saveNotes}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Save
              </button>
            )}
          </div>
          <textarea
            value={notes}
            onChange={e => { setNotes(e.target.value); setNotesDirty(true); }}
            onBlur={() => notesDirty && saveNotes()}
            placeholder="Add notes about this contact…"
            rows={4}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 resize-none text-gray-700 placeholder-gray-300"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100">
        <button onClick={() => onDelete(c._id)}
          className="w-full text-xs py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
          Delete contact
        </button>
      </div>
    </div>
  );
}

function TimelineItem({ color, label, date, preview }) {
  return (
    <div className="flex items-start gap-2">
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${color}`} />
      <div className="min-w-0">
        <div className="text-xs text-gray-700">{label}
          <span className="text-gray-400 ml-1">
            {new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        {preview && (
          <div className="text-xs text-gray-400 truncate mt-0.5">"{preview}"</div>
        )}
      </div>
    </div>
  );
}
