const router = require('express').Router();
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Template = require('../models/Template');

// GET /api/campaigns
router.get('/', async (req, res) => {
  const campaigns = await Campaign.find()
    .populate('group', 'name color')
    .populate('template', 'name')
    .sort({ createdAt: -1 });
  res.json({ campaigns });
});

// POST /api/campaigns
router.post('/', async (req, res) => {
  const { name, groupId, templateId } = req.body;
  const contactCount = await Contact.countDocuments({ groups: groupId });

  const campaign = await Campaign.create({
    name, group: groupId, template: templateId,
    'stats.total': contactCount,
  });

  res.status(201).json({ campaign });
});

// POST /api/campaigns/:id/build-queue — returns the send queue for the extension
router.post('/:id/build-queue', async (req, res) => {
  const campaign = await Campaign.findById(req.params.id)
    .populate('template')
    .populate({ path: 'group', populate: { path: 'contacts' } });

  if (!campaign) return res.status(404).json({ error: 'Not found' });

  const contacts = campaign.group?.contacts || [];
  const queue = contacts.map(contact => ({
    contactId:  contact._id,
    campaignId: campaign._id,
    profileUrl: contact.profileUrl,
    template:   campaign.template.body,
    contact: {
      name:     contact.name,
      headline: contact.headline,
      company:  contact.company,
    },
  }));

  // Update campaign status
  await Campaign.findByIdAndUpdate(req.params.id, { status: 'running' });

  res.json({ queue });
});

// POST /api/campaigns/message-sent — called by extension after each send
router.post('/message-sent', async (req, res) => {
  const { contactId, campaignId, result } = req.body;

  const update = result.success
    ? { $inc: { 'stats.sent': 1 }, $set: { 'sends.$[el].status': 'sent', 'sends.$[el].sentAt': new Date() } }
    : { $inc: { 'stats.failed': 1 }, $set: { 'sends.$[el].status': 'failed', 'sends.$[el].error': result.error } };

  await Campaign.findByIdAndUpdate(
    campaignId, update,
    { arrayFilters: [{ 'el.contact': contactId }] }
  );

  if (result.success) {
    await Contact.findByIdAndUpdate(contactId, {
      status: 'contacted',
      lastMessageAt: new Date(),
      $inc: { messageCount: 1 },
    });
  }

  // Update template reply rate
  await Template.findOneAndUpdate(
    { _id: (await Campaign.findById(campaignId))?.template },
    { $inc: { timesUsed: 1 } }
  );

  res.json({ ok: true });
});

// POST /api/campaigns/complete
router.post('/complete', async (req, res) => {
  // Mark any running campaigns as complete if all sends are done
  await Campaign.updateMany(
    { status: 'running', 'stats.sent': { $gte: 1 } },
    { status: 'complete' }
  );
  res.json({ ok: true });
});

// PATCH /api/campaigns/:id/pause
router.patch('/:id/pause', async (req, res) => {
  const campaign = await Campaign.findByIdAndUpdate(
    req.params.id, { status: 'paused' }, { new: true }
  );
  res.json({ campaign });
});

// PATCH /api/campaigns/:id — general update (status, name, etc.)
router.patch('/:id', async (req, res) => {
  const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ campaign });
});

// GET /api/campaigns/:id/stats
router.get('/:id/stats', async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Not found' });

  const replyRate = campaign.stats.sent > 0
    ? Math.round((campaign.stats.replied / campaign.stats.sent) * 100)
    : 0;

  res.json({ stats: { ...campaign.stats.toObject(), replyRate } });
});

module.exports = router;
