const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:       { type: String, required: true },
  username:   { type: String },
  profileUrl: { type: String },
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
    enum: [
      'new', 'connection_sent', 'connected', 'contacted',
      'replied', 'not_replied',
      'manual_validation', 'interested', 'not_interested',
      'meeting_scheduled', 'qualified', 'closed_won', 'converted', 'archived',
      'ooo', 'referral', 'question', 'form_request'
    ],
    default: 'new',
  },
  lastMessageAt:  { type: Date },
  lastReplyAt:    { type: Date },
  replyPreview:   { type: String },
  messageCount:   { type: Number, default: 0 },
  threadId:       { type: String },
  pipelineId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline' },
}, { timestamps: true });

module.exports = mongoose.model('Contact', ContactSchema);

