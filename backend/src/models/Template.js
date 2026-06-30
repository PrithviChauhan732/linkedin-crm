const mongoose = require('mongoose');

const TemplateSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:        { type: String, required: true },
  body:        { type: String, required: true },
  // Supported variables: {name}, {full_name}, {headline}, {company}
  variables:   [String],
  category:    { type: String, enum: ['outreach', 'followup', 'nurture', 'other'], default: 'outreach' },
  timesUsed:   { type: Number, default: 0 },
  replyRate:   { type: Number, default: 0 }, // 0-100%
}, { timestamps: true });

module.exports = mongoose.model('Template', TemplateSchema);
