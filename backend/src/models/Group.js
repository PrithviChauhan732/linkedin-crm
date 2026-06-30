const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:        { type: String, required: true },
  description: { type: String },
  color:       { type: String, default: '#0a66c2' },
  contacts:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
}, { timestamps: true });

module.exports = mongoose.model('Group', GroupSchema);
