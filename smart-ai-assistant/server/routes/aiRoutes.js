'use strict';
const router  = require('express').Router();
const aiCtrl  = require('../controllers/aiController');
const auth    = require('../middleware/authMiddleware');

// ── Text generation ───────────────────────────────────────
// POST /api/ai/generate       — alias kept for backward compat
// POST /api/ai/generate-text  — recommended endpoint
router.post('/generate',       auth, aiCtrl.generateText);
router.post('/generate-text',  auth, aiCtrl.generateText);

// ── Image generation ─────────────────────────────────────
// POST /api/ai/generate-image
router.post('/generate-image', auth, aiCtrl.generateImage);

// ── Streaming (future) ────────────────────────────────────
router.post('/generate/stream', auth, aiCtrl.generateStream);

module.exports = router;
