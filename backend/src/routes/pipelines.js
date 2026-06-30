const router = require('express').Router();
const Pipeline = require('../models/Pipeline');

const DEFAULT_STAGES = [
  { id: 'new',               label: 'Lead / New',           color: 'border-t-slate-400 bg-slate-100/40', order: 0 },
  { id: 'contacted',         label: 'Outreach Sent',        color: 'border-t-blue-500 bg-blue-50/30',     order: 1 },
  { id: 'replied',           label: 'Engaged / Replied',     color: 'border-t-emerald-500 bg-emerald-50/30', order: 2 },
  { id: 'meeting_scheduled', label: 'Meeting Scheduled',   color: 'border-t-amber-500 bg-amber-50/30',   order: 3 },
  { id: 'qualified',         label: 'Qualified Opportunity', color: 'border-t-purple-500 bg-purple-50/30', order: 4 },
  { id: 'closed_won',        label: 'Closed / Won',         color: 'border-t-indigo-600 bg-indigo-50/40', order: 5 },
];

// GET /api/pipelines — List all pipelines (seeds default per user if none exist)
router.get('/', async (req, res) => {
  let pipelines = await Pipeline.find({ user: req.user.id }).sort({ createdAt: 1 });
  if (pipelines.length === 0) {
    const defaultPipeline = await Pipeline.create({
      name: 'Default Outreach Pipeline',
      description: 'Standard multi-stage cold DM conversion pipeline',
      isDefault: true,
      stages: DEFAULT_STAGES,
      user: req.user.id,
    });
    pipelines = [defaultPipeline];
  }
  res.json({ pipelines });
});

// POST /api/pipelines — Create a custom pipeline
router.post('/', async (req, res) => {
  const { name, description, stages } = req.body;
  const pipeline = await Pipeline.create({
    name,
    description: description || '',
    stages: stages && stages.length > 0 ? stages : DEFAULT_STAGES,
    user: req.user.id,
  });
  res.status(201).json({ pipeline });
});

// PATCH /api/pipelines/:id — Update pipeline name or stages
router.patch('/:id', async (req, res) => {
  const pipeline = await Pipeline.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, req.body, { new: true });
  res.json({ pipeline });
});

// DELETE /api/pipelines/:id
router.delete('/:id', async (req, res) => {
  const pipeline = await Pipeline.findOne({ _id: req.params.id, user: req.user.id });
  if (pipeline?.isDefault) {
    return res.status(400).json({ error: 'Cannot delete the default pipeline' });
  }
  await Pipeline.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  res.json({ ok: true });
});

module.exports = router;
