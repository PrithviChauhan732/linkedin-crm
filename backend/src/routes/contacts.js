const router = require('express').Router();
const Contact = require('../models/Contact');
const Group   = require('../models/Group');

// GET /api/contacts/tags — list all unique tags in use for the user
router.get('/tags', async (req, res) => {
  const tags = await Contact.distinct('tags', { user: req.user.id });
  res.json({ tags: tags.filter(Boolean).sort() });
});

// GET /api/contacts
router.get('/', async (req, res) => {
  const { group, status, tag, search, page = 1, limit = 50 } = req.query;
  const filter = { user: req.user.id };

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
  const contact = await Contact.findOne({ _id: req.params.id, user: req.user.id }).populate('groups', 'name color');
  if (!contact) return res.status(404).json({ error: 'Not found' });
  res.json({ contact });
});

// POST /api/contacts/sync-connections — Bulk sync using Hash Map
router.post('/sync-connections', async (req, res) => {
  try {
    const { connections } = req.body; // array of { profileUrl, name, time }
    if (!connections || !connections.length) {
      return res.json({ ok: true, updated: 0 });
    }

    // 1. Build a Hash Map of scraped profile URLs (O(M))
    const connectionMap = new Map();
    for (const c of connections) {
      if (c.profileUrl) {
        // Normalize URL to remove query parameters and trailing slashes
        const normalizedUrl = c.profileUrl.split('?')[0].replace(/\/$/, '');
        connectionMap.set(normalizedUrl, true);
      }
    }

    // 2. Query all contacts currently in 'connection_sent' stage (O(1) DB roundtrip)
    const pendingContacts = await Contact.find({ user: req.user.id, status: 'connection_sent' });

    // 3. Reconcile in O(N)
    const newlyConnectedIds = [];
    for (const contact of pendingContacts) {
      if (contact.profileUrl) {
        const normalizedUrl = contact.profileUrl.split('?')[0].replace(/\/$/, '');
        if (connectionMap.has(normalizedUrl)) {
          newlyConnectedIds.push(contact._id);
        }
      }
    }

    // 4. Bulk Update matching contacts
    if (newlyConnectedIds.length > 0) {
      await Contact.updateMany(
        { _id: { $in: newlyConnectedIds } },
        { $set: { status: 'connected', updatedAt: new Date() } }
      );
    }

    res.json({ ok: true, updated: newlyConnectedIds.length });
  } catch (err) {
    console.error('[Sync Connections Error]', err);
    res.status(500).json({ error: 'Failed to sync connections' });
  }
});

// POST /api/contacts/upsert — called by extension when a profile is viewed
router.post('/upsert', async (req, res) => {
  const { profileUrl, name, headline, company, username, email, phone, location, website, mutualConnection, recentPostTopic, status, connectionStatus } = req.body;

  // Normalize name
  const normalizedName = (name && name !== username)
    ? name
    : username
        ?.split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ') || name;

  const updateData = { name: normalizedName, headline, company, username, user: req.user.id };
  if (email) updateData.email = email;
  if (phone) updateData.phone = phone;
  if (location) updateData.location = location;
  if (website) updateData.website = website;
  if (mutualConnection) updateData.mutualConnection = mutualConnection;
  if (recentPostTopic) updateData.recentPostTopic = recentPostTopic;
  
  const incomingStatus = status || connectionStatus;
  if (incomingStatus) {
    updateData.status = incomingStatus;
  }

  const contact = await Contact.findOneAndUpdate(
    { profileUrl, user: req.user.id },
    { $set: updateData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({ contact });
});

// POST /api/contacts
router.post('/', async (req, res) => {
  const contact = await Contact.create({ ...req.body, user: req.user.id });
  res.status(201).json({ contact });
});

// PATCH /api/contacts/:id
router.patch('/:id', async (req, res) => {
  const allowed = ['status', 'notes', 'tags', 'name', 'headline', 'company', 'email', 'phone', 'location', 'website', 'mutualConnection', 'recentPostTopic', 'leadScore'];
  const update  = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );
  const contact = await Contact.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, update, { new: true })
    .populate('groups', 'name color');
  res.json({ contact });
});

// POST /api/contacts/:id/tags — add a tag
router.post('/:id/tags', async (req, res) => {
  const { tag } = req.body;
  const contact = await Contact.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { $addToSet: { tags: tag } },
    { new: true }
  ).populate('groups', 'name color');
  res.json({ contact });
});

// DELETE /api/contacts/:id/tags/:tag — remove a tag
router.delete('/:id/tags/:tag', async (req, res) => {
  const contact = await Contact.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { $pull: { tags: req.params.tag } },
    { new: true }
  ).populate('groups', 'name color');
  res.json({ contact });
});

// POST /api/contacts/:id/add-to-group
router.post('/:id/add-to-group', async (req, res) => {
  const { groupId } = req.body;
  
  // Verify group belongs to user
  const group = await Group.findOne({ _id: groupId, user: req.user.id });
  if (!group) return res.status(403).json({ error: 'Access denied to group' });

  const [contact] = await Promise.all([
    Contact.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $addToSet: { groups: groupId } },
      { new: true }
    ).populate('groups', 'name color'),
    Group.findByIdAndUpdate(groupId, { $addToSet: { contacts: req.params.id } }),
  ]);
  res.json({ contact });
});

// POST /api/contacts/:id/remove-from-group
router.post('/:id/remove-from-group', async (req, res) => {
  const { groupId } = req.body;
  const [contact] = await Promise.all([
    Contact.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $pull: { groups: groupId } },
      { new: true }
    ).populate('groups', 'name color'),
    Group.findByIdAndUpdate(groupId, { $pull: { contacts: req.params.id } }),
  ]);
  res.json({ contact });
});

// POST /api/contacts/upsert-batch — create or update multiple contacts (deduped by profileUrl)
// Used by the extension People scraper to save a batch of people from a company page.
router.post('/upsert-batch', async (req, res) => {
  try {
    const { contacts: batch, groupId, campaignId } = req.body;
    if (!Array.isArray(batch) || batch.length === 0) return res.status(400).json({ error: 'contacts array required' });

    const results = await Promise.all(batch.map(async (c) => {
      const filter = c.profileUrl
        ? { user: req.user.id, profileUrl: c.profileUrl }
        : { user: req.user.id, name: c.name };

      const update = {
        user: req.user.id,
        name:       c.name       || 'Unknown',
        headline:   c.headline   || '',
        company:    c.company    || '',
        profileUrl: c.profileUrl || '',
        ...(groupId && { $addToSet: { groups: groupId } }),
      };

      return Contact.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: true });
    }));

    // If a campaign was specified, add all contact IDs to it
    if (campaignId) {
      const Campaign = require('../models/Campaign');
      const ids = results.map(c => c._id);
      await Campaign.findOneAndUpdate(
        { _id: campaignId, user: req.user.id },
        { $addToSet: { contacts: { $each: ids } } }
      );
    }

    res.json({ ok: true, count: results.length, contacts: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  await Contact.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  res.json({ ok: true });
});

module.exports = router;
