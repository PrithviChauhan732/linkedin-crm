const router = require('express').Router();
const Contact = require('../models/Contact');
const Group   = require('../models/Group');

// GET /api/contacts/tags — list all unique tags in use
router.get('/tags', async (req, res) => {
  const tags = await Contact.distinct('tags');
  res.json({ tags: tags.filter(Boolean).sort() });
});

// GET /api/contacts
router.get('/', async (req, res) => {
  const { group, status, tag, search, page = 1, limit = 50 } = req.query;
  const filter = {};

  if (group)  filter.groups = group;
  if (status) filter.status = status;
  if (tag)    filter.tags   = tag;
  if (search) filter.$or = [
    { name:     { $regex: search, $options: 'i' } },
    { headline: { $regex: search, $options: 'i' } },
    { company:  { $regex: search, $options: 'i' } },
    { tags:     { $regex: search, $options: 'i' } },
  ];

  const [contacts, total] = await Promise.all([
    Contact.find(filter)
      .populate('groups', 'name color')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Contact.countDocuments(filter),
  ]);

  res.json({ contacts, total, page: Number(page), pages: Math.ceil(total / limit) });
});

// GET /api/contacts/:id
router.get('/:id', async (req, res) => {
  const contact = await Contact.findById(req.params.id).populate('groups', 'name color');
  if (!contact) return res.status(404).json({ error: 'Not found' });
  res.json({ contact });
});

// POST /api/contacts/upsert — called by extension when a profile is viewed
router.post('/upsert', async (req, res) => {
  const { profileUrl, name, headline, company, username, email, phone, location, website, mutualConnection, recentPostTopic } = req.body;

  // Normalize name: prefer display name from DOM; fall back to humanizing the slug
  const normalizedName = (name && name !== username)
    ? name
    : username
        ?.split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ') || name;

  const updateData = { name: normalizedName, headline, company, username };
  if (email) updateData.email = email;
  if (phone) updateData.phone = phone;
  if (location) updateData.location = location;
  if (website) updateData.website = website;
  if (mutualConnection) updateData.mutualConnection = mutualConnection;
  if (recentPostTopic) updateData.recentPostTopic = recentPostTopic;

  const contact = await Contact.findOneAndUpdate(
    { profileUrl },
    { $set: updateData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({ contact });
});

// POST /api/contacts
router.post('/', async (req, res) => {
  const contact = await Contact.create(req.body);
  res.status(201).json({ contact });
});

// PATCH /api/contacts/:id
router.patch('/:id', async (req, res) => {
  const allowed = ['status', 'notes', 'tags', 'name', 'headline', 'company', 'email', 'phone', 'location', 'website', 'mutualConnection', 'recentPostTopic', 'leadScore'];
  const update  = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );
  const contact = await Contact.findByIdAndUpdate(req.params.id, update, { new: true })
    .populate('groups', 'name color');
  res.json({ contact });
});

// POST /api/contacts/:id/tags — add a tag
router.post('/:id/tags', async (req, res) => {
  const { tag } = req.body;
  const contact = await Contact.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { tags: tag } },
    { new: true }
  ).populate('groups', 'name color');
  res.json({ contact });
});

// DELETE /api/contacts/:id/tags/:tag — remove a tag
router.delete('/:id/tags/:tag', async (req, res) => {
  const contact = await Contact.findByIdAndUpdate(
    req.params.id,
    { $pull: { tags: req.params.tag } },
    { new: true }
  ).populate('groups', 'name color');
  res.json({ contact });
});

// POST /api/contacts/:id/add-to-group
router.post('/:id/add-to-group', async (req, res) => {
  const { groupId } = req.body;
  const [contact] = await Promise.all([
    Contact.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { groups: groupId } },
      { new: true }
    ),
    Group.findByIdAndUpdate(groupId, { $addToSet: { contacts: req.params.id } }),
  ]);
  res.json({ contact });
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  await Contact.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
