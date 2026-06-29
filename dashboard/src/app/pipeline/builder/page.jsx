'use client';
import { useState, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher, patch } from '../../../lib/api';

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
  
  // 2D Pan and Zoom State
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);

  // Sync loaded workflow into local state
  const loadedIdRef = useRef(null);
  if (activeWorkflow._id && loadedIdRef.current !== activeWorkflow._id) {
    loadedIdRef.current = activeWorkflow._id;
    setNodes(activeWorkflow.nodes || []);
    setEdges(activeWorkflow.edges || []);
  }

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // Canvas Mouse Wheel Zoom
  function handleWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom(prev => Math.min(2.0, Math.max(0.4, Number((prev * zoomFactor).toFixed(2)))));
  }

  // Node Dragging Initialization
  function handleNodeMouseDown(e, nodeId) {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setDraggedNodeId(nodeId);
    setDragStartPos({ x: e.clientX, y: e.clientY });
  }

  // Canvas Panning Initialization
  function handleCanvasMouseDown(e) {
    if (e.target.closest('.workflow-node')) return;
    setSelectedNodeId(null);
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }

  // Mouse Move Router (Handles Node Movement & Canvas Panning)
  function handleMouseMove(e) {
    if (draggedNodeId) {
      const dx = (e.clientX - dragStartPos.x) / zoom;
      const dy = (e.clientY - dragStartPos.y) / zoom;
      setNodes(prev => prev.map(n => n.id === draggedNodeId ? {
        ...n,
        position: { x: Math.round((n.position?.x || 0) + dx), y: Math.round((n.position?.y || 0) + dy) }
      } : n));
      setDragStartPos({ x: e.clientX, y: e.clientY });
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }

  function handleMouseUp() {
    setDraggedNodeId(null);
    setIsPanning(false);
  }

  function addNode(type) {
    const id = `node_${Date.now().toString().slice(-5)}`;
    const newNode = {
      id,
      type,
      label: type === 'trigger' ? '⚡ Reply Received' : type === 'ml_condition' ? '🧠 ML Intent Filter' : '🎯 Move Stage',
      config: type === 'action' ? { actionType: 'move_stage', stageId: 'replied' } : {},
      position: { x: Math.round(100 - pan.x / zoom + nodes.length * 30), y: Math.round(150 - pan.y / zoom + (nodes.length % 3) * 40) },
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
      <div className="h-16 px-6 border-b border-slate-800 bg-slate-900 flex items-center justify-between shrink-0 z-40">
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

      {/* Main Workspace: Movable Zoomable Canvas + Inspector */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Visual Movable Grid Canvas */}
        <div
          className={`flex-1 relative overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Scaled and Panned Container */}
          <div
            className="absolute inset-0 origin-top-left transition-transform duration-75 ease-out"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            {/* SVG Connector Lines */}
            <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none z-10 overflow-visible">
              {edges.map(edge => {
                const srcNode = nodes.find(n => n.id === edge.source);
                const tgtNode = nodes.find(n => n.id === edge.target);
                if (!srcNode || !tgtNode) return null;

                const x1 = (srcNode.position?.x || 0) + 208;
                const y1 = (srcNode.position?.y || 0) + 42;
                const x2 = tgtNode.position?.x || 0;
                const y2 = (tgtNode.position?.y || 0) + 42;
                const dx = Math.abs(x2 - x1) * 0.5;

                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="3.5"
                      strokeDasharray={edge.sourceHandle === 'not_hiring' ? '5 5' : 'none'}
                    />
                    <circle cx={x2} cy={y2} r="5" fill="#38bdf8" />
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
                  onMouseDown={e => handleNodeMouseDown(e, node.id)}
                  style={{ left: `${node.position?.x || 0}px`, top: `${node.position?.y || 0}px` }}
                  className={`workflow-node absolute w-52 rounded-xl border-2 p-3.5 shadow-xl transition-shadow cursor-grab active:cursor-grabbing z-20 bg-slate-900 ${style.color} ${isSelected ? 'ring-2 ring-sky-400 border-sky-400 shadow-sky-500/20' : ''}`}
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

          {/* Floating Zoom & Pan Navigation Controls Widget */}
          <div className="absolute bottom-6 left-6 z-30 flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl shadow-xl backdrop-blur-md">
            <button
              onClick={() => setZoom(z => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
              className="w-8 h-8 flex items-center justify-center text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-all"
              title="Zoom In"
            >
              +
            </button>
            <span className="text-xs font-mono font-bold text-slate-300 px-2.5 min-w-[50px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
              className="w-8 h-8 flex items-center justify-center text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-all"
              title="Zoom Out"
            >
              -
            </button>
            <div className="h-4 w-px bg-slate-800 mx-1" />
            <button
              onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); }}
              className="text-xs font-bold px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
              title="Reset View"
            >
              Reset View
            </button>
          </div>
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
            <div className="text-[11px] font-bold text-slate-300 mb-1">💡 WarmDM Navigation Tip</div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Use mouse wheel to zoom in/out, or drag the background canvas to pan anywhere in 2D space.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
