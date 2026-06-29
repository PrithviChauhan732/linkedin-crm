const router = require('express').Router();
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');

// POST /api/messages/sync-conversations — called by extension with conversation list
router.post('/sync-conversations', async (req, res) => {
  const conversations = req.body; // array of { name, preview, isUnread, threadId, profileUrl }

  for (const conv of conversations) {
    // Match contact by profileUrl (full page) or by name+threadId (tray)
    let contact = null;
    if (conv.profileUrl) {
      contact = await Contact.findOne({ profileUrl: conv.profileUrl });
    }
    if (!contact && conv.threadId) {
      contact = await Contact.findOne({ threadId: conv.threadId });
    }
    if (!contact && conv.name) {
      contact = await Contact.findOne({ name: conv.name, status: 'contacted' });
    }
    if (!contact) continue;

    // Detect a reply: isUnread flag OR last message isn't ours (preview from them)
    const hasReply = conv.isUnread;
    if (hasReply && contact.status === 'contacted') {
      await Contact.findByIdAndUpdate(contact._id, {
        status:       'replied',
        lastReplyAt:  new Date(),
        replyPreview: conv.preview || '',
      });

      await Campaign.updateMany(
        { 'sends.contact': contact._id, 'sends.status': 'sent' },
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

    if (conv.threadId) {
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
