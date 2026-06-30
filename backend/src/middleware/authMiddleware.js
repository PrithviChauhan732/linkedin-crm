const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'warmdm-secret-key-12345';

module.exports = (req, res, next) => {
  // Allow OPTIONS preflight requests to pass through unauthenticated
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};
