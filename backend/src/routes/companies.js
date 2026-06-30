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
      .sort({ addedAt: -1 });
    res.json({ companies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies/upsert — create or update by linkedinUrl
router.post('/upsert', async (req, res) => {
  try {
    const { linkedinUrl, name, industry, size, location, description, website, groupId } = req.body;
    if (!linkedinUrl || !name) return res.status(400).json({ error: 'linkedinUrl and name are required' });

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
