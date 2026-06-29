const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === 'http://localhost:3000' || origin.endsWith('.vercel.app') || origin.startsWith('chrome-extension://')) {
      cb(null, true);
    } else {
      cb(null, true); // Allow production requests
    }
  },
}));
app.use(express.json());

// Routes
app.use('/api/contacts',  require('./routes/contacts'));
app.use('/api/groups',    require('./routes/groups'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/messages',  require('./routes/messages'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// DB + start
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/linkedin-crm')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('DB error:', err));

module.exports = app;
