const router = require('express').Router();
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Template = require('../models/Template');

// GET /api/campaigns
router.get('/', async (req, res) => {
  const campaigns = await Campaign.find({ user: req.user.id })
    .populate('group', 'name color')
    .populate('template', 'name')
    .sort({ createdAt: -1 });
  res.json({ campaigns });
});

// POST /api/campaigns
router.post('/', async (req, res) => {
  const { name, groupId, templateId } = req.body;
  const contactCount = await Contact.countDocuments({ groups: groupId, user: req.user.id });

  const campaign = await Campaign.create({
    name, group: groupId, template: templateId,
    'stats.total': contactCount,
    user: req.user.id,
  });

  res.status(201).json({ campaign });
});

// POST /api/campaigns/:id/build-queue — returns the send queue for the extension
router.post('/:id/build-queue', async (req, res) => {
  const { contactIds } = req.body;
  const campaign = await Campaign.findOne({ _id: req.params.id, user: req.user.id })
    .populate('template');

  if (!campaign) return res.status(404).json({ error: 'Not found' });

  let contacts = [];
  if (contactIds && contactIds.length > 0) {
    contacts = await Contact.find({ _id: { $in: contactIds }, user: req.user.id });
  } else {
    // Fallback to old group-based queueing
    const campaignWithGroup = await Campaign.findOne({ _id: req.params.id, user: req.user.id })
      .populate({ path: 'group', populate: { path: 'contacts' } });
    contacts = campaignWithGroup.group?.contacts || [];
  }

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
  await Campaign.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { status: 'running' });

  res.json({ queue });
});

// POST /api/campaigns/message-sent — called by extension after each send
router.post('/message-sent', async (req, res) => {
  const { contactId, campaignId, result } = req.body;

  const update = result.success
    ? { $inc: { 'stats.sent': 1 }, $set: { 'sends.$[el].status': 'sent', 'sends.$[el].sentAt': new Date() } }
    : { $inc: { 'stats.failed': 1 }, $set: { 'sends.$[el].status': 'failed', 'sends.$[el].error': result.error } };

  const campaign = await Campaign.findOneAndUpdate(
    { _id: campaignId, user: req.user.id }, update,
    { arrayFilters: [{ 'el.contact': contactId }], new: true }
  );

  if (result.success && campaign) {
    await Contact.findOneAndUpdate({ _id: contactId, user: req.user.id }, {
      status: 'contacted',
      lastMessageAt: new Date(),
      $inc: { messageCount: 1 },
    });
  }

  if (campaign) {
    // Update template reply rate
    await Template.findOneAndUpdate(
      { _id: campaign.template, user: req.user.id },
      { $inc: { timesUsed: 1 } }
    );
  }

  res.json({ ok: true });
});

// POST /api/campaigns/complete
router.post('/complete', async (req, res) => {
  // Mark any running campaigns as complete if all sends are done
  await Campaign.updateMany(
    { status: 'running', 'stats.sent': { $gte: 1 }, user: req.user.id },
    { status: 'complete' }
  );
  res.json({ ok: true });
});

// PATCH /api/campaigns/:id/pause
router.patch('/:id/pause', async (req, res) => {
  const campaign = await Campaign.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id }, { status: 'paused' }, { new: true }
  );
  res.json({ campaign });
});

// PATCH /api/campaigns/:id — general update (status, name, etc.)
router.patch('/:id', async (req, res) => {
  const campaign = await Campaign.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, req.body, { new: true });
  res.json({ campaign });
});

// GET /api/campaigns/:id/stats
router.get('/:id/stats', async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, user: req.user.id });
  if (!campaign) return res.status(404).json({ error: 'Not found' });

  const replyRate = campaign.stats.sent > 0
    ? Math.round((campaign.stats.replied / campaign.stats.sent) * 100)
    : 0;

  res.json({ stats: { ...campaign.stats.toObject(), replyRate } });
});

module.exports = router;
