'use strict';
// ════════════════════════════════════════════════════════════
//  AI CONTROLLER
//  Handles text generation and image generation requests.
//  Frontend calls this → server calls AI APIs with hidden keys.
// ════════════════════════════════════════════════════════════
const aiGateway = require('../services/aiGateway');

/**
 * POST /api/ai/generate-text
 * Body: { prompt: string, taskType?: string }
 * Response: { success: true, text: string, provider: string }
 */
exports.generateText = async (req, res) => {
  try {
    const { prompt, taskType = 'general' } = req.body;

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: 'prompt is required and cannot be empty.' });
    }
    if (String(prompt).length > 8000) {
      return res.status(400).json({ error: 'prompt exceeds maximum length of 8000 characters.' });
    }

    const { text, provider } = await aiGateway.generate(String(prompt).trim(), taskType);
    res.json({ success: true, text, provider });

  } catch (err) {
    const msg    = err.message || 'Internal server error';
    const status = msg.startsWith('SAFETY:') ? 400
                 : msg.startsWith('NO_KEY:') ? 503
                 : msg.startsWith('AUTH:')   ? 401
                 : 500;
    res.status(status).json({ error: msg.replace(/^(SAFETY:|NO_KEY:|AUTH:)/, '') });
  }
};

/**
 * POST /api/ai/generate-image
 * Body: { prompt: string }
 * Response: { success, imageUrl, description, provider, mode, meta }
 */
exports.generateImage = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: 'prompt is required.' });
    }

    // Image generation via backend gateway
    const result = await aiGateway.generateImage(String(prompt).trim());
    res.json(result);

  } catch (err) {
    const msg    = err.message || 'Image generation failed';
    const status = msg.startsWith('SAFETY:') ? 400 : 500;
    res.status(status).json({
      success:     false,
      error:       msg.replace(/^SAFETY:/, ''),
      imageUrl:    null,
      description: '',
      provider:    'Error',
      mode:        'described',
      meta:        {}
    });
  }
};

/**
 * POST /api/ai/generate/stream — SSE streaming placeholder
 */
exports.generateStream = (_req, res) => {
  res.status(501).json({ message: 'SSE streaming — coming in v7.0' });
};
