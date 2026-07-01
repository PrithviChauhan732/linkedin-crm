const router = require('express').Router();
const Group = require('../models/Group');
const Contact = require('../models/Contact');

// GET /api/groups
router.get('/', async (req, res) => {
  const groups = await Group.find({ user: req.user.id }).sort({ createdAt: -1 });
  // Add contact count
  const withCounts = await Promise.all(groups.map(async g => ({
    ...g.toObject(),
    contactCount: await Contact.countDocuments({ groups: g._id, user: req.user.id }),
  })));
  res.json({ groups: withCounts });
});

// POST /api/groups
router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }
    const group = await Group.create({ name, color, user: req.user.id });
    res.status(201).json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id/contacts
router.get('/:id/contacts', async (req, res) => {
  const contacts = await Contact.find({ groups: req.params.id, user: req.user.id });
  res.json({ contacts });
});

// PATCH /api/groups/:id
router.patch('/:id', async (req, res) => {
  const group = await Group.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, req.body, { new: true });
  res.json({ group });
});

// DELETE /api/groups/:id
router.delete('/:id', async (req, res) => {
  const group = await Group.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (group) {
    // Remove this group from all contacts belonging to the user
    await Contact.updateMany({ groups: req.params.id, user: req.user.id }, { $pull: { groups: req.params.id } });
  }
  res.json({ ok: true });
});

module.exports = router;
