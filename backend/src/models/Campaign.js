const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:       { type: String, required: true },
  group:      { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  template:   { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
  pipeline:   { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline' },
  status:     { type: String, enum: ['draft', 'running', 'paused', 'complete'], default: 'draft' },
  stats: {
    total:    { type: Number, default: 0 },
    sent:     { type: Number, default: 0 },
    replied:  { type: Number, default: 0 },
    failed:   { type: Number, default: 0 },
  },
  // Per-contact send log
  sends: [{
    contact:    { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    status:     { type: String, enum: ['pending', 'sent', 'replied', 'failed'], default: 'pending' },
    sentAt:     { type: Date },
    repliedAt:  { type: Date },
    error:      { type: String },
  }],
  delayBetweenMs: { type: Number, default: 4000 }, // delay between sends
}, { timestamps: true });

module.exports = mongoose.model('Campaign', CampaignSchema);
