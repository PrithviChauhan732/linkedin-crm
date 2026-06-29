const router = require('express').Router();
const Workflow = require('../models/Workflow');

const DEFAULT_NODES = [
  { id: 'node_1', type: 'trigger', label: 'LinkedIn Reply Received', config: { event: 'reply_received' }, position: { x: 60, y: 180 } },
  { id: 'node_2', type: 'ml_condition', label: 'ML Intent Classifier', config: { model: 'fastapi_nlp' }, position: { x: 360, y: 180 } },
  { id: 'node_3', type: 'action', label: 'Move to Engaged Stage', config: { actionType: 'move_stage', stageId: 'replied' }, position: { x: 700, y: 60 } },
  { id: 'node_4', type: 'action', label: 'Apply Tag #NotHiring', config: { actionType: 'add_tag', tag: '#NotHiring' }, position: { x: 700, y: 190 } },
  { id: 'node_5', type: 'action', label: 'Apply Tag #Referral', config: { actionType: 'add_tag', tag: '#Referral' }, position: { x: 700, y: 320 } },
];

const DEFAULT_EDGES = [
  { id: 'e1-2', source: 'node_1', target: 'node_2', sourceHandle: 'output' },
  { id: 'e2-3', source: 'node_2', target: 'node_3', sourceHandle: 'interested' },
  { id: 'e2-4', source: 'node_2', target: 'node_4', sourceHandle: 'not_hiring' },
  { id: 'e2-5', source: 'node_2', target: 'node_5', sourceHandle: 'referral' },
];

// GET /api/workflows — List all workflows (seeds clean default if none exist)
router.get('/', async (req, res) => {
  let workflows = await Workflow.find().sort({ createdAt: 1 });
  if (workflows.length === 0) {
    const defaultWf = await Workflow.create({
      name: 'Smart ML Intent Routing Workflow',
      description: 'Visual WarmDM workflow routing replies based on Python ML outcomes',
      active: true,
      nodes: DEFAULT_NODES,
      edges: DEFAULT_EDGES,
    });
    workflows = [defaultWf];
  }
  res.json({ workflows });
});

// POST /api/workflows — Create workflow
router.post('/', async (req, res) => {
  const { name, description, nodes, edges } = req.body;
  const workflow = await Workflow.create({
    name,
    description: description || '',
    nodes: nodes || DEFAULT_NODES,
    edges: edges || DEFAULT_EDGES,
  });
  res.status(201).json({ workflow });
});

// PATCH /api/workflows/:id — Update graph nodes/edges/active
router.patch('/:id', async (req, res) => {
  const workflow = await Workflow.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ workflow });
});

// DELETE /api/workflows/:id
router.delete('/:id', async (req, res) => {
  await Workflow.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
