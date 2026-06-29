'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, post, del } from '../../lib/api';
import { sendToExtension } from '../../lib/extension';

function ComposeForm() {
  const searchParams = useSearchParams();
  const initialContactId = searchParams.get('contactId');

  const { data: tmplData } = useSWR('/templates', fetcher);
  const { data: tagsData, mutate: mutateTags } = useSWR('/contacts/tags', fetcher);
  const templates = tmplData?.templates || [];
  const allTags  = tagsData?.tags || [];

  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  // Load contact if URL param provided
  const { data: directContactData } = useSWR(
    initialContactId ? `/contacts/${initialContactId}` : null,
    fetcher
  );

  useEffect(() => {
    if (directContactData?.contact) {
      setSelectedContact(directContactData.contact);
    }
  }, [directContactData]);

  const { data: searchData } = useSWR(
    search.length > 1 ? `/contacts?search=${encodeURIComponent(search)}&limit=10` : null,
    fetcher
  );
  const results = searchData?.contacts || [];

  function applyTemplate(templateId) {
    const t = templates.find(t => t._id === templateId);
    if (!t || !selectedContact) return;
    const firstName = selectedContact.name.split(/[\s-]+/)[0];
    const formattedFirst = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    setMessage(
      t.body
        .replace(/\{name\}/g, formattedFirst)
        .replace(/\{full_name\}/g, selectedContact.name)
        .replace(/\{headline\}/g, selectedContact.headline || '')
        .replace(/\{company\}/g, selectedContact.company || '')
        .replace(/\{location\}/g, selectedContact.location || '')
    );
  }

  function insertVariable(varName) {
    setMessage(prev => prev + ` {${varName}}`);
  }

  async function addTag(e) {
    e.preventDefault();
    if (!tagInput.trim() || !selectedContact) return;
    const tag = tagInput.trim();
    const res = await post(`/contacts/${selectedContact._id}/tags`, { tag });
    if (res?.contact) {
      setSelectedContact(res.contact);
    } else {
      setSelectedContact(prev => ({
        ...prev,
        tags: Array.from(new Set([...(prev.tags || []), tag]))
      }));
    }
    setTagInput('');
    setShowTagInput(false);
    mutateTags();
  }

  async function removeTag(tag) {
    if (!selectedContact) return;
    const res = await del(`/contacts/${selectedContact._id}/tags/${encodeURIComponent(tag)}`);
    if (res?.contact) {
      setSelectedContact(res.contact);
    } else {
      setSelectedContact(prev => ({
        ...prev,
        tags: (prev.tags || []).filter(t => t !== tag)
      }));
    }
    mutateTags();
  }

  async function sendMessage() {
    if (!selectedContact || !message.trim()) return;
    setStatus('sending');

    const res = await sendToExtension({
      type: 'FORWARD_TO_CONTENT',
      payload: { type: 'SEND_SINGLE_MESSAGE', text: message },
    });
    if (res === null) {
      setStatus('no-extension');
    } else if (res?.success) {
      setStatus('sent');
      setMessage('');
    } else {
      setStatus('error');
    }
  }

  return (
    <div className="p-8 max-w-4xl overflow-auto flex-1 max-w-7xl mx-auto w-full">
      <div className="mb-8 pb-6 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Compose Message</h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">Send a one-off personalized message to any contact in your CRM</p>
      </div>

      {/* Recipient Selector Card */}
      <div className="mb-6 bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Target Recipient (To)</label>
        {selectedContact ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="font-bold text-sm text-slate-900">{selectedContact.name}</h3>
                  {selectedContact.company && (
                    <span className="text-[11px] px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
                      {selectedContact.company}
                    </span>
                  )}
                </div>
                {selectedContact.headline && (
                  <p className="text-xs text-slate-600 mt-1">{selectedContact.headline}</p>
                )}
                {selectedContact.location && (
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">Location: {selectedContact.location}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="text-xs px-3 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition-colors font-semibold border border-slate-200"
              >
                Change Recipient
              </button>
            </div>

            {/* Tags Strip in Recipient Card */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-slate-500 mr-1">Tags:</span>
                {selectedContact.tags?.length > 0 ? (
                  selectedContact.tags.map(t => (
                    <span key={t} className="text-xs px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 font-semibold flex items-center gap-1.5">
                      #{t}
                      <button
                        onClick={() => removeTag(t)}
                        className="text-indigo-400 hover:text-indigo-900 font-bold"
                      >
                        [remove]
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 font-medium">No tags assigned</span>
                )}
              </div>
              {!showTagInput && (
                <button
                  onClick={() => setShowTagInput(true)}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  + Add Tag
                </button>
              )}
            </div>

            {/* Tag Add Form */}
            {showTagInput && (
              <form onSubmit={addTag} className="mt-3 flex gap-2">
                <input
                  autoFocus
                  list="compose-tag-list"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  placeholder="Enter tag..."
                  className="text-xs border border-slate-300 rounded-md px-3 py-1.5 outline-none focus:border-blue-500 bg-white flex-1 font-medium"
                />
                <datalist id="compose-tag-list">
                  {allTags.filter(t => !selectedContact.tags?.includes(t)).map(t => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                <button type="submit" className="text-xs px-3.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowTagInput(false)}
                  className="text-xs px-2.5 py-1.5 text-slate-500 hover:text-slate-700 font-medium"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-3 text-xs outline-none focus:border-blue-500 shadow-xs font-medium text-slate-900 placeholder-slate-400"
              placeholder="Search contact by name, headline, or company..."
            />
            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto divide-y divide-slate-100">
                {results.map(c => (
                  <button
                    key={c._id}
                    onClick={() => { setSelectedContact(c); setSearch(''); }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start justify-between"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="text-xs font-bold text-slate-900">{c.name}</div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">{c.headline}</div>
                    </div>
                    {c.tags?.length > 0 && (
                      <div className="flex gap-1 flex-wrap justify-end shrink-0">
                        {c.tags.slice(0, 2).map(t => (
                          <span key={t} className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 font-medium">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Template Picker */}
      <div className="mb-6 bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Message Template (Optional)</label>
        <select
          value={selectedTemplate}
          onChange={e => { setSelectedTemplate(e.target.value); applyTemplate(e.target.value); }}
          className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs bg-white outline-none focus:border-blue-500 font-medium text-slate-800"
        >
          <option value="">Select a template to auto-fill content...</option>
          {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
      </div>

      {/* Message Editor */}
      <div className="mb-6 bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">Message Content</label>
          <div className="text-xs text-slate-400 font-medium">{message.length} characters</div>
        </div>

        {/* Dynamic Variable Helper Buttons */}
        <div className="flex items-center gap-2 flex-wrap mb-4 pb-3 border-b border-slate-100">
          <span className="text-xs text-slate-400 font-medium">Insert variable:</span>
          {['name', 'full_name', 'headline', 'company', 'location'].map(v => (
            <button
              key={v}
              type="button"
              onClick={() => insertVariable(v)}
              className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-mono font-medium transition-colors"
            >
              {`{${v}}`}
            </button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={8}
          className="w-full border border-slate-300 rounded-lg p-4 text-xs resize-none outline-none focus:border-blue-500 leading-relaxed text-slate-900 placeholder-slate-400 font-medium"
          placeholder="Write your message content..."
        />
      </div>

      {/* Send Action */}
      <button
        onClick={sendMessage}
        disabled={!selectedContact || !message.trim() || status === 'sending'}
        className="w-full py-3.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all uppercase tracking-wider shadow-sm"
      >
        {status === 'sending' ? 'Dispatching Message...' : 'Send Message via LinkedIn'}
      </button>

      {status === 'sent' && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 text-center font-semibold">
          Message dispatched successfully.
        </div>
      )}
      {status === 'error' && (
        <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 text-center font-semibold">
          Error: Unable to dispatch message. Verify LinkedIn is open in an active tab.
        </div>
      )}
      {status === 'no-extension' && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 text-center font-semibold">
          Notice: LinkedIn CRM extension not detected.
        </div>
      )}
    </div>
  );
}

export default function ComposePage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-slate-500 text-xs">Loading Compose...</div>}>
      <ComposeForm />
    </Suspense>
  );
}
