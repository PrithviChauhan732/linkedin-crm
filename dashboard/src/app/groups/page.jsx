'use client';
import { useState, useRef, useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher, post, patch, del } from '../../lib/api';

// ── Default columns every group gets ──────────────────────────────────────────
const DEFAULT_COLS = [
  { key: 'name',       label: 'Name',       width: 180, editable: true,  type: 'text' },
  { key: 'headline',   label: 'Role / Title', width: 200, editable: true, type: 'text' },
  { key: 'company',    label: 'Company',    width: 160, editable: true,  type: 'text' },
  { key: 'status',     label: 'Status',     width: 120, editable: true,  type: 'select',
    options: ['new', 'contacted', 'replied', 'interested', 'closed', 'not_interested'] },
  { key: 'tags',       label: 'Tags',       width: 160, editable: false, type: 'tags' },
  { key: 'profileUrl', label: 'LinkedIn',   width: 120, editable: false, type: 'link' },
  { key: 'addedAt',    label: 'Added',      width: 100, editable: false, type: 'date' },
];

const STATUS_COLORS = {
  new:             'bg-slate-100 text-slate-600',
  contacted:       'bg-blue-100 text-blue-700',
  replied:         'bg-indigo-100 text-indigo-700',
  interested:      'bg-emerald-100 text-emerald-700',
  closed:          'bg-purple-100 text-purple-700',
  not_interested:  'bg-rose-100 text-rose-600',
};

