// ════════════════════════════════════════════════════════════
//  AUTH MIDDLEWARE — Verify JWT token
// ════════════════════════════════════════════════════════════
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_prod';

module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    // Allow unauthenticated in dev mode
    if (process.env.NODE_ENV === 'development') {
      req.userId = 'dev-user';
      return next();
    }
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  try {
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId    = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};
