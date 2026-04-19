// ════════════════════════════════════════════════════════════
//  AI CONTROLLER — Handles all AI generation requests
//  POST /api/ai/generate-text  — text generation
//  POST /api/ai/generate-image — image generation
//  POST /api/ai/generate       — backward-compatible
// ════════════════════════════════════════════════════════════
const aiGateway = require('../services/aiGateway');
const { requireFields, sanitize } = require('../utils/validate');

/**
 * POST /api/ai/generate-text
 * Body: { prompt: string, taskType: string }
 */
exports.generateText = async (req, res) => {
  try {
    const { prompt, taskType = 'general' } = req.body;

    const missing = requireFields(req.body, ['prompt']);
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    const cleanPrompt = sanitize(prompt, 10000);
    if (cleanPrompt.length < 3) {
      return res.status(400).json({ error: 'Prompt must be at least 3 characters.' });
    }

    const { text, provider } = await aiGateway.generate(cleanPrompt, taskType);
    res.json({ success: true, text, provider });

  } catch (err) {
    const status = err.message?.startsWith('NO_KEY') ? 503
                 : err.message?.startsWith('SAFETY') ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/ai/generate-image
 * Body: { prompt: string }
 */
exports.generateImage = async (req, res) => {
  try {
    const { prompt } = req.body;

    const missing = requireFields(req.body, ['prompt']);
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    const cleanPrompt = sanitize(prompt, 5000);
    if (cleanPrompt.length < 3) {
      return res.status(400).json({ error: 'Image prompt must be at least 3 characters.' });
    }

    const result = await aiGateway.generateImage(cleanPrompt);
    res.json({ success: true, ...result });

  } catch (err) {
    const status = err.message?.startsWith('SAFETY') ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/ai/generate — backward-compatible wrapper
 * Body: { prompt: string, taskType: string }
 */
exports.generate = async (req, res) => {
  try {
    const { prompt, taskType = 'general' } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required and cannot be empty.' });
    }

    const { text, provider } = await aiGateway.generate(sanitize(prompt), taskType);
    res.json({ success: true, text, provider });

  } catch (err) {
    const status = err.message?.startsWith('NO_KEY') ? 503
                 : err.message?.startsWith('SAFETY') ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/ai/generate/stream — SSE streaming (future feature)
 */
exports.generateStream = (_req, res) => {
  res.status(501).json({ message: 'Streaming support coming in v6.0' });
};
