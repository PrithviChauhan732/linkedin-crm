const router = require('express').Router();
const Template = require('../models/Template');

// GET /api/templates
router.get('/', async (req, res) => {
  const templates = await Template.find({ user: req.user.id }).sort({ timesUsed: -1 });
  res.json({ templates });
});

// POST /api/templates
router.post('/', async (req, res) => {
  // Auto-detect variables used in body
  const vars = [...(req.body.body?.matchAll(/\{(\w+)\}/g) || [])].map(m => m[1]);
  const template = await Template.create({ ...req.body, variables: [...new Set(vars)], user: req.user.id });
  res.status(201).json({ template });
});

// PATCH /api/templates/:id
router.patch('/:id', async (req, res) => {
  const template = await Template.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, req.body, { new: true });
  res.json({ template });
});

// DELETE /api/templates/:id
router.delete('/:id', async (req, res) => {
  await Template.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  res.json({ ok: true });
});

// POST /api/templates/:id/preview — preview with sample data
router.post('/:id/preview', async (req, res) => {
  const template = await Template.findOne({ _id: req.params.id, user: req.user.id });
  if (!template) return res.status(404).json({ error: 'Not found' });

  const { contact = {} } = req.body;
  const preview = template.body
    .replace(/\{name\}/g, contact.name?.split(' ')[0] || 'Alex')
    .replace(/\{full_name\}/g, contact.name || 'Alex Johnson')
    .replace(/\{headline\}/g, contact.headline || 'Product Manager at Acme')
    .replace(/\{company\}/g, contact.company || 'Acme Corp');

  res.json({ preview });
});

module.exports = router;
