// ════════════════════════════════════════════════════════════
//  EXPRESS APP — Smart Multi-AI Assistant Backend
//  ⚠️  Frontend-only right now. This scaffold is MERN-ready.
// ════════════════════════════════════════════════════════════
const express = require('express');
const cors    = require('cors');
const app     = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/ai',    require('./routes/aiRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/auth',  require('./routes/authRoutes'));

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', version: '5.0', timestamp: new Date().toISOString() })
);

app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
