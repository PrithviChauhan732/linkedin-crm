const router = require('express').Router();
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');

// POST /api/messages/sync-conversations — called by extension with conversation list
router.post('/sync-conversations', async (req, res) => {
  const conversations = req.body; // array of { name, preview, isUnread, threadId, profileUrl }

  for (const conv of conversations) {
    if (!conv.name && !conv.profileUrl && !conv.threadId) continue;

    // Match contact by profileUrl (full page) or by threadId or by case-insensitive name
    let contact = null;
    if (conv.profileUrl) {
      contact = await Contact.findOne({ profileUrl: conv.profileUrl });
    }
    if (!contact && conv.threadId) {
      contact = await Contact.findOne({ threadId: conv.threadId });
    }
    if (!contact && conv.name) {
      const cleanName = conv.name.trim();
      contact = await Contact.findOne({
        name: { $regex: new RegExp('^' + cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
      });
      // Fallback: match by first name if exact name not found
      if (!contact && cleanName.includes(' ')) {
        const firstName = cleanName.split(' ')[0];
        contact = await Contact.findOne({
          name: { $regex: new RegExp('^' + firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
        });
      }
    }
    if (!contact) continue;

    // Detect a reply: isUnread flag OR preview does not start with "You:"
    const cleanPreview = conv.preview ? conv.preview.trim() : '';
    const isFromThem = cleanPreview.length > 0 && !cleanPreview.startsWith('You:');
    const hasReply = conv.isUnread || isFromThem;

    if (hasReply && contact.status !== 'replied') {
      let mlTag = '#Reply';
      let mlIntent = 'replied';

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
          if (mlData.intent) mlIntent = mlData.intent;
        }
      } catch (err) {
        console.log('[ML Service] Offline or unreached, using fallback defaults.');
      }

      await Contact.findByIdAndUpdate(contact._id, {
        status:       'replied',
        lastReplyAt:  new Date(),
        replyPreview: cleanPreview,
        $addToSet:    { tags: mlTag }
      });

      await Campaign.updateMany(
        { 'sends.contact': contact._id, 'sends.status': { $in: ['sent', 'pending'] } },
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
      await Contact.findByIdAndUpdate(contact._id, { threadId: conv.threadId });
    }
  }

  res.json({ ok: true });
});

// POST /api/messages/sync-thread — sync individual conversation messages
router.post('/sync-thread', async (req, res) => {
  const { threadId, messages } = req.body;

  const contact = await Contact.findOne({ threadId });
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
  const contacts = await Contact.find({ status: 'replied' })
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

  const [sent, replied, unread] = await Promise.all([
    Message.countDocuments({ isOwn: true, sentAt: { $gte: weekAgo } }),
    Contact.countDocuments({ status: 'replied', lastReplyAt: { $gte: weekAgo } }),
    Contact.countDocuments({ status: 'replied' }),
  ]);

  res.json({ sent, replied, unread });
});

// GET /api/messages/:contactId — full thread for a contact
router.get('/:contactId', async (req, res) => {
  const messages = await Message.find({ contact: req.params.contactId }).sort({ sentAt: 1 });
  res.json({ messages });
});

module.exports = router;
