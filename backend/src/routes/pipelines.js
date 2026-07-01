const router = require('express').Router();
const Pipeline = require('../models/Pipeline');

const DEFAULT_STAGES = [
  { id: 'new',               label: 'Lead / New',           color: 'border-t-slate-400 bg-slate-100/40', order: 0 },
  { id: 'connection_sent',   label: 'Connection Sent',      color: 'border-t-amber-500 bg-amber-50/30',   order: 1 },
  { id: 'connected',         label: 'Connected',            color: 'border-t-teal-500 bg-teal-50/30',     order: 2 },
  { id: 'contacted',         label: 'Outreach Sent',        color: 'border-t-blue-500 bg-blue-50/30',     order: 3 },
  { id: 'manual_validation', label: 'Manual Validation',    color: 'border-t-purple-500 bg-purple-50/30', order: 4 },
  { id: 'interested',        label: 'Interested / Engaged', color: 'border-t-emerald-500 bg-emerald-50/30', order: 5 },
  { id: 'not_interested',    label: 'Not Interested',       color: 'border-t-rose-500 bg-rose-50/30',     order: 6 },
  { id: 'meeting_scheduled', label: 'Meeting Scheduled',    color: 'border-t-amber-500 bg-amber-50/30',   order: 7 },
  { id: 'closed_won',        label: 'Closed / Won',         color: 'border-t-indigo-600 bg-indigo-50/40', order: 8 },
];

// GET /api/pipelines — List all pipelines (seeds default per user if none exist)
router.get('/', async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pipelines — Create a custom pipeline
router.post('/', async (req, res) => {
  try {
    const { name, description, stages } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Pipeline name is required' });
    }
    const pipeline = await Pipeline.create({
      name,
      description: description || '',
      stages: stages && stages.length > 0 ? stages : DEFAULT_STAGES,
      user: req.user.id,
    });
    res.status(201).json({ pipeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pipelines/:id — Update pipeline name or stages
router.patch('/:id', async (req, res) => {
  try {
    const pipeline = await Pipeline.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, req.body, { new: true });
    res.json({ pipeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pipelines/:id
router.delete('/:id', async (req, res) => {
  try {
    const pipeline = await Pipeline.findOne({ _id: req.params.id, user: req.user.id });
    if (pipeline?.isDefault) {
      return res.status(400).json({ error: 'Cannot delete the default pipeline' });
    }
    await Pipeline.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pipelines/:id/stages/:stageId/steps — add a step to a stage's follow-up chain
router.post('/:id/stages/:stageId/steps', async (req, res) => {
  try {
    const { step } = req.body;
    if (!step) return res.status(400).json({ error: 'Step content required' });

    const pipeline = await Pipeline.findOne({ _id: req.params.id, user: req.user.id });
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });

    if (!pipeline.followUps) pipeline.followUps = new Map();
    const currentSteps = pipeline.followUps.get(req.params.stageId) || [];
    currentSteps.push(step);
    pipeline.followUps.set(req.params.stageId, currentSteps);
    
    await pipeline.save();
    res.json({ pipeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pipelines/:id/stages/:stageId/steps/:stepIndex — remove a step from a stage's follow-up chain
router.delete('/:id/stages/:stageId/steps/:stepIndex', async (req, res) => {
  try {
    const pipeline = await Pipeline.findOne({ _id: req.params.id, user: req.user.id });
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });

    if (pipeline.followUps) {
      const currentSteps = pipeline.followUps.get(req.params.stageId) || [];
      const idx = Number(req.params.stepIndex);
      if (idx >= 0 && idx < currentSteps.length) {
        currentSteps.splice(idx, 1);
        pipeline.followUps.set(req.params.stageId, currentSteps);
        await pipeline.save();
      }
    }
    res.json({ pipeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
