'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, patch, post, del } from '../../lib/api';

const COLOR_OPTIONS = [
  { label: 'Slate Gray', class: 'border-t-slate-400 bg-slate-100/40' },
  { label: 'Ocean Blue', class: 'border-t-blue-500 bg-blue-50/30' },
  { label: 'Emerald Green', class: 'border-t-emerald-500 bg-emerald-50/30' },
  { label: 'Amber Orange', class: 'border-t-amber-500 bg-amber-50/30' },
  { label: 'Purple Gem', class: 'border-t-purple-500 bg-purple-50/30' },
  { label: 'Indigo Velvet', class: 'border-t-indigo-600 bg-indigo-50/40' },
  { label: 'Rose Red', class: 'border-t-rose-500 bg-rose-50/30' },
  { label: 'Teal Cyan', class: 'border-t-teal-500 bg-teal-50/30' },
];

export default function PipelinePage() {
  const { data: pipelineData, mutate: mutatePipelines } = useSWR('/pipelines', fetcher);
  const { data: contactData, mutate: mutateContacts } = useSWR('/contacts?limit=200', fetcher, { refreshInterval: 10000 });

  const pipelines = pipelineData?.pipelines || [];
  const contacts = contactData?.contacts || [];

  const [activePipelineId, setActivePipelineId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // New Pipeline Form
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelineDesc, setNewPipelineDesc] = useState('');

  // Editing Stages Form
  const [editingStages, setEditingStages] = useState([]);
  const [newStageLabel, setNewStageLabel] = useState('');
  const [newStageColor, setNewStageColor] = useState(COLOR_OPTIONS[0].class);

  const activePipeline = pipelines.find(p => p._id === activePipelineId) || pipelines[0] || { stages: [] };

  async function handleCreatePipeline(e) {
    e.preventDefault();
    if (!newPipelineName.trim()) return;
    const res = await post('/pipelines', { name: newPipelineName, description: newPipelineDesc });
    setNewPipelineName('');
    setNewPipelineDesc('');
    setShowCreateModal(false);
    mutatePipelines();
    if (res.pipeline) setActivePipelineId(res.pipeline._id);
  }

  function openEditModal() {
    setEditingStages([...(activePipeline.stages || [])]);
    setShowEditModal(true);
  }

  function handleAddStage() {
    if (!newStageLabel.trim()) return;
    const newStage = {
      id: newStageLabel.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4),
      label: newStageLabel,
      color: newStageColor,
      order: editingStages.length,
    };
    setEditingStages([...editingStages, newStage]);
    setNewStageLabel('');
  }

  function handleRemoveStage(index) {
    setEditingStages(editingStages.filter((_, i) => i !== index));
  }

  async function handleSaveStages() {
    await patch(`/pipelines/${activePipeline._id}`, { stages: editingStages });
    setShowEditModal(false);
    mutatePipelines();
  }

  async function moveStage(contactId, newStatus) {
    await patch(`/contacts/${contactId}`, { status: newStatus });
    mutateContacts();
  }

  return (
    <div className="p-8 flex flex-col h-full overflow-hidden max-w-7xl mx-auto w-full font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pipeline Management</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Customize stages and track prospects across outreach conversion workflows
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Pipeline Selector */}
          <select
            value={activePipeline._id || ''}
            onChange={e => setActivePipelineId(e.target.value)}
            className="text-xs font-bold bg-white border border-slate-300 text-slate-800 rounded-lg px-3.5 py-2 outline-none shadow-xs cursor-pointer"
          >
            {pipelines.map(p => (
              <option key={p._id} value={p._id}>
                Pipeline: {p.name} {p.isDefault ? '(Default)' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={openEditModal}
            className="text-xs px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold shadow-xs transition-all"
          >
            ⚙️ Customize Stages
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="text-xs px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition-all"
          >
            + New Pipeline
          </button>
        </div>
      </div>

      {/* Pipeline Kanban Columns */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4 items-start">
        {(activePipeline.stages || []).map(stage => {
          const stageContacts = contacts.filter(c => (c.status || 'new') === stage.id);
          return (
            <div
              key={stage.id}
              className={`w-72 shrink-0 rounded-xl border border-slate-200 border-t-4 p-4 flex flex-col max-h-full ${stage.color || 'border-t-slate-400 bg-slate-100/40'}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3.5 shrink-0 pb-2 border-b border-slate-200/60">
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate max-w-[170px]">
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
                    <div className="pt-2.5 border-t border-slate-100">
                      <select
                        value={contact.status || 'new'}
                        onChange={e => moveStage(contact._id, e.target.value)}
                        className="text-[11px] py-1.5 px-2 border border-slate-200 rounded-md bg-slate-50 text-slate-700 outline-none cursor-pointer focus:border-blue-500 font-medium w-full"
                      >
                        {(activePipeline.stages || []).map(s => (
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

      {/* Modal 1: Create Pipeline */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Create Custom Pipeline</h2>
            <form onSubmit={handleCreatePipeline} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pipeline Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Executive Sales, Investor Outreach"
                  value={newPipelineName}
                  onChange={e => setNewPipelineName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Brief workflow summary"
                  value={newPipelineDesc}
                  onChange={e => setNewPipelineDesc(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-xs px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-xs"
                >
                  Create Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Customize Stages */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Customize Pipeline Stages</h2>
                <p className="text-xs text-slate-500">{activePipeline.name}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
            </div>

            {/* Current Stages List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <label className="block text-xs font-bold text-slate-700 mb-2">Current Stages</label>
              {editingStages.map((st, idx) => (
                <div key={st.id || idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}.</span>
                    <input
                      type="text"
                      value={st.label}
                      onChange={e => {
                        const updated = [...editingStages];
                        updated[idx].label = e.target.value;
                        setEditingStages(updated);
                      }}
                      className="text-xs font-bold text-slate-800 bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none px-1 py-0.5"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveStage(idx)}
                    className="text-xs text-rose-500 hover:text-rose-700 font-bold px-2"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Stage Controls */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-700">Add New Stage</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Stage Label (e.g. Interview Scheduled)"
                  value={newStageLabel}
                  onChange={e => setNewStageLabel(e.target.value)}
                  className="flex-1 text-xs p-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                />
                <select
                  value={newStageColor}
                  onChange={e => setNewStageColor(e.target.value)}
                  className="text-xs p-2 border border-slate-300 rounded-lg outline-none bg-white font-medium"
                >
                  {COLOR_OPTIONS.map(c => (
                    <option key={c.label} value={c.class}>{c.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddStage}
                  className="text-xs px-3 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowEditModal(false)}
                className="text-xs px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStages}
                className="text-xs px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-xs"
              >
                Save Pipeline Stages
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
