const router = require('express').Router();
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');

// POST /api/messages/sync-conversations — called by extension with conversation list
router.post('/sync-conversations', async (req, res) => {
  const conversations = req.body; // array of { name, preview, isUnread, threadId, profileUrl }

  for (const conv of conversations) {
    if (!conv.name && !conv.profileUrl && !conv.threadId) continue;

    // Match contact belonging to this user
    let contact = null;
    if (conv.profileUrl) {
      contact = await Contact.findOne({ profileUrl: conv.profileUrl, user: req.user.id });
    }
    if (!contact && conv.threadId) {
      contact = await Contact.findOne({ threadId: conv.threadId, user: req.user.id });
    }
    if (!contact && conv.name) {
      const cleanName = conv.name.trim();
      contact = await Contact.findOne({
        user: req.user.id,
        name: { $regex: new RegExp('^' + cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
      });
      // Fallback: match by first name
      if (!contact && cleanName.includes(' ')) {
        const firstName = cleanName.split(' ')[0];
        contact = await Contact.findOne({
          user: req.user.id,
          name: { $regex: new RegExp('^' + firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
        });
      }
    }
    if (!contact) continue;

    // Detect a reply: isUnread flag OR preview does not start with "You:"
    const cleanPreview = conv.preview ? conv.preview.trim() : '';
    const isFromThem = cleanPreview.length > 0 && !cleanPreview.startsWith('You:');
    const hasReply = conv.isUnread || isFromThem;

    if (hasReply && contact.status !== 'replied' && !['meeting_scheduled', 'qualified', 'closed_won'].includes(contact.status)) {
      let mlTag = '#Reply';
      let newStatus = 'replied';

      // Call Python ML Microservice for Intent Classification
      try {
        const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000/predict';
        const mlRes = await fetch(mlUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanPreview || 'Hi' }),
        });
        if (mlRes.ok) {
          const mlData = await mlRes.json();
          if (mlData.recommended_tag) mlTag = mlData.recommended_tag;
          if (mlData.confidence !== undefined && mlData.confidence < 0.70) {
            newStatus = 'manual_validation';
            mlTag = '#NeedsReview';
          } else if (mlData.recommended_stage) {
            newStatus = mlData.recommended_stage;
          }
        }
      } catch (err) {
        console.log('[ML Service] Offline or unreached, using fallback defaults.');
      }

      await Contact.findOneAndUpdate({ _id: contact._id, user: req.user.id }, {
        status:       newStatus,
        lastReplyAt:  new Date(),
        replyPreview: cleanPreview,
        $addToSet:    { tags: mlTag }
      });

      await Campaign.updateMany(
        { user: req.user.id, 'sends.contact': contact._id, 'sends.status': { $in: ['sent', 'pending'] } },
        {
          $inc: { 'stats.replied': 1 },
          $set: {
            'sends.$[el].status':    'replied',
            'sends.$[el].repliedAt': new Date(),
          },
        },
        { arrayFilters: [{ 'el.contact': contact._id }] }
      );
    }

    if (conv.threadId && !contact.threadId) {
      await Contact.findOneAndUpdate({ _id: contact._id, user: req.user.id }, { threadId: conv.threadId });
    }
  }

  res.json({ ok: true });
});

// POST /api/messages/sync-thread — sync individual conversation messages
router.post('/sync-thread', async (req, res) => {
  const { threadId, messages } = req.body;

  const contact = await Contact.findOne({ threadId, user: req.user.id });
  if (!contact) return res.json({ ok: true, skipped: true });

  for (const msg of messages) {
    await Message.findOneAndUpdate(
      { contact: contact._id, text: msg.text, sentAt: msg.timestamp },
      { $set: { ...msg, contact: contact._id } },
      { upsert: true }
    );
  }

  res.json({ ok: true });
});

// GET /api/messages/unread — for popup
router.get('/unread', async (req, res) => {
  const contacts = await Contact.find({ status: 'replied', user: req.user.id })
    .sort({ lastReplyAt: -1 })
    .limit(10)
    .select('name profileUrl lastReplyAt');

  const messages = await Promise.all(contacts.map(async c => {
    const last = await Message.findOne({ contact: c._id, isOwn: false }).sort({ sentAt: -1 });
    return {
      name: c.name,
      profileUrl: c.profileUrl,
      preview: last?.text?.slice(0, 60) || '',
      time: c.lastReplyAt,
    };
  }));

  res.json({ messages });
});

// GET /api/messages/stats — for popup
router.get('/stats', async (req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const userContactIds = await Contact.distinct('_id', { user: req.user.id });

  const [sent, replied, unread] = await Promise.all([
    Message.countDocuments({ contact: { $in: userContactIds }, isOwn: true, sentAt: { $gte: weekAgo } }),
    Contact.countDocuments({ user: req.user.id, status: 'replied', lastReplyAt: { $gte: weekAgo } }),
    Contact.countDocuments({ user: req.user.id, status: 'replied' }),
  ]);

  res.json({ sent, replied, unread });
});

// GET /api/messages/:contactId — full thread for a contact
router.get('/:contactId', async (req, res) => {
  const contact = await Contact.findOne({ _id: req.params.contactId, user: req.user.id });
  if (!contact) return res.status(403).json({ error: 'Access denied' });

  const messages = await Message.find({ contact: req.params.contactId }).sort({ sentAt: 1 });
  res.json({ messages });
});

// POST /api/messages/test-ml — proxy for playground
router.post('/test-ml', async (req, res) => {
  const { text } = req.body;
  try {
    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000/predict';
    const mlRes = await fetch(mlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text || 'Hi' }),
    });
    if (mlRes.ok) {
      const data = await mlRes.json();
      return res.json(data);
    } else {
      return res.status(mlRes.status).json({ error: 'ML Service returned an error' });
    }
  } catch (err) {
    return res.status(503).json({ error: 'ML Service offline' });
  }
});

module.exports = router;
