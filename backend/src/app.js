const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const app = express();

// Secure Express headers with Helmet
app.use(helmet());

// Enable CORS
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}));
app.options('*', cors());

// Rate Limiting Config
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // stricter limit on authentication endpoints
  message: { error: 'Too many login or registration attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// JSON Body Parser & NoSQL Injection Protection
app.use(express.json());
app.use(mongoSanitize());

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
