const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name:        { type: String, required: true },
  linkedinUrl: { type: String, required: true },
  industry:    { type: String, default: '' },
  size:        { type: String, default: '' },
  location:    { type: String, default: '' },
  description: { type: String, default: '' },
  website:     { type: String, default: '' },
  group:       { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
  addedAt:     { type: Date, default: Date.now },
}, { timestamps: true });

CompanySchema.index({ user: 1, linkedinUrl: 1 }, { unique: true });

module.exports = mongoose.model('Company', CompanySchema);
