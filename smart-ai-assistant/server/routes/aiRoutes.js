const router  = require('express').Router();
const aiCtrl  = require('../controllers/aiController');
const auth    = require('../middleware/authMiddleware');

// POST /api/ai/generate-text  — text generation
router.post('/generate-text',   auth, aiCtrl.generateText);
// POST /api/ai/generate-image — image generation
router.post('/generate-image',  auth, aiCtrl.generateImage);
// POST /api/ai/generate       — backward-compatible
router.post('/generate',        auth, aiCtrl.generate);
// POST /api/ai/generate/stream — streaming (future)
router.post('/generate/stream', auth, aiCtrl.generateStream);

module.exports = router;
