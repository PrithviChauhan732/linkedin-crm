const mongoose = require('mongoose');

const NodeSchema = new mongoose.Schema({
  id:       { type: String, required: true },
  type:     { type: String, enum: ['trigger', 'ml_condition', 'action'], required: true },
  label:    { type: String, required: true },
  config:   { type: mongoose.Schema.Types.Mixed, default: {} },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  }
});

const EdgeSchema = new mongoose.Schema({
  id:           { type: String, required: true },
  source:       { type: String, required: true },
  target:       { type: String, required: true },
  sourceHandle: { type: String }, // e.g. 'interested', 'not_hiring'
});

const WorkflowSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name:        { type: String, required: true },
  description: { type: String },
  active:      { type: Boolean, default: true },
  nodes:       [NodeSchema],
  edges:       [EdgeSchema],
}, { timestamps: true });

module.exports = mongoose.model('Workflow', WorkflowSchema);
