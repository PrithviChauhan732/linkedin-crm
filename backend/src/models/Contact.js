const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  username:   { type: String },
  profileUrl: { type: String, unique: true, sparse: true },
  headline:   { type: String },
  company:    { type: String },
  email:      { type: String },
  phone:      { type: String },
  location:   { type: String },
  website:    { type: String },
  mutualConnection: { type: String },
  recentPostTopic:  { type: String },
  leadScore:        { type: Number, default: 50 },
  groups:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  tags:       [String],
  notes:      { type: String },
  status: {
    type: String,
    enum: ['new', 'contacted', 'replied', 'not_replied', 'meeting_scheduled', 'qualified', 'closed_won', 'converted', 'archived'],
    default: 'new',
  },
  lastMessageAt:  { type: Date },
  lastReplyAt:    { type: Date },
  replyPreview:   { type: String },
  messageCount:   { type: Number, default: 0 },
  threadId:       { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Contact', ContactSchema);

