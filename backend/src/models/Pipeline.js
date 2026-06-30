const mongoose = require('mongoose');

const StageSchema = new mongoose.Schema({
  id:          { type: String, required: true },
  label:       { type: String, required: true },
  color:       { type: String, default: 'border-t-slate-400 bg-slate-100/40' },
  order:       { type: Number, default: 0 },
});

const PipelineSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name:        { type: String, required: true },
  description: { type: String },
  isDefault:   { type: Boolean, default: false },
  stages:      [StageSchema],
}, { timestamps: true });

module.exports = mongoose.model('Pipeline', PipelineSchema);
