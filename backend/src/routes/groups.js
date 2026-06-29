const router = require('express').Router();
const Group = require('../models/Group');
const Contact = require('../models/Contact');

// GET /api/groups
router.get('/', async (req, res) => {
  const groups = await Group.find().sort({ createdAt: -1 });
  // Add contact count
  const withCounts = await Promise.all(groups.map(async g => ({
    ...g.toObject(),
    contactCount: await Contact.countDocuments({ groups: g._id }),
  })));
  res.json({ groups: withCounts });
});

// POST /api/groups
router.post('/', async (req, res) => {
  const group = await Group.create(req.body);
  res.status(201).json({ group });
});

// GET /api/groups/:id/contacts
router.get('/:id/contacts', async (req, res) => {
  const contacts = await Contact.find({ groups: req.params.id });
  res.json({ contacts });
});

// PATCH /api/groups/:id
router.patch('/:id', async (req, res) => {
  const group = await Group.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ group });
});

// DELETE /api/groups/:id
router.delete('/:id', async (req, res) => {
  await Group.findByIdAndDelete(req.params.id);
  // Remove this group from all contacts
  await Contact.updateMany({ groups: req.params.id }, { $pull: { groups: req.params.id } });
  res.json({ ok: true });
});

module.exports = router;
