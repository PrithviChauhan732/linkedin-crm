'use client';
import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher, patch } from '../../../lib/api';

const NODE_TYPES = {
  trigger:      { label: 'TRIGGER EVENT', color: 'border-blue-500/80 bg-slate-900 text-blue-400', badge: 'bg-blue-500/10 border-blue-500/30' },
  ml_condition: { label: 'ML CLASSIFIER', color: 'border-purple-500/80 bg-slate-900 text-purple-400', badge: 'bg-purple-500/10 border-purple-500/30' },
  action:       { label: 'ACTION NODE', color: 'border-emerald-500/80 bg-slate-900 text-emerald-400', badge: 'bg-emerald-500/10 border-emerald-500/30' },
};

const ML_BRANCHES = [
  { id: 'interested', label: 'Interested', tag: '#Interested', desc: 'Positive response / meeting request', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  { id: 'form_request', label: 'Form Request', tag: '#FormRequest', desc: 'Vendor questionnaire or form link', color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' },
  { id: 'not_hiring', label: 'Not Hiring', tag: '#NotHiring', desc: 'No open roles or hiring freeze', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  { id: 'referral', label: 'Referral', tag: '#Referral', desc: 'Redirected to another colleague', color: 'bg-blue-500/10 text-blue-300 border-blue-500/30' },
  { id: 'not_interested', label: 'Not Interested', tag: '#NotInterested', desc: 'Polite decline or pass', color: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
  { id: 'question', label: 'Inquiry', tag: '#Inquiry', desc: 'Pricing or service question', color: 'bg-purple-500/10 text-purple-300 border-purple-500/30' },
  { id: 'ooo', label: 'Out of Office', tag: '#OutOfOffice', desc: 'Vacation or automated reply', color: 'bg-slate-500/10 text-slate-300 border-slate-500/30' },
];

function sanitize(str) {
  if (!str) return '';
  return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
}

export default function WorkflowBuilderPage() {
  const { data: wfData, mutate } = useSWR('/workflows', fetcher);
  const workflows = wfData?.workflows || [];
  const activeWorkflow = workflows[0] || { nodes: [], edges: [] };

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  
  // Sidebar Toggle State
  const [showInspector, setShowInspector] = useState(true);

  // 2D Pan, Zoom & Connecting State
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState(null);

  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);

  // ML Sample Tester State
  const [testMessage, setTestMessage] = useState("we are full at this time with no vacancy");
  const [testResult, setTestResult] = useState(null);

  // Sync loaded workflow into local state and sanitize clean labels
  const loadedIdRef = useRef(null);
  if (activeWorkflow._id && loadedIdRef.current !== activeWorkflow._id) {
    loadedIdRef.current = activeWorkflow._id;
    const cleanNodes = (activeWorkflow.nodes || []).map(n => ({ ...n, label: sanitize(n.label) }));
    setNodes(cleanNodes);
    setEdges(activeWorkflow.edges || []);
  }

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    function handleKeyDown(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) deleteSelectedNode();
      } else if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setConnectingFrom(null);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedNodeId) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 5;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        setNodes(prev => prev.map(n => n.id === selectedNodeId ? {
          ...n, position: { x: (n.position?.x || 0) + dx, y: (n.position?.y || 0) + dy }
        } : n));
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId]);

  function handleWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom(prev => Math.min(2.0, Math.max(0.4, Number((prev * zoomFactor).toFixed(2)))));
  }

  function handleNodeMouseDown(e, nodeId) {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setDraggedNodeId(nodeId);
    setDragStartPos({ x: e.clientX, y: e.clientY });
  }

  function handlePortClick(e, nodeId, type, handle = 'output') {
    e.stopPropagation();
    if (type === 'output') {
      setConnectingFrom({ nodeId, handle });
    } else if (type === 'input' && connectingFrom) {
      if (connectingFrom.nodeId !== nodeId) {
        const newEdge = {
          id: `e_${Date.now().toString().slice(-5)}`,
          source: connectingFrom.nodeId,
          target: nodeId,
          sourceHandle: connectingFrom.handle,
        };
        setEdges(prev => [...prev.filter(e => !(e.source === newEdge.source && e.sourceHandle === newEdge.sourceHandle)), newEdge]);
      }
      setConnectingFrom(null);
    }
  }

  function handleCanvasMouseDown(e) {
    if (e.target.closest('.workflow-node') || e.target.closest('.port-dot')) return;
    setSelectedNodeId(null);
    setConnectingFrom(null);
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }

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
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
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
      label: type === 'trigger' ? 'LinkedIn Reply Received' : type === 'ml_condition' ? 'ML Intent Classifier' : 'Update Pipeline Stage',
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

  function runSampleMLTest() {
    const text = testMessage.toLowerCase().trim();
    let intent = "interested";
    let conf = 0.94;

    const formKeywords = ["fill this form", "fill out", "complete our form", "questionnaire", "intake form", "vendor portal", "procurement portal", "survey form", "vendor form", "apply through"];
    const notHiringKeywords = ["not hiring", "no open roles", "hiring freeze", "no vacancy", "full at this time", "fully staffed", "no open positions", "no headcount", "team is full", "full capacity"];
    const notInterestedKeywords = ["not interested", "pass for now", "no thank you", "remove me", "no budget", "not a fit", "no bandwidth", "don't need external", "pass"];
    const referralKeywords = ["reach out to", "contact", "speak with", "forwarding", "cto", "vp of", "coordinator"];
    const oooKeywords = ["out of office", "vacation", "leave", "automated reply", "auto reply", "traveling"];
    const questionKeywords = ["pricing", "rates", "cost", "how does", "what is", "case studies"];

    if (formKeywords.some(w => text.includes(w))) {
      intent = "form_request"; conf = 0.97;
    } else if (notHiringKeywords.some(w => text.includes(w))) {
      intent = "not_hiring"; conf = 0.96;
    } else if (notInterestedKeywords.some(w => text.includes(w))) {
      intent = "not_interested"; conf = 0.94;
    } else if (referralKeywords.some(w => text.includes(w))) {
      intent = "referral"; conf = 0.91;
    } else if (oooKeywords.some(w => text.includes(w))) {
      intent = "ooo"; conf = 0.98;
    } else if (questionKeywords.some(w => text.includes(w))) {
      intent = "question"; conf = 0.88;
    } else if (text.includes("sure") || text.includes("let's talk") || text.includes("schedule") || text.includes("interested") || text.includes("connect")) {
      intent = "interested"; conf = 0.95;
    } else {
      intent = "not_interested"; conf = 0.70;
    }

    const branch = ML_BRANCHES.find(b => b.id === intent) || ML_BRANCHES[0];
    setTestResult({ ...branch, confidence: conf });
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
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans select-none antialiased">
      {/* Sleek Enterprise Top Navigation Bar */}
      <div className="h-16 px-6 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center gap-4">
          <Link href="/pipeline" className="text-xs font-semibold px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-all">
            ← Back to Pipeline
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <h1 className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-2">
              <span>WarmDM Workflow Studio</span>
              <span className="text-[9px] px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded font-mono font-bold">ML Active</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">{activeWorkflow.name || 'Automated Outreach Workflow'}</p>
          </div>
        </div>

        {/* Center Node Segmented Control Bar */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button onClick={() => addNode('trigger')} className="text-xs font-semibold px-3 py-1 text-blue-400 hover:bg-blue-500/10 rounded transition-all">+ Trigger</button>
          <button onClick={() => addNode('ml_condition')} className="text-xs font-semibold px-3 py-1 text-purple-400 hover:bg-purple-500/10 rounded transition-all">+ ML Condition</button>
          <button onClick={() => addNode('action')} className="text-xs font-semibold px-3 py-1 text-emerald-400 hover:bg-emerald-500/10 rounded transition-all">+ Action</button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowInspector(v => !v)}
            className="text-xs font-semibold px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-all"
          >
            {showInspector ? 'Hide Inspector ⇥' : 'Show Inspector ⇤'}
          </button>

          <button onClick={saveWorkflow} disabled={saving} className="text-xs font-bold px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md shadow-sm shadow-blue-500/20 transition-all">
            {saving ? 'Saving...' : 'Save & Activate Graph'}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        <div
          className={`flex-1 relative overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          <div className="absolute inset-0 origin-top-left transition-transform duration-75 ease-out" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            {/* SVG Connector Wires */}
            <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none z-10 overflow-visible">
              <defs>
                <linearGradient id="wireGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>

              {edges.map(edge => {
                const srcNode = nodes.find(n => n.id === edge.source);
                const tgtNode = nodes.find(n => n.id === edge.target);
                if (!srcNode || !tgtNode) return null;

                const nodeWidth = 240;
                const x1 = (srcNode.position?.x || 0) + nodeWidth;
                const x2 = tgtNode.position?.x || 0;
                const y2 = (tgtNode.position?.y || 0) + 34; // Center of target input port

                let y1 = (srcNode.position?.y || 0) + 34; // Center of standard output port
                if (srcNode.type === 'ml_condition') {
                  const handles = ['interested', 'form_request', 'not_hiring', 'referral', 'not_interested', 'question', 'ooo'];
                  const idx = handles.indexOf(edge.sourceHandle);
                  if (idx !== -1) {
                    y1 = (srcNode.position?.y || 0) + 88 + idx * 28; // Exact right-edge row anchor offset
                  }
                }

                const dx = Math.min(120, Math.max(40, Math.abs(x2 - x1) * 0.4));

                return (
                  <g key={edge.id} className="cursor-pointer pointer-events-auto group" onClick={() => setEdges(edges.filter(e => e.id !== edge.id))}>
                    <path
                      d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke="url(#wireGradient)"
                      strokeWidth="2.5"
                      className="group-hover:stroke-sky-300 transition-colors"
                      strokeDasharray={edge.sourceHandle === 'not_hiring' ? '4 4' : 'none'}
                    />
                    <circle cx={x2} cy={y2} r="4" fill="#818cf8" className="group-hover:fill-sky-300 transition-colors" />
                  </g>
                );
              })}
            </svg>

            {/* Pixel-Perfect Clean Nodes Rendering */}
            {nodes.map(node => {
              const style = NODE_TYPES[node.type] || NODE_TYPES.action;
              const isSelected = node.id === selectedNodeId;
              const cleanLabel = sanitize(node.label);

              return (
                <div
                  key={node.id}
                  onMouseDown={e => handleNodeMouseDown(e, node.id)}
                  style={{ left: `${node.position?.x || 0}px`, top: `${node.position?.y || 0}px` }}
                  className={`workflow-node absolute w-60 rounded-xl border p-4 shadow-2xl transition-all bg-slate-900/95 backdrop-blur-md ${style.color} ${isSelected ? 'ring-2 ring-sky-400 border-sky-400 shadow-sky-500/20' : ''}`}
                >
                  {/* Target Input Port Dot (Left Edge) */}
                  {node.type !== 'trigger' && (
                    <div
                      onClick={e => handlePortClick(e, node.id, 'input')}
                      className="port-dot absolute -left-2.5 top-7 w-5 h-5 rounded-full bg-slate-950 border-2 border-sky-400 flex items-center justify-center cursor-pointer hover:scale-125 transition-transform shadow-lg z-30"
                      title="Connect Input Here"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    </div>
                  )}

                  {/* Node Header */}
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800/80">
                    <span className={`text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border ${style.badge}`}>
                      {style.label}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">ID: {node.id.slice(-4)}</span>
                  </div>

                  <div className="text-xs font-bold text-white mb-1 truncate">{cleanLabel}</div>

                  {/* ML Condition Branch Output Handles (Right Edge Flush) */}
                  {node.type === 'ml_condition' ? (
                    <div className="mt-3 space-y-1.5 pt-2 border-t border-purple-500/20 relative">
                      {['interested', 'form_request', 'not_hiring', 'referral'].map(h => (
                        <div key={h} className="flex items-center justify-between text-[10px] font-semibold text-purple-300 bg-purple-950/40 px-2.5 py-1.5 rounded border border-purple-500/20 relative">
                          <span className="capitalize">{h.replace('_', ' ')}</span>
                          {/* Dedicated Branch Port Dot (Flush on Right Edge) */}
                          <div
                            onClick={e => handlePortClick(e, node.id, 'output', h)}
                            className={`port-dot absolute -right-6 w-4 h-4 rounded-full border-2 border-purple-400 flex items-center justify-center cursor-pointer hover:scale-125 transition-all shadow-md z-30 ${connectingFrom?.nodeId === node.id && connectingFrom?.handle === h ? 'bg-purple-400' : 'bg-slate-950'}`}
                            title={`Connect ${h} output branch`}
                          >
                            <div className="w-1 h-1 rounded-full bg-purple-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Standard Output Port Dot for Trigger & Action (Right Edge) */
                    <div
                      onClick={e => handlePortClick(e, node.id, 'output')}
                      className={`port-dot absolute -right-2.5 top-7 w-5 h-5 rounded-full border-2 border-sky-400 flex items-center justify-center cursor-pointer hover:scale-125 transition-transform shadow-lg z-30 ${connectingFrom?.nodeId === node.id ? 'bg-sky-400' : 'bg-slate-950'}`}
                      title="Connect Output"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Floating Zoom & Controls Widget */}
          <div className="absolute bottom-6 left-6 z-30 flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1.5 rounded-lg shadow-xl backdrop-blur-md">
            <button onClick={() => setZoom(z => Math.min(2.0, Number((z + 0.15).toFixed(2))))} className="w-7 h-7 flex items-center justify-center text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded transition-all">+</button>
            <span className="text-xs font-mono font-bold text-slate-300 px-2 min-w-[45px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(0.4, Number((z - 0.15).toFixed(2))))} className="w-7 h-7 flex items-center justify-center text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded transition-all">-</button>
            <div className="h-3.5 w-px bg-slate-800 mx-1" />
            <button onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); }} className="text-xs font-semibold px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-all">Reset View</button>
          </div>
        </div>

        {/* Collapsible Node Inspector Sidebar */}
        {showInspector && (
          <div className="w-88 border-l border-slate-800/80 bg-slate-900/95 backdrop-blur-md p-6 flex flex-col justify-between shrink-0 z-30 overflow-y-auto">
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Node Inspector & ML Tester</h2>
              
              {selectedNode ? (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Node Label</label>
                    <input
                      type="text"
                      value={sanitize(selectedNode.label)}
                      onChange={e => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, label: e.target.value } : n))}
                      className="w-full text-xs font-semibold bg-slate-950 border border-slate-800 rounded-md p-2.5 text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* ML Classifier Details & Real-Time Tester */}
                  {selectedNode.type === 'ml_condition' && (
                    <div className="space-y-4 pt-3 border-t border-slate-800">
                      <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider">ML Output Branches</label>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {ML_BRANCHES.map(b => (
                          <div key={b.id} className={`p-2.5 rounded-md border text-xs ${b.color}`}>
                            <div className="flex items-center justify-between font-semibold">
                              <span>{b.label}</span>
                              <span className="font-mono text-[10px]">{b.tag}</span>
                            </div>
                            <div className="text-[10px] opacity-75 mt-0.5">{b.desc}</div>
                          </div>
                        ))}
                      </div>

                      {/* Interactive Sample Tester Box */}
                      <div className="p-3.5 bg-slate-950 border border-purple-500/20 rounded-lg space-y-2.5">
                        <label className="block text-[11px] font-semibold text-purple-300">Test ML Sample Outcome</label>
                        <textarea
                          rows={2}
                          value={testMessage}
                          onChange={e => setTestMessage(e.target.value)}
                          className="w-full text-xs p-2 bg-slate-900 border border-slate-800 rounded-md text-slate-200 outline-none focus:border-purple-500 resize-none"
                          placeholder="Type a sample prospect reply..."
                        />
                        <button
                          type="button"
                          onClick={runSampleMLTest}
                          className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-md shadow-sm shadow-purple-500/20 transition-all"
                        >
                          Simulate ML Outcome
                        </button>

                        {testResult && (
                          <div className="pt-2 border-t border-slate-800 text-xs">
                            <div className="text-[10px] text-slate-400 font-medium">Predicted Branch Outcome:</div>
                            <div className="flex items-center justify-between mt-1 font-bold text-emerald-400">
                              <span>{testResult.label} ({testResult.tag})</span>
                              <span className="font-mono text-[10px] text-slate-300">{Math.round(testResult.confidence * 100)}% Match</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'action' && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Action Config</label>
                      <select
                        value={selectedNode.config?.actionType || 'move_stage'}
                        onChange={e => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, config: { ...n.config, actionType: e.target.value } } : n))}
                        className="w-full text-xs font-semibold bg-slate-950 border border-slate-800 rounded-md p-2.5 text-white outline-none focus:border-blue-500"
                      >
                        <option value="move_stage">Move to Pipeline Stage</option>
                        <option value="add_tag">Apply Tag (#Tag)</option>
                        <option value="send_template">Trigger Auto-Template</option>
                      </select>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-800">
                    <button onClick={deleteSelectedNode} className="w-full text-xs font-semibold py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-md transition-all">
                      Delete Node (Delete Key)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic py-8 text-center">
                  Click any node on the canvas to inspect properties or test ML outcomes
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg mt-4">
              <div className="text-[11px] font-semibold text-slate-300 mb-1">Keyboard Shortcuts</div>
              <div className="text-[10px] text-slate-400 space-y-1">
                <div><kbd className="bg-slate-800 px-1 rounded text-white">Delete</kbd> : Delete selected node</div>
                <div><kbd className="bg-slate-800 px-1 rounded text-white">Arrows</kbd> : Nudge node position</div>
                <div><kbd className="bg-slate-800 px-1 rounded text-white">Esc</kbd> : Clear connection mode</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
