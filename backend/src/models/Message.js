const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  contact:    { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  threadId:   { type: String },
  text:       { type: String },
  sender:     { type: String }, // 'me' or contact name
  isOwn:      { type: Boolean, default: false },
  isRead:     { type: Boolean, default: false },
  sentAt:     { type: Date, default: Date.now },
  campaign:   { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
}, { timestamps: true });

MessageSchema.index({ contact: 1, sentAt: -1 });
MessageSchema.index({ threadId: 1 });

module.exports = mongoose.model('Message', MessageSchema);