export default function GroupsPage() {
  const { data: groupData, mutate: mutateGroups } = useSWR('/groups', fetcher);
  const groups = groupData?.groups || [];

  const [activeGroupId, setActiveGroupId] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', color: '#2563eb' });

  // Active group's contacts
  const activeGroup = groups.find(g => g._id === (activeGroupId || groups[0]?._id)) || groups[0];
  const { data: contactData, mutate: mutateContacts } = useSWR(
    activeGroup ? `/contacts?group=${activeGroup._id}&limit=500` : null,
    fetcher,
    { refreshInterval: 20000 }
  );
  const contacts = contactData?.contacts || [];

  // Extra user-defined columns (stored in localStorage per group)
  const extraColsKey = `lcrm_extra_cols_${activeGroup?._id}`;
  const [extraCols, setExtraCols] = useState(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(extraColsKey) || '[]'); } catch { return []; }
  });
  const allCols = [...DEFAULT_COLS, ...extraCols];

  // Extra cell data (local overrides for custom columns)
  const extraDataKey = `lcrm_extra_data_${activeGroup?._id}`;
  const [extraData, setExtraData] = useState(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(extraDataKey) || '{}'); } catch { return {}; }
  });

  // Add column modal
  const [showAddCol, setShowAddCol] = useState(false);
  const [newCol, setNewCol] = useState({ label: '', type: 'text', width: 140 });

  // Inline editing state
  const [editCell, setEditCell] = useState(null); // { contactId, key }
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef(null);

  // ── Group CRUD ───────────────────────────────────────────────────────────────
  async function createGroup(e) {
    e.preventDefault();
    if (!groupForm.name.trim()) return;
    const res = await post('/groups', groupForm);
    setGroupForm({ name: '', description: '', color: '#2563eb' });
    setShowCreateGroup(false);
    mutateGroups();
    if (res.group) setActiveGroupId(res.group._id);
  }

  async function deleteGroup(id) {
    if (!confirm('Delete this group? Contacts will NOT be deleted.')) return;
    await del(`/groups/${id}`);
    mutateGroups();
    if (activeGroupId === id) setActiveGroupId(null);
  }

  // ── Cell editing ─────────────────────────────────────────────────────────────
  function startEdit(contactId, key, currentValue) {
    const col = allCols.find(c => c.key === key);
    if (!col?.editable) return;
    setEditCell({ contactId, key });
    setEditValue(currentValue || '');
    setTimeout(() => editInputRef.current?.focus(), 30);
  }

  async function commitEdit(contactId, key) {
    setEditCell(null);
    const col = DEFAULT_COLS.find(c => c.key === key);
    if (col) {
      // Backend field
      await patch(`/contacts/${contactId}`, { [key]: editValue });
      mutateContacts();
    } else {
      // Custom column — persist locally
      const updated = { ...extraData, [`${contactId}_${key}`]: editValue };
      setExtraData(updated);
      localStorage.setItem(extraDataKey, JSON.stringify(updated));
    }
  }

  // ── Add custom column ─────────────────────────────────────────────────────────
  function addColumn() {
    if (!newCol.label.trim()) return;
    const key = 'custom_' + newCol.label.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
    const col = { key, label: newCol.label, width: Number(newCol.width) || 140, editable: true, type: newCol.type };
    const updated = [...extraCols, col];
    setExtraCols(updated);
    localStorage.setItem(extraColsKey, JSON.stringify(updated));
    setNewCol({ label: '', type: 'text', width: 140 });
    setShowAddCol(false);
  }

  function removeColumn(key) {
    const updated = extraCols.filter(c => c.key !== key);
    setExtraCols(updated);
    localStorage.setItem(extraColsKey, JSON.stringify(updated));
  }

  function getCellValue(contact, key) {
    if (DEFAULT_COLS.find(c => c.key === key)) return contact[key];
    return extraData[`${contact._id}_${key}`] || '';
  }

  // ── Render helpers ────────────────────────────────────────────────────────────
  function renderCell(contact, col) {
    const isEditing = editCell?.contactId === contact._id && editCell?.key === col.key;
    const value = getCellValue(contact, col.key);

    if (isEditing) {
      if (col.type === 'select') {
        return (
          <select
            ref={editInputRef}
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => commitEdit(contact._id, col.key)}
            className="w-full h-full text-xs outline-none bg-blue-50 border-0 p-1 rounded"
          >
            {col.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      }
      return (
        <input
          ref={editInputRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={() => commitEdit(contact._id, col.key)}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(contact._id, col.key); if (e.key === 'Escape') setEditCell(null); }}
          className="w-full text-xs outline-none bg-blue-50 border-0 p-1 rounded"
        />
      );
    }

    // Display mode
    switch (col.type) {
      case 'status':
      case 'select':
        return value ? (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_COLORS[value] || 'bg-slate-100 text-slate-600'}`}>
            {value}
          </span>
        ) : <span className="text-slate-300 text-xs">—</span>;

      case 'tags':
        return value?.length > 0 ? (
          <div className="flex gap-1 flex-wrap">
            {(Array.isArray(value) ? value : [value]).map(t => (
              <span key={t} className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded font-semibold">#{t}</span>
            ))}
          </div>
        ) : <span className="text-slate-300 text-xs">—</span>;

      case 'link':
        return value ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline truncate block">
            View →
          </a>
        ) : <span className="text-slate-300 text-xs">—</span>;

      case 'date':
        return value ? (
          <span className="text-[10px] text-slate-400">{new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
        ) : <span className="text-slate-300 text-xs">—</span>;

      default:
        return <span className="text-xs text-slate-700 truncate block">{value || <span className="text-slate-300">—</span>}</span>;
    }
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden font-sans">

      {/* ── Sidebar: group list ─────────────────────────────────────────── */}
      <div className="w-56 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-sm font-bold text-slate-900">Groups</h1>
            <button
              onClick={() => setShowCreateGroup(v => !v)}
              className="text-[10px] font-bold px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + New
            </button>
          </div>
          <p className="text-[10px] text-slate-400">Select a group to open its sheet</p>
        </div>

        {/* Create form */}
        {showCreateGroup && (
          <form onSubmit={createGroup} className="p-3 border-b border-slate-200 bg-white space-y-2">
            <input
              required
              value={groupForm.name}
              onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Group name"
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 outline-none focus:border-blue-400"
            />
            <div className="flex gap-2">
              <input
                type="color"
                value={groupForm.color}
                onChange={e => setGroupForm(p => ({ ...p, color: e.target.value }))}
                className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
              />
              <input
                value={groupForm.description}
                onChange={e => setGroupForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Description (opt.)"
                className="flex-1 text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex gap-1.5">
              <button type="submit" className="flex-1 text-[10px] font-bold py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create</button>
              <button type="button" onClick={() => setShowCreateGroup(false)} className="flex-1 text-[10px] font-bold py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">Cancel</button>
            </div>
          </form>
        )}

        {/* Group list */}
        <div className="flex-1 overflow-y-auto py-1">
          {groups.map(g => (
            <button
              key={g._id}
              onClick={() => { setActiveGroupId(g._id); setExtraCols(() => { try { return JSON.parse(localStorage.getItem(`lcrm_extra_cols_${g._id}`) || '[]'); } catch { return []; } }); setExtraData(() => { try { return JSON.parse(localStorage.getItem(`lcrm_extra_data_${g._id}`) || '{}'); } catch { return {}; } }); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${(activeGroup?._id === g._id) ? 'bg-blue-50 border-r-2 border-blue-500' : 'hover:bg-slate-100'}`}
            >
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.color || '#2563eb' }} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-800 truncate">{g.name}</div>
                <div className="text-[10px] text-slate-400">{g.contactCount ?? 0} contacts</div>
              </div>
            </button>
          ))}
          {groups.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-slate-400">No groups yet</div>
          )}
        </div>
      </div>

      {/* ── Main: spreadsheet ───────────────────────────────────────────── */}
      {activeGroup ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: activeGroup.color || '#2563eb' }} />
              <div>
                <h2 className="text-sm font-bold text-slate-900">{activeGroup.name}</h2>
                <p className="text-[10px] text-slate-400">{contacts.length} contacts · click any cell to edit</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddCol(true)}
                className="text-[10px] font-bold px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                Add Column
              </button>
              <Link
                href={`/contacts?group=${activeGroup._id}`}
                className="text-[10px] font-bold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Manage Contacts
              </Link>
              <button
                onClick={() => deleteGroup(activeGroup._id)}
                className="text-[10px] font-bold px-3 py-1.5 bg-rose-50 text-rose-500 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
              >
                Delete Group
              </button>
            </div>
          </div>

          {/* Spreadsheet table */}
          <div className="flex-1 overflow-auto">
            <table className="border-collapse text-xs" style={{ minWidth: allCols.reduce((s, c) => s + c.width, 48) + 'px' }}>
              {/* Head */}
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100 border-b-2 border-slate-300">
                  <th className="w-10 min-w-[40px] border-r border-slate-300 px-2 py-2 text-center text-[10px] text-slate-500 font-bold bg-slate-100">#</th>
                  {allCols.map(col => (
                    <th
                      key={col.key}
                      style={{ width: col.width, minWidth: col.width }}
                      className="border-r border-slate-300 px-2.5 py-2 text-left font-bold text-[10px] text-slate-600 uppercase tracking-wider bg-slate-100 select-none"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>{col.label}</span>
                        {extraCols.find(c => c.key === col.key) && (
                          <button
                            onClick={() => removeColumn(col.key)}
                            className="text-slate-400 hover:text-rose-500 leading-none text-[9px] font-black"
                            title="Remove column"
                          >✕</button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {contacts.map((contact, rowIdx) => (
                  <tr
                    key={contact._id}
                    className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                  >
                    {/* Row number */}
                    <td className="border-r border-slate-200 px-2 py-1.5 text-center text-[10px] text-slate-400 font-mono select-none">{rowIdx + 1}</td>

                    {allCols.map(col => (
                      <td
                        key={col.key}
                        style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
                        onClick={() => col.editable && startEdit(contact._id, col.key, getCellValue(contact, col.key))}
                        className={`border-r border-slate-200 px-2.5 py-1.5 overflow-hidden ${col.editable ? 'cursor-text hover:bg-blue-50 hover:ring-1 hover:ring-inset hover:ring-blue-300' : ''} ${editCell?.contactId === contact._id && editCell?.key === col.key ? 'ring-2 ring-inset ring-blue-400 bg-blue-50' : ''}`}
                      >
                        {renderCell(contact, col)}
                      </td>
                    ))}
                  </tr>
                ))}

                {contacts.length === 0 && (
                  <tr>
                    <td colSpan={allCols.length + 1} className="py-16 text-center text-sm text-slate-400">
                      No contacts in this group yet.<br />
                      <Link href="/contacts" className="text-blue-500 hover:underline text-xs mt-1 inline-block">Add contacts from the Contacts page →</Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add Column Modal */}
          {showAddCol && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-80 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Add Column</h3>
                  <button onClick={() => setShowAddCol(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Column Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Notes, Follow-up Date, Score"
                    value={newCol.label}
                    onChange={e => setNewCol(p => ({ ...p, label: e.target.value }))}
                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && addColumn()}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Type</label>
                    <select
                      value={newCol.type}
                      onChange={e => setNewCol(p => ({ ...p, type: e.target.value }))}
                      className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Width (px)</label>
                    <input
                      type="number"
                      value={newCol.width}
                      min={80} max={400}
                      onChange={e => setNewCol(p => ({ ...p, width: e.target.value }))}
                      className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowAddCol(false)} className="flex-1 text-xs py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">Cancel</button>
                  <button onClick={addColumn} className="flex-1 text-xs py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700">Add Column</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="text-slate-300 text-4xl mb-3">📋</div>
            <div className="text-sm text-slate-500 font-medium">Select a group to open its spreadsheet</div>
            <button onClick={() => setShowCreateGroup(true)} className="mt-3 text-xs text-blue-600 hover:underline font-semibold">
              or create your first group →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
