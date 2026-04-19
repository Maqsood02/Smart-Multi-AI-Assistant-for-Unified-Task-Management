// ════════════════════════════════════════════════════════════
//  AUTH CONTROLLER
//  TODO: Connect to MongoDB User model + bcrypt + JWT
// ════════════════════════════════════════════════════════════
const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET || 'dev_secret_change_in_prod';
const users       = new Map(); // Replace with MongoDB User model

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'name, email, and password are required.' });
    if (users.has(email))
      return res.status(409).json({ error: 'Email already registered.' });

    // TODO: hash password with bcrypt
    const user = { id: Date.now(), name, email, password };
    users.set(email, user);

    const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, name, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users.get(email);
    if (!user || user.password !== password)
      return res.status(401).json({ error: 'Invalid email or password.' });

    const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.logout = (_req, res) => res.json({ message: 'Logged out successfully.' });

exports.me = (req, res) => res.json({ userId: req.userId });
