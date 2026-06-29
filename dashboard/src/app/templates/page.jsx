'use client';
import { useState, useRef } from 'react';
import useSWR from 'swr';
import { fetcher, post, patch, del } from '../../lib/api';

const CATEGORIES = ['outreach', 'followup', 'nurture', 'other'];

const VARIABLES = [
  { key: '{name}',      label: 'First name',  sample: 'Vaishnavi' },
  { key: '{full_name}', label: 'Full name',   sample: 'Vaishnavi Gawade' },
  { key: '{headline}',  label: 'Headline',    sample: 'Senior PM at Acme' },
  { key: '{company}',   label: 'Company',     sample: 'Acme Corp' },
];

function applyPreview(body) {
  let out = body;
  for (const { key, sample } of VARIABLES) out = out.replaceAll(key, sample);
  return out;
}

export default function TemplatesPage() {
  const { data, mutate } = useSWR('/templates', fetcher);
  const templates = data?.templates || [];

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', body: '', category: 'outreach' });
  const [preview, setPreview] = useState(null);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const textareaRef = useRef(null);

  function startCreate() {
    setEditingId(null);
    setForm({ name: '', body: '', category: 'outreach' });
    setCreating(true);
    setPreview(null);
    setShowLivePreview(false);
  }

  function startEdit(t) {
    setEditingId(t._id);
    setForm({ name: t.name, body: t.body, category: t.category });
    setCreating(true);
    setPreview(null);
    setShowLivePreview(false);
  }

  function cancelForm() {
    setCreating(false);
    setEditingId(null);
    setForm({ name: '', body: '', category: 'outreach' });
    setShowLivePreview(false);
  }

  function insertVariable(varKey) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const body  = form.body;
    const next  = body.slice(0, start) + varKey + body.slice(end);
    setForm(p => ({ ...p, body: next }));
    // Restore cursor after insertion
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + varKey.length, start + varKey.length);
    });
  }

  async function save(e) {
    e.preventDefault();
    if (editingId) {
      await patch(`/templates/${editingId}`, form);
    } else {
      await post('/templates', form);
    }
    cancelForm();
    mutate();
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this template?')) return;
    await del(`/templates/${id}`);
    mutate();
  }

  async function showPreview(id) {
    const res = await post(`/templates/${id}/preview`, {});
    setPreview(res.preview);
  }

  const detectedVars = [...new Set([...((form.body?.matchAll(/\{(\w+)\}/g)) || [])].map(m => m[1]))];

  return (
    <div className="p-6 overflow-auto flex-1">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Reusable messages · variables: <code className="text-xs bg-gray-100 px-1 rounded">{'{name}'}</code>{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">{'{headline}'}</code>{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">{'{company}'}</code>
          </p>
        </div>
        {!creating && (
          <button onClick={startCreate}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + New Template
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={save} className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold mb-4">{editingId ? 'Edit Template' : 'New Template'}</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input
                required
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="e.g. Cold Outreach v1"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-400"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">Message *</label>
              <button type="button" onClick={() => setShowLivePreview(p => !p)}
                className="text-xs text-blue-600 hover:text-blue-700">
                {showLivePreview ? 'Hide preview' : 'Preview'}
              </button>
            </div>
            {/* Variable insertion buttons */}
            <div className="flex gap-1.5 flex-wrap mb-2">
              {VARIABLES.map(v => (
                <button key={v.key} type="button" onClick={() => insertVariable(v.key)}
                  className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 border border-blue-100 font-mono">
                  {v.key}
                </button>
              ))}
            </div>
            <div className={`grid gap-3 ${showLivePreview ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <textarea
                ref={textareaRef}
                required
                value={form.body}
                onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                rows={7}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none outline-none focus:border-blue-400 font-mono"
                placeholder={`Hi {name},\n\nI came across your profile and…`}
              />
              {showLivePreview && (
                <div className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2.5 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  <div className="text-xs text-blue-600 font-medium mb-1.5">Preview (sample: Vaishnavi Gawade)</div>
                  {applyPreview(form.body) || <span className="text-gray-400">Start typing…</span>}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400">{detectedVars.length} variable{detectedVars.length !== 1 ? 's' : ''} detected</span>
              <span className="text-xs text-gray-400">{form.body.length} chars</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              {editingId ? 'Save changes' : 'Create'}
            </button>
            <button type="button" onClick={cancelForm}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </form>
      )}

      {preview && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-blue-700">Preview (sample contact: Alex Johnson, PM at Acme)</span>
            <button onClick={() => setPreview(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{preview}</p>
        </div>
      )}

      <div className="space-y-3">
        {templates.map(t => (
          <div key={t._id} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-sm">{t.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t.category}</span>
                </div>
                <div className="text-xs text-gray-400">Used {t.timesUsed}×</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => showPreview(t._id)}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Preview
                </button>
                <button onClick={() => startEdit(t)}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Edit
                </button>
                <button onClick={() => deleteTemplate(t._id)}
                  className="text-xs px-3 py-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                  Delete
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3 font-mono">{t.body}</p>
            {t.variables?.length > 0 && (
              <div className="flex gap-1 mt-3 flex-wrap">
                {t.variables.map(v => (
                  <span key={v} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                    {`{${v}}`}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {templates.length === 0 && (
          <p className="text-sm text-gray-400">No templates yet. Create one to use in campaigns.</p>
        )}
      </div>
    </div>
  );
}
