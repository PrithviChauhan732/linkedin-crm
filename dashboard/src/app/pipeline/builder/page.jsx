'use client';
import { useState, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher, patch, post } from '../../../lib/api';

const NODE_TYPES = {
  trigger:      { label: 'Trigger Event', color: 'border-blue-500 bg-blue-50 text-blue-900', icon: '⚡' },
  ml_condition: { label: 'ML Classifier', color: 'border-purple-500 bg-purple-50 text-purple-900', icon: '🧠' },
  action:       { label: 'Action Node', color: 'border-emerald-500 bg-emerald-50 text-emerald-900', icon: '🎯' },
};

export default function WorkflowBuilderPage() {
  const { data: wfData, mutate } = useSWR('/workflows', fetcher);
  const workflows = wfData?.workflows || [];
  const activeWorkflow = workflows[0] || { nodes: [], edges: [] };

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);

  // Sync loaded workflow into local state when available
  const loadedIdRef = useRef(null);
  if (activeWorkflow._id && loadedIdRef.current !== activeWorkflow._id) {
    loadedIdRef.current = activeWorkflow._id;
    setNodes(activeWorkflow.nodes || []);
    setEdges(activeWorkflow.edges || []);
  }

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  function handleMouseDown(e, nodeId) {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setDraggedNodeId(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    setDragOffset({
      x: e.clientX - (node?.position?.x || 0),
      y: e.clientY - (node?.position?.y || 0),
    });
  }

  function handleMouseMove(e) {
    if (!draggedNodeId) return;
    const canvasRect = e.currentTarget.getBoundingClientRect();
    const newX = Math.max(20, Math.min(canvasRect.width - 220, e.clientX - canvasRect.left - 100));
    const newY = Math.max(20, Math.min(canvasRect.height - 100, e.clientY - canvasRect.top - 40));

    setNodes(prev => prev.map(n => n.id === draggedNodeId ? { ...n, position: { x: newX, y: newY } } : n));
  }

  function handleMouseUp() {
    setDraggedNodeId(null);
  }

  function addNode(type) {
    const id = `node_${Date.now().toString().slice(-5)}`;
    const newNode = {
      id,
      type,
      label: type === 'trigger' ? '⚡ Reply Received' : type === 'ml_condition' ? '🧠 ML Intent Filter' : '🎯 Move Stage',
      config: type === 'action' ? { actionType: 'move_stage', stageId: 'replied' } : {},
      position: { x: 100 + nodes.length * 40, y: 150 + (nodes.length % 3) * 50 },
    };
    setNodes([...nodes, newNode]);
    setSelectedNodeId(id);
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) return;
    setNodes(nodes.filter(n => n.id !== selectedNodeId));
    setEdges(edges.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  }

  async function saveWorkflow() {
    if (!activeWorkflow._id) return;
    setSaving(true);
    try {
      await patch(`/workflows/${activeWorkflow._id}`, { nodes, edges });
      mutate();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Bar Navigation & Actions */}
      <div className="h-16 px-6 border-b border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/pipeline" className="text-xs font-bold px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all">
            ← Back to Pipeline
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>⚡ WarmDM Visual Grid Builder</span>
              <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded font-mono">ML Active</span>
            </h1>
            <p className="text-[11px] text-slate-400">{activeWorkflow.name || 'ML Workflow Automation'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => addNode('trigger')}
            className="text-xs font-bold px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-lg transition-all"
          >
            + Trigger Node
          </button>
          <button
            onClick={() => addNode('ml_condition')}
            className="text-xs font-bold px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-lg transition-all"
          >
            + ML Condition
          </button>
          <button
            onClick={() => addNode('action')}
            className="text-xs font-bold px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-lg transition-all"
          >
            + Action Node
          </button>

          <button
            onClick={saveWorkflow}
            disabled={saving}
            className="text-xs font-bold px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md shadow-blue-500/20 transition-all ml-2"
          >
            {saving ? 'Saving...' : 'Save & Activate Graph'}
          </button>
        </div>
      </div>

      {/* Main Workspace: Canvas + Inspector */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Visual Grid Canvas */}
        <div
          className="flex-1 relative overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* SVG Connector Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {edges.map(edge => {
              const srcNode = nodes.find(n => n.id === edge.source);
              const tgtNode = nodes.find(n => n.id === edge.target);
              if (!srcNode || !tgtNode) return null;

              const x1 = (srcNode.position?.x || 0) + 200;
              const y1 = (srcNode.position?.y || 0) + 40;
              const x2 = tgtNode.position?.x || 0;
              const y2 = (tgtNode.position?.y || 0) + 40;
              const dx = Math.abs(x2 - x1) * 0.5;

              return (
                <g key={edge.id}>
                  <path
                    d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="3"
                    strokeDasharray={edge.sourceHandle === 'not_hiring' ? '4 4' : 'none'}
                  />
                  <circle cx={x2} cy={y2} r="4" fill="#38bdf8" />
                </g>
              );
            })}
          </svg>

          {/* Nodes Rendering */}
          {nodes.map(node => {
            const style = NODE_TYPES[node.type] || NODE_TYPES.action;
            const isSelected = node.id === selectedNodeId;

            return (
              <div
                key={node.id}
                onMouseDown={e => handleMouseDown(e, node.id)}
                style={{ left: `${node.position?.x || 0}px`, top: `${node.position?.y || 0}px` }}
                className={`absolute w-52 rounded-xl border-2 p-3.5 shadow-xl transition-shadow cursor-grab active:cursor-grabbing z-20 bg-slate-900 ${style.color} ${isSelected ? 'ring-2 ring-sky-400 border-sky-400 shadow-sky-500/20' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
                    <span>{style.icon}</span>
                    <span>{style.label}</span>
                  </span>
                  <span className="text-[9px] font-mono opacity-60">ID: {node.id.slice(-4)}</span>
                </div>

                <div className="text-xs font-bold text-white mb-1 truncate">{node.label}</div>
                <div className="text-[10px] text-slate-400 truncate">
                  {node.type === 'ml_condition' ? 'Branches: Interested / NotHiring / Referral' : node.config?.actionType || 'Event Listener'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Node Inspector Sidebar */}
        <div className="w-80 border-l border-slate-800 bg-slate-900 p-6 flex flex-col justify-between shrink-0 z-30">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Node Inspector</h2>
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Node Label</label>
                  <input
                    type="text"
                    value={selectedNode.label}
                    onChange={e => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, label: e.target.value } : n))}
                    className="w-full text-xs font-bold bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Node Type</label>
                  <div className="text-xs font-bold px-3 py-2 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 capitalize">
                    {selectedNode.type}
                  </div>
                </div>

                {selectedNode.type === 'action' && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Action Config</label>
                    <select
                      value={selectedNode.config?.actionType || 'move_stage'}
                      onChange={e => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, config: { ...n.config, actionType: e.target.value } } : n))}
                      className="w-full text-xs font-bold bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-blue-500"
                    >
                      <option value="move_stage">Move to Pipeline Stage</option>
                      <option value="add_tag">Apply Tag (#Tag)</option>
                      <option value="send_template">Trigger Auto-Template</option>
                    </select>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-800">
                  <button
                    onClick={deleteSelectedNode}
                    className="w-full text-xs font-bold py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg transition-all"
                  >
                    Delete Node
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic py-8 text-center">
                Click any node on the canvas to inspect or edit properties
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
            <div className="text-[11px] font-bold text-slate-300 mb-1">💡 WarmDM Branching Tip</div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              ML Classifier condition nodes automatically route incoming prospect replies to connected action nodes in real time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
