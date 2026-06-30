const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}));
app.options('*', cors());
app.use(express.json());

const authMiddleware = require('./middleware/authMiddleware');

// Routes
app.use('/api/auth',      require('./routes/auth'));

// Protected Routes
app.use('/api/contacts',  authMiddleware, require('./routes/contacts'));
app.use('/api/groups',    authMiddleware, require('./routes/groups'));
app.use('/api/templates', authMiddleware, require('./routes/templates'));
app.use('/api/campaigns', authMiddleware, require('./routes/campaigns'));
app.use('/api/messages',  authMiddleware, require('./routes/messages'));
app.use('/api/pipelines', authMiddleware, require('./routes/pipelines'));
app.use('/api/workflows', authMiddleware, require('./routes/workflows'));

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
