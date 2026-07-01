const express  = require('express');
const router   = express.Router();
const Company  = require('../models/Company');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// GET /api/companies — list all companies for the authenticated user
router.get('/', async (req, res) => {
  try {
    const companies = await Company.find({ user: req.user.id })
      .populate('group', 'name color')
      .sort({ name: 1 });
    res.json({ companies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies — quick create by name only (from extension widget)
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

    const Group = require('../models/Group');
    // Auto-create or reuse a Group with the same name
    let group = await Group.findOne({ user: req.user.id, name: name.trim() });
    if (!group) {
      group = await Group.create({ user: req.user.id, name: name.trim(), color: '#0f766e' });
    }

    // Use a placeholder linkedinUrl so the unique index doesn't clash
    const linkedinUrl = `https://www.linkedin.com/company/${encodeURIComponent(name.trim().toLowerCase().replace(/\s+/g, '-'))}-${Date.now()}`;
    const company = await Company.create({
      user: req.user.id,
      name: name.trim(),
      linkedinUrl,
      group: group._id,
    });

    res.status(201).json({ company: { ...company.toObject(), group } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies/upsert — create or update by linkedinUrl
router.post('/upsert', async (req, res) => {
  try {
    const { linkedinUrl, name, industry, size, location, description, website } = req.body;
    let { groupId } = req.body;
    if (!linkedinUrl || !name) return res.status(400).json({ error: 'linkedinUrl and name are required' });

    // Auto-create or fetch Group matching the company name if no groupId provided
    if (!groupId) {
      const Group = require('../models/Group');
      let group = await Group.findOne({ user: req.user.id, name: name.trim() });
      if (!group) {
        group = await Group.create({ user: req.user.id, name: name.trim(), color: '#0f766e' }); // Teal for auto-companies
      }
      groupId = group._id;
    }

    const update = {
      user: req.user.id,
      name,
      linkedinUrl,
      ...(industry    && { industry }),
      ...(size        && { size }),
      ...(location    && { location }),
      ...(description && { description }),
      ...(website     && { website }),
      ...(groupId     && { group: groupId }),
    };

    const company = await Company.findOneAndUpdate(
      { user: req.user.id, linkedinUrl },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('group', 'name color');

    res.json({ company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/companies/:id
router.delete('/:id', async (req, res) => {
  try {
    await Company.deleteOne({ _id: req.params.id, user: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
